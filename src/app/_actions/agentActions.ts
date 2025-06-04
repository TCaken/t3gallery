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

// Auto-assign leads to checked-in agents
export async function autoAssignLeads() {
  try {
    const { userId } = await auth();
    
    // Verify admin permissions
    // In a real app, you'd check permissions here
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Get all checked-in agents
    const checkedInAgentsList = await db.query.checkedInAgents.findMany({
      where: and(
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true)
      ),
      with: {
        agent: true
      }
    });
    console.log('Checked in agents list:', checkedInAgentsList);
    
    if (checkedInAgentsList.length === 0) {
      return { 
        success: false, 
        message: "No agents are checked in today" 
      };
    }

    // Get new unassigned leads
    const unassignedLeads = await db.query.leads.findMany({
      where: and(
        eq(leads.status, 'new'),
        isNull(leads.assigned_to)
      )
    });

    if (unassignedLeads.length === 0) {
      return { 
        success: false, 
        message: "No new unassigned leads available" 
      };
    }

    // Calculate leads per agent
    const leadsPerAgent = Math.floor(unassignedLeads.length / checkedInAgentsList.length);
    const remainder = unassignedLeads.length % checkedInAgentsList.length;
    
    let assignedCount = 0;
    
    // Assign leads evenly to each agent
    for (let i = 0; i < checkedInAgentsList.length; i++) {
      const agent = checkedInAgentsList[i];
      if (!agent) continue;
      
      const agentLeadCount = i < remainder ? leadsPerAgent + 1 : leadsPerAgent;
      
      if (agentLeadCount === 0) continue;
      
      // Get leads for this agent
      const agentLeads = unassignedLeads.slice(
        assignedCount, 
        assignedCount + agentLeadCount
      );
      
      // Update lead assignments
      for (const lead of agentLeads) {
        await db
          .update(leads)
          .set({ 
            assigned_to: agent.agent_id,
            status: 'assigned',  // Change status from new to assigned
            updated_at: new Date(),
            updated_by: userId
          })
          .where(eq(leads.id, lead.id));
      }
      
      assignedCount += agentLeadCount;
    }

    return { 
      success: true, 
      message: `Successfully assigned ${assignedCount} leads to ${checkedInAgentsList.length} agents` 
    };
  } catch (error) {
    console.error("Error auto-assigning leads:", error);
    return { success: false, message: "Failed to auto-assign leads" };
  }
}

// Get auto-assignment settings
export async function getAutoAssignmentSettings() {
  try {
    const settings = await db.query.autoAssignmentSettings.findFirst({
      orderBy: [desc(autoAssignmentSettings.id)]
    });
    
    if (!settings) {
      // Create default settings if none exist
      const defaultSettings = await db.insert(autoAssignmentSettings).values({
        is_enabled: false,
        assignment_method: 'round_robin',
        current_round_robin_index: 0,
        max_leads_per_agent_per_day: 20
      }).returning();
      
      return {
        success: true,
        settings: defaultSettings[0]
      };
    }
    
    return {
      success: true,
      settings
    };
  } catch (error) {
    console.error("Error getting auto-assignment settings:", error);
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
      return { success: false, message: "Not authenticated" };
    }

    const currentSettings = await getAutoAssignmentSettings();
    if (!currentSettings.success || !currentSettings.settings) {
      return { success: false, message: "Could not get current settings" };
    }

    const updatedSettings = await db
      .update(autoAssignmentSettings)
      .set({
        ...settingsData,
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(autoAssignmentSettings.id, currentSettings.settings.id))
      .returning();

    return {
      success: true,
      settings: updatedSettings[0],
      message: "Auto-assignment settings updated successfully"
    };
  } catch (error) {
    console.error("Error updating auto-assignment settings:", error);
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
    // Check if auto-assignment is enabled
    const settingsResult = await getAutoAssignmentSettings();
    if (!settingsResult.success || !settingsResult.settings?.is_enabled) {
      return {
        success: false,
        message: "Auto-assignment is not enabled"
      };
    }

    const settings = settingsResult.settings;

    // Get available agents in round-robin order
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
        message: "No available agents to assign lead"
      };
    }

    // Find the next agent in round-robin
    let nextAgentIndex = settings.current_round_robin_index % availableAgents.length;
    const selectedAgent = availableAgents[nextAgentIndex];

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

      // Update round-robin index
      const newIndex = (nextAgentIndex + 1) % availableAgents.length;
      await tx
        .update(autoAssignmentSettings)
        .set({
          current_round_robin_index: newIndex,
          last_assigned_agent_id: selectedAgent.agent_id,
          updated_at: new Date()
        })
        .where(eq(autoAssignmentSettings.id, settings.id));

      // Record assignment history
      await tx.insert(leadAssignmentHistory).values({
        lead_id: leadId,
        assigned_to: selectedAgent.agent_id,
        assignment_method: 'auto_round_robin',
        assignment_reason: `Auto-assigned via round-robin (index: ${nextAgentIndex})`,
        assigned_at: new Date()
      });
    });

    const agentName = `${selectedAgent.agent?.first_name ?? ''} ${selectedAgent.agent?.last_name ?? ''}`.trim() || 'Unknown';

    return {
      success: true,
      message: `Lead automatically assigned to ${agentName}`,
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

// Bulk auto-assign leads with round-robin
export async function bulkAutoAssignLeads() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Get assignment preview first
    const previewResult = await getAssignmentPreviewWithRoundRobin();
    if (!previewResult.success) {
      return {
        success: false,
        message: previewResult.message || "Failed to get assignment preview"
      };
    }

    if (previewResult.totalLeads === 0) {
      return {
        success: false,
        message: "No unassigned leads available"
      };
    }

    // Get unassigned leads
    const unassignedLeads = await db.query.leads.findMany({
      where: and(
        eq(leads.status, 'new'),
        isNull(leads.assigned_to)
      ),
      orderBy: [asc(leads.created_at)] // First in, first assigned
    });

    let assignedCount = 0;
    const assignments: Array<{leadId: number, agentId: string, agentName: string}> = [];

    // Process each lead
    for (const lead of unassignedLeads) {
      const assignResult = await autoAssignSingleLead(lead.id);
      if (assignResult.success) {
        assignedCount++;
        assignments.push({
          leadId: lead.id,
          agentId: assignResult.assignedTo!,
          agentName: assignResult.agentName!
        });
      }
    }

    return {
      success: true,
      message: `Successfully assigned ${assignedCount} leads`,
      assignedCount,
      assignments,
      totalLeads: unassignedLeads.length
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
export async function updateAgentCapacity(agentId: string, capacity: number, weight: number = 1) {
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