"use server";

import { db } from "~/server/db";
import { checkedInAgents, leads, users, autoAssignmentSettings, leadAssignmentHistory } from "~/server/db/schema";
import { and, eq, gt, isNull, ne, sql, desc, asc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

// Helper function to get today's date as a SQL date expression
function getTodayAsSql() {
  return sql`CURRENT_DATE`;
}

// Check in an agent for today
export async function checkInAgent() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Check if the agent is already checked in for today
    const existingCheckIn = await db.query.checkedInAgents.findFirst({
      where: and(
        eq(checkedInAgents.agent_id, userId),
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`)
      ),
    });

    if (existingCheckIn) {
      // Update existing check-in
      await db
        .update(checkedInAgents)
        .set({ 
          is_active: true,
          updated_at: new Date() 
        })
        .where(eq(checkedInAgents.id, existingCheckIn.id));
      
      return { 
        success: true, 
        message: "You're checked in for today!",
        isNew: false
      };
    }

    // Create new check-in record
    await db.insert(checkedInAgents).values({
      agent_id: userId,
      checked_in_date: sql`CURRENT_DATE`,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return { 
      success: true, 
      message: "You're now checked in for today!", 
      isNew: true 
    };
  } catch (error) {
    console.error("Error checking in agent:", error);
    return { success: false, message: "Failed to check in" };
  }
}

// Check out an agent (mark as inactive)
export async function checkOutAgent() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Find today's check-in
    const existingCheckIn = await db.query.checkedInAgents.findFirst({
      where: and(
        eq(checkedInAgents.agent_id, userId),
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`)
      ),
    });

    if (!existingCheckIn) {
      return { success: false, message: "You're not checked in for today" };
    }

    // Update check-in status
    await db
      .update(checkedInAgents)
      .set({ 
        is_active: false,
        updated_at: new Date() 
      })
      .where(eq(checkedInAgents.id, existingCheckIn.id));
    
    return { success: true, message: "You're now checked out" };
  } catch (error) {
    console.error("Error checking out agent:", error);
    return { success: false, message: "Failed to check out" };
  }
}

// Get count of checked-in agents
export async function getCheckedInAgentCount() {
  try {
    const checkedInCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(checkedInAgents)
      .where(
        and(
          eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
          eq(checkedInAgents.is_active, true)
        )
      );
    
    return { 
      success: true, 
      count: checkedInCount[0]?.count ?? 0 
    };
  } catch (error) {
    console.error("Error getting checked-in agent count:", error);
    return { success: false, count: 0 };
  }
}

// Get all checked-in agents for today
export async function getCheckedInAgents() {
  try {
    const agents = await db.query.checkedInAgents.findMany({
      where: and(
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true)
      ),
      with: {
        agent: {
          columns: {
            id: true,
            first_name: true,
            last_name: true,
          }
        }
      },
      orderBy: [desc(checkedInAgents.created_at)]
    });
    
    return { success: true, agents };
  } catch (error) {
    console.error("Error getting checked-in agents:", error);
    return { success: false, agents: [] };
  }
}

// Auto-assign leads to checked-in agents (manual assignment by admin)
export async function autoAssignLeads() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Get all checked-in agents (no settings check needed for manual assignment)
    const checkedInAgentsList = await db.query.checkedInAgents.findMany({
      where: and(
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true)
      ),
      with: {
        agent: true
      },
      orderBy: [asc(checkedInAgents.id)] // Consistent ordering for round-robin
    });
    console.log('Checked in agents list:', checkedInAgentsList);
    
    if (checkedInAgentsList.length === 0) {
      return { 
        success: false, 
        message: "No agents are checked in today" 
      };
    }

    // Get new unassigned leads ordered by ID to ensure fair distribution
    const unassignedLeads = await db.query.leads.findMany({
      where: and(
        eq(leads.status, 'new'),
        isNull(leads.assigned_to)
      ),
      orderBy: [asc(leads.id)] // Order by ID for consistent round-robin
    });

    if (unassignedLeads.length === 0) {
      return { 
        success: false, 
        message: "No new unassigned leads available" 
      };
    }

    let assignedCount = 0;
    
    // Use round-robin assignment based on lead_id to ensure fair distribution
    // This prevents some agents from getting all old leads and others getting all new leads
    for (const lead of unassignedLeads) {
      // Use lead ID modulo number of agents to determine which agent gets this lead
      const agentIndex = lead.id % checkedInAgentsList.length;
      const selectedAgent = checkedInAgentsList[agentIndex];
      
      if (!selectedAgent) continue;
      
      // Update lead assignment
      await db
        .update(leads)
        .set({ 
          assigned_to: selectedAgent.agent_id,
          status: 'assigned',  // Change status from new to assigned
          updated_at: new Date(),
          updated_by: userId
        })
        .where(eq(leads.id, lead.id));
      
      // Record assignment history
      await db.insert(leadAssignmentHistory).values({
        lead_id: lead.id,
        assigned_to: selectedAgent.agent_id,
        assignment_method: 'manual_round_robin',
        assignment_reason: `Round-robin assignment based on lead ID (${lead.id} % ${checkedInAgentsList.length} = ${agentIndex})`,
        assigned_at: new Date()
      });
      
      assignedCount++;
    }

    return { 
      success: true, 
      message: `Successfully assigned ${assignedCount} leads to ${checkedInAgentsList.length} agents using round-robin distribution` 
    };
  } catch (error) {
    console.error("Error auto-assigning leads:", error);
    return { success: false, message: "Failed to auto-assign leads" };
  }
}

// Get auto-assignment settings
export async function getAutoAssignmentSettings() {
  try {
    // console.log("📋 getAutoAssignmentSettings: Fetching settings from database...");
    
    const settings = await db.query.autoAssignmentSettings.findFirst({
      orderBy: [desc(autoAssignmentSettings.id)]
    });
    
    // console.log("📋 getAutoAssignmentSettings: Raw settings from DB:", settings);
    
    if (!settings) {
      // console.log("📋 getAutoAssignmentSettings: No settings found, creating default...");
      // Create default settings if none exist
      const defaultSettings = await db.insert(autoAssignmentSettings).values({
        is_enabled: false,
        assignment_method: 'round_robin',
        current_round_robin_index: 0,
        max_leads_per_agent_per_day: 20
      }).returning();
      
      // console.log("📋 getAutoAssignmentSettings: Created default settings:", defaultSettings[0]);
      
      return {
        success: true,
        settings: defaultSettings[0]
      };
    }
    
    // console.log("✅ getAutoAssignmentSettings: Returning existing settings:", settings);
    
    return {
      success: true,
      settings
    };
  } catch (error) {
    console.error("❌ Error getting auto-assignment settings:", error);
    return {
      success: false,
      error: "Failed to get auto-assignment settings"
    };
  }
}

// Update auto-assignment settings
export async function updateAutoAssignmentSettings(settingsData: {
  is_enabled?: boolean;
  assignment_method?: string;
  max_leads_per_agent_per_day?: number;
}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ updateAutoAssignmentSettings: Not authenticated");
      return { success: false, message: "Not authenticated" };
    }

    console.log("🔧 updateAutoAssignmentSettings: Starting with data:", settingsData);

    const currentSettings = await getAutoAssignmentSettings();
    if (!currentSettings.success || !currentSettings.settings) {
      console.log("❌ updateAutoAssignmentSettings: Could not get current settings:", currentSettings);
      return { success: false, message: "Could not get current settings" };
    }

    console.log("📋 updateAutoAssignmentSettings: Current settings:", currentSettings.settings);
    console.log("🔄 updateAutoAssignmentSettings: Updating with:", {
      ...settingsData,
      updated_at: new Date(),
      updated_by: userId
    });

    const updatedSettings = await db
      .update(autoAssignmentSettings)
      .set({
        ...settingsData,
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(autoAssignmentSettings.id, currentSettings.settings.id))
      .returning();

    console.log("✅ updateAutoAssignmentSettings: Updated settings:", updatedSettings[0]);

    return {
      success: true,
      settings: updatedSettings[0],
      message: "Auto-assignment settings updated successfully"
    };
  } catch (error) {
    console.error("❌ Error updating auto-assignment settings:", error);
    return {
      success: false,
      message: "Failed to update auto-assignment settings"
    };
  }
}

// Get assignment preview with round-robin simulation
export async function getAssignmentPreviewWithRoundRobin() {
  try {
    // Get checked-in agents ordered by their round-robin position
    const checkedInAgentsList = await db.query.checkedInAgents.findMany({
      where: and(
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true)
      ),
      with: {
        agent: {
          columns: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: [asc(checkedInAgents.id)] // Consistent ordering for round-robin
    });

    if (checkedInAgentsList.length === 0) {
      return {
        success: false,
        message: "No agents are checked in today",
        preview: [],
        totalAgents: 0,
        totalLeads: 0
      };
    }

    // Get current auto-assignment settings
    const settingsResult = await getAutoAssignmentSettings();
    if (!settingsResult.success || !settingsResult.settings) {
      return {
        success: false,
        message: "Could not get assignment settings",
        preview: [],
        totalAgents: 0,
        totalLeads: 0
      };
    }

    const settings = settingsResult.settings;

    // Get unassigned leads count
    const unassignedLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(
        eq(leads.status, 'new'),
        isNull(leads.assigned_to)
      ));
    
    const unassignedLeadsCount = unassignedLeadsResult[0]?.count ?? 0;

    if (unassignedLeadsCount === 0) {
      return {
        success: true,
        message: "No unassigned leads available",
        preview: checkedInAgentsList.map(agentRecord => {
          const agent = agentRecord.agent;
          const firstName = agent?.first_name ?? '';
          const lastName = agent?.last_name ?? '';
          const agentName = `${firstName} ${lastName}`.trim() || 'Unknown';
          
          return {
            agentId: agentRecord.agent_id,
            agentName,
            leadCount: 0,
            currentCount: agentRecord.current_lead_count ?? 0,
            capacity: agentRecord.lead_capacity ?? 10,
            weight: agentRecord.weight ?? 1,
            canReceiveMore: (agentRecord.current_lead_count ?? 0) < (agentRecord.lead_capacity ?? 10)
          };
        }),
        totalAgents: checkedInAgentsList.length,
        totalLeads: 0
      };
    }

    // Simulate round-robin assignment
    const preview = checkedInAgentsList.map(agentRecord => {
      const agent = agentRecord.agent;
      const firstName = agent?.first_name ?? '';
      const lastName = agent?.last_name ?? '';
      const agentName = `${firstName} ${lastName}`.trim() || 'Unknown';
      
      return {
        agentId: agentRecord.agent_id,
        agentName,
        leadCount: 0,
        currentCount: agentRecord.current_lead_count ?? 0,
        capacity: agentRecord.lead_capacity ?? 10,
        weight: agentRecord.weight ?? 1,
        canReceiveMore: (agentRecord.current_lead_count ?? 0) < (agentRecord.lead_capacity ?? 10)
      };
    });

    // Filter agents who can receive more leads
    const availableAgents = preview.filter(agent => agent.canReceiveMore);
    
    if (availableAgents.length === 0) {
      return {
        success: false,
        message: "All agents have reached their daily capacity",
        preview,
        totalAgents: checkedInAgentsList.length,
        totalLeads: unassignedLeadsCount
      };
    }

    // Distribute leads using round-robin starting from current index
    let currentIndex = (settings.current_round_robin_index ?? 0) % availableAgents.length;
    let leadsToAssign = unassignedLeadsCount;

    while (leadsToAssign > 0 && availableAgents.some(a => a.canReceiveMore)) {
      const agent = availableAgents[currentIndex];
      if (agent?.canReceiveMore) {
        agent.leadCount++;
        agent.currentCount++;
        agent.canReceiveMore = agent.currentCount < agent.capacity;
        leadsToAssign--;
      }
      
      currentIndex = (currentIndex + 1) % availableAgents.length;
      
      // Safety break to prevent infinite loop
      if (availableAgents.every(a => !a.canReceiveMore)) {
        break;
      }
    }

    return {
      success: true,
      preview,
      totalAgents: checkedInAgentsList.length,
      totalLeads: unassignedLeadsCount,
      leadsToAssign: unassignedLeadsCount - leadsToAssign,
      nextRoundRobinIndex: currentIndex,
      settings
    };
  } catch (error) {
    console.error("Error getting assignment preview:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      preview: [],
      totalAgents: 0,
      totalLeads: 0
    };
  }
}

// Auto-assign a single lead (used when new leads come in)
export async function autoAssignSingleLead(leadId: number) {
  try {
    const isAutoAssignEnabled = await getAutoAssignmentSettings();
    if (!isAutoAssignEnabled.success || !isAutoAssignEnabled.settings?.is_enabled) {
      return {
        success: false,
        message: "Auto-assignment is not enabled"
      };
    }
    // Get all checked-in agents (no settings check needed)
    const availableAgents = await db.query.checkedInAgents.findMany({
      where: and(
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true)
      ),
      with: {
        agent: {
          columns: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: [asc(checkedInAgents.id)] // Consistent ordering for round-robin
    });

    if (availableAgents.length === 0) {
      return {
        success: false,
        message: "No agents are checked in today"
      };
    }

    // Use round-robin based on lead_id for fair distribution
    const agentIndex = leadId % availableAgents.length;
    const selectedAgent = availableAgents[agentIndex];

    if (!selectedAgent) {
      return {
        success: false,
        message: "Could not select agent for assignment"
      };
    }

    // Assign the lead
    await db.transaction(async (tx) => {
      // Update lead assignment
      await tx
        .update(leads)
        .set({
          assigned_to: selectedAgent.agent_id,
          status: 'assigned',
          updated_at: new Date()
        })
        .where(eq(leads.id, leadId));

      // Update agent's current lead count
      await tx
        .update(checkedInAgents)
        .set({
          current_lead_count: sql`${checkedInAgents.current_lead_count} + 1`,
          last_assigned_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(checkedInAgents.id, selectedAgent.id));

      // Record assignment history (with round-robin details)
      await tx.insert(leadAssignmentHistory).values({
        lead_id: leadId,
        assigned_to: selectedAgent.agent_id,
        assignment_method: 'auto_round_robin',
        assignment_reason: `Auto-assigned via round-robin based on lead ID (${leadId} % ${availableAgents.length} = ${agentIndex})`,
        assigned_at: new Date()
      });
    });

    const agentName = `${selectedAgent.agent?.first_name ?? ''} ${selectedAgent.agent?.last_name ?? ''}`.trim() || 'Unknown';

    return {
      success: true,
      message: `Lead automatically assigned to ${agentName} via round-robin`,
      assignedTo: selectedAgent.agent_id,
      agentName,
      assignmentMethod: 'auto_round_robin'
    };
  } catch (error) {
    console.error("Error auto-assigning lead:", error);
    return {
      success: false,
      message: "Failed to auto-assign lead"
    };
  }
}

// Optimized bulk auto-assign leads with modulo-based distribution
export async function bulkAutoAssignLeads() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Check if auto-assignment is enabled
    const settingsResult = await getAutoAssignmentSettings();
    if (!settingsResult.success || !settingsResult.settings?.is_enabled) {
      return {
        success: false,
        message: "Auto-assignment is not enabled"
      };
    }

    const settings = settingsResult.settings;

    // Get available agents with their current counts and capacities
    const availableAgents = await db.query.checkedInAgents.findMany({
      where: and(
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true),
        sql`${checkedInAgents.current_lead_count} < ${checkedInAgents.lead_capacity}`
      ),
      with: {
        agent: {
          columns: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: [asc(checkedInAgents.id)]
    });

    if (availableAgents.length === 0) {
      return {
        success: false,
        message: "No available agents to assign leads"
      };
    }

    // Get unassigned leads
    const unassignedLeads = await db.query.leads.findMany({
      where: and(
        eq(leads.status, 'new'),
        isNull(leads.assigned_to)
      ),
      orderBy: [asc(leads.created_at)]
    });

    if (unassignedLeads.length === 0) {
      return {
        success: false,
        message: "No unassigned leads available"
      };
    }

    // Create weighted distribution array
    const weightedAgents: typeof availableAgents[0][] = [];
    availableAgents.forEach(agent => {
      const weight = agent.weight ?? 1;
      for (let i = 0; i < weight; i++) {
        weightedAgents.push(agent);
      }
    });

    // Calculate assignments using modulo with weights and capacity limits
    const assignments: Array<{
      leadId: number;
      agentId: string;
      agentCheckInId: number;
      agentName: string;
    }> = [];

    const agentLeadCounts = new Map<string, number>();
    availableAgents.forEach(agent => {
      agentLeadCounts.set(agent.agent_id, agent.current_lead_count ?? 0);
    });

    let currentIndex = settings.current_round_robin_index ?? 0;
    
    for (const lead of unassignedLeads) {
      let assigned = false;
      let attempts = 0;
      
      // Try to find an available agent starting from current round-robin position
      while (!assigned && attempts < weightedAgents.length) {
        const selectedAgent = weightedAgents[currentIndex % weightedAgents.length];
        if (!selectedAgent) break;
        
        const currentCount = agentLeadCounts.get(selectedAgent.agent_id) ?? 0;
        const capacity = selectedAgent.lead_capacity ?? 10;
        
        if (currentCount < capacity) {
          // Assign this lead to the agent
          const agentName = `${selectedAgent.agent?.first_name ?? ''} ${selectedAgent.agent?.last_name ?? ''}`.trim() || 'Unknown';
          
          assignments.push({
            leadId: lead.id,
            agentId: selectedAgent.agent_id,
            agentCheckInId: selectedAgent.id,
            agentName
          });
          
          // Update the count for this agent
          agentLeadCounts.set(selectedAgent.agent_id, currentCount + 1);
          assigned = true;
        }
        
        currentIndex++;
        attempts++;
      }
      
      // If we couldn't assign this lead, stop processing
      if (!assigned) {
        break;
      }
    }

    if (assignments.length === 0) {
      return {
        success: false,
        message: "All agents have reached their capacity"
      };
    }

    // Perform bulk assignments in a transaction
    await db.transaction(async (tx) => {
      // Group assignments by agent for efficient updates
      const agentAssignments = new Map<string, Array<{leadId: number; agentCheckInId: number}>>();
      
      assignments.forEach(assignment => {
        if (!agentAssignments.has(assignment.agentId)) {
          agentAssignments.set(assignment.agentId, []);
        }
        agentAssignments.get(assignment.agentId)!.push({
          leadId: assignment.leadId,
          agentCheckInId: assignment.agentCheckInId
        });
      });

      // Update leads in batches
      for (const assignment of assignments) {
        await tx
          .update(leads)
          .set({
            assigned_to: assignment.agentId,
            status: 'assigned',
            updated_at: new Date()
          })
          .where(eq(leads.id, assignment.leadId));
      }

      // Update agent lead counts
      for (const [agentId, agentLeads] of agentAssignments) {
        const checkInRecord = agentLeads[0];
        if (checkInRecord) {
          await tx
            .update(checkedInAgents)
            .set({
              current_lead_count: sql`${checkedInAgents.current_lead_count} + ${agentLeads.length}`,
              last_assigned_at: new Date(),
              updated_at: new Date()
            })
            .where(eq(checkedInAgents.id, checkInRecord.agentCheckInId));
        }
      }

      // Update round-robin index to continue from where we left off
      await tx
        .update(autoAssignmentSettings)
        .set({
          current_round_robin_index: currentIndex % weightedAgents.length,
          updated_at: new Date()
        })
        .where(eq(autoAssignmentSettings.id, settings.id));

      // Record assignment history
      for (const assignment of assignments) {
        await tx.insert(leadAssignmentHistory).values({
          lead_id: assignment.leadId,
          assigned_to: assignment.agentId,
          assignment_method: 'bulk_auto_round_robin',
          assignment_reason: `Bulk auto-assigned via weighted round-robin`,
          assigned_at: new Date()
        });
      }
    });

    // Create summary by agent
    const assignmentSummary = new Map<string, {agentName: string; count: number}>();
    assignments.forEach(assignment => {
      if (!assignmentSummary.has(assignment.agentId)) {
        assignmentSummary.set(assignment.agentId, {
          agentName: assignment.agentName,
          count: 0
        });
      }
      assignmentSummary.get(assignment.agentId)!.count++;
    });

    return {
      success: true,
      message: `Successfully assigned ${assignments.length} leads to ${assignmentSummary.size} agents`,
      assignedCount: assignments.length,
      totalLeads: unassignedLeads.length,
      assignments: Array.from(assignmentSummary.entries()).map(([agentId, data]) => ({
        agentId,
        agentName: data.agentName,
        leadCount: data.count
      }))
    };
  } catch (error) {
    console.error("Error bulk auto-assigning leads:", error);
    return {
      success: false,
      message: "Failed to bulk assign leads"
    };
  }
}

// Update agent capacity and weight
export async function updateAgentCapacity(agentId: string, capacity: number, weight = 1) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Find today's check-in record for the agent
    const agentCheckIn = await db.query.checkedInAgents.findFirst({
      where: and(
        eq(checkedInAgents.agent_id, agentId),
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`)
      )
    });

    if (!agentCheckIn) {
      return {
        success: false,
        message: "Agent is not checked in today"
      };
    }

    // Update capacity and weight
    await db
      .update(checkedInAgents)
      .set({
        lead_capacity: capacity,
        weight: weight,
        updated_at: new Date()
      })
      .where(eq(checkedInAgents.id, agentCheckIn.id));

    return {
      success: true,
      message: "Agent capacity and weight updated successfully"
    };
  } catch (error) {
    console.error("Error updating agent capacity:", error);
    return {
      success: false,
      message: "Failed to update agent capacity"
    };
  }
}

// Reset round-robin index (useful for admin)
export async function resetRoundRobinIndex() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    const settingsResult = await getAutoAssignmentSettings();
    if (!settingsResult.success || !settingsResult.settings) {
      return { success: false, message: "Could not get settings" };
    }

    await db
      .update(autoAssignmentSettings)
      .set({
        current_round_robin_index: 0,
        last_assigned_agent_id: null,
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(autoAssignmentSettings.id, settingsResult.settings.id));

    return {
      success: true,
      message: "Round-robin index reset successfully"
    };
  } catch (error) {
    console.error("Error resetting round-robin index:", error);
    return {
      success: false,
      message: "Failed to reset round-robin index"
    };
  }
}

// Check if an agent is currently checked in
export async function checkAgentStatus(agentId?: string) {
  try {
    // If no agentId provided, use the current authenticated user
    let targetAgentId = agentId;
    if (!targetAgentId) {
      const { userId } = await auth();
      if (!userId) {
        return { success: false, message: "Not authenticated", isCheckedIn: false };
      }
      targetAgentId = userId;
    }

    // Check if the agent is checked in for today
    const existingCheckIn = await db.query.checkedInAgents.findFirst({
      where: and(
        eq(checkedInAgents.agent_id, targetAgentId),
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true)
      ),
      with: {
        agent: {
          columns: {
            id: true,
            first_name: true,
            last_name: true,
          }
        }
      }
    });

    if (existingCheckIn) {
      return {
        success: true,
        isCheckedIn: true,
        checkInData: {
          id: existingCheckIn.id,
          agentId: existingCheckIn.agent_id,
          checkedInDate: existingCheckIn.checked_in_date,
          createdAt: existingCheckIn.created_at,
          updatedAt: existingCheckIn.updated_at,
          agentName: existingCheckIn.agent 
            ? `${existingCheckIn.agent.first_name ?? ''} ${existingCheckIn.agent.last_name ?? ''}`.trim()
            : 'Unknown'
        }
      };
    }

    return {
      success: true,
      isCheckedIn: false,
      checkInData: null
    };
  } catch (error) {
    console.error("Error checking agent status:", error);
    return {
      success: false,
      message: "Failed to check agent status",
      isCheckedIn: false,
      checkInData: null
    };
  }
}

// Get assignment preview for manual assignment (round-robin based on lead_id)
export async function getManualAssignmentPreview() {
  try {
    // Get checked-in agents in consistent order
    const checkedInAgentsList = await db.query.checkedInAgents.findMany({
      where: and(
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true)
      ),
      with: {
        agent: {
          columns: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: [asc(checkedInAgents.id)] // Consistent ordering for round-robin
    });

    if (checkedInAgentsList.length === 0) {
      return {
        success: false,
        message: "No agents are checked in today",
        preview: [],
        totalAgents: 0,
        totalLeads: 0
      };
    }

    // Get unassigned leads with their IDs for round-robin calculation
    const unassignedLeads = await db.query.leads.findMany({
      where: and(
        eq(leads.status, 'new'),
        isNull(leads.assigned_to)
      ),
      columns: {
        id: true
      },
      orderBy: [asc(leads.id)]
    });

    if (unassignedLeads.length === 0) {
      return {
        success: true,
        message: "No unassigned leads available",
        preview: checkedInAgentsList.map(agentRecord => {
          const agent = agentRecord.agent;
          const firstName = agent?.first_name ?? '';
          const lastName = agent?.last_name ?? '';
          const agentName = `${firstName} ${lastName}`.trim() || 'Unknown';
          
          return {
            agentId: agentRecord.agent_id,
            agentName,
            leadCount: 0
          };
        }),
        totalAgents: checkedInAgentsList.length,
        totalLeads: 0
      };
    }

    // Calculate round-robin distribution based on lead IDs
    const agentLeadCounts = new Map<string, number>();
    
    // Initialize counts
    checkedInAgentsList.forEach(agent => {
      agentLeadCounts.set(agent.agent_id, 0);
    });
    
    // Simulate round-robin assignment based on lead ID
    unassignedLeads.forEach(lead => {
      const agentIndex = lead.id % checkedInAgentsList.length;
      const selectedAgent = checkedInAgentsList[agentIndex];
      
      if (selectedAgent) {
        const currentCount = agentLeadCounts.get(selectedAgent.agent_id) ?? 0;
        agentLeadCounts.set(selectedAgent.agent_id, currentCount + 1);
      }
    });

    // Create preview with calculated counts
    const preview = checkedInAgentsList.map(agentRecord => {
      const agent = agentRecord.agent;
      const firstName = agent?.first_name ?? '';
      const lastName = agent?.last_name ?? '';
      const agentName = `${firstName} ${lastName}`.trim() || 'Unknown';
      
      return {
        agentId: agentRecord.agent_id,
        agentName,
        leadCount: agentLeadCounts.get(agentRecord.agent_id) ?? 0
      };
    });

    return {
      success: true,
      preview,
      totalAgents: checkedInAgentsList.length,
      totalLeads: unassignedLeads.length,
      message: `Round-robin distribution based on lead IDs ensures fair distribution of old and new leads`
    };
  } catch (error) {
    console.error("Error getting manual assignment preview:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      preview: [],
      totalAgents: 0,
      totalLeads: 0
    };
  }
}

// Manually assign a specific lead to a specific agent
export async function assignLeadToAgent(leadId: number, agentId: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Verify the lead exists and is assignable
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      columns: {
        id: true,
        status: true,
        assigned_to: true,
        full_name: true
      }
    });

    if (!lead) {
      return { success: false, message: "Lead not found" };
    }

    // Verify the agent exists
    const agent = await db.query.users.findFirst({
      where: eq(users.id, agentId),
      columns: {
        id: true,
        first_name: true,
        last_name: true
      }
    });

    if (!agent) {
      return { success: false, message: "Agent not found" };
    }

    // // Check if agent is checked in today (optional - you can remove this if not required)
    // const agentCheckIn = await db.query.checkedInAgents.findFirst({
    //   where: and(
    //     eq(checkedInAgents.agent_id, agentId),
    //     eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
    //     eq(checkedInAgents.is_active, true)
    //   )
    // });

    // Perform the assignment in a transaction
    await db.transaction(async (tx) => {
      // Update lead assignment
      await tx
        .update(leads)
        .set({
          assigned_to: agentId,
          updated_at: new Date(),
          updated_by: userId
        })
        .where(eq(leads.id, leadId));

      // Update agent's current lead count if checked in
      // if (agentCheckIn) {
      //   await tx
      //     .update(checkedInAgents)
      //     .set({
      //       current_lead_count: sql`${checkedInAgents.current_lead_count} + 1`,
      //       last_assigned_at: new Date(),
      //       updated_at: new Date()
      //     })
      //     .where(eq(checkedInAgents.id, agentCheckIn.id));
      // }

      // Record assignment history
      await tx.insert(leadAssignmentHistory).values({
        lead_id: leadId,
        assigned_to: agentId,
        assignment_method: 'manual',
        assignment_reason: `Manually assigned by user ${userId}`,
        assigned_at: new Date()
      });
    });

    const agentName = `${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim() || 'Unknown';
    const leadName = lead.full_name ?? 'Unknown Lead';

    return {
      success: true,
      message: `Successfully assigned "${leadName}" to ${agentName}`,
      assignedTo: agentId,
      agentName,
      leadName,
      assignmentMethod: 'manual'
    };
  } catch (error) {
    console.error("Error assigning lead to agent:", error);
    return {
      success: false,
      message: "Failed to assign lead to agent"
    };
  }
} 