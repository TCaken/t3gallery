"use server";

import { db } from "~/server/db";
import { checkedInAgents, leads, users } from "~/server/db/schema";
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { desc, gte, lte } from "drizzle-orm/expressions";

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

// Get assignment preview (how many leads would be assigned to each agent)
export async function getAssignmentPreview() {
  try {
    // Using raw SQL to get checked-in agents with their user details
    const checkedInAgentsResult = await db.query.checkedInAgents.findMany({
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
      }
    });
    
    console.log('Checked-in agents result:', checkedInAgentsResult);

    // Get unassigned leads count
    const unassignedLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(
        eq(leads.status, 'new'),
        isNull(leads.assigned_to)
      ));
    
    const unassignedLeadsCount = unassignedLeadsResult[0]?.count ?? 0;
    console.log('Found unassigned leads:', unassignedLeadsCount);
    
    // Calculate leads per agent
    const leadsPerAgent = Math.floor(unassignedLeadsCount / Math.max(checkedInAgentsResult.length, 1));
    const remainder = unassignedLeadsCount % Math.max(checkedInAgentsResult.length, 1);
    
    // Create preview data
    const preview = checkedInAgentsResult.map((agentRecord, index) => {
      const agent = agentRecord.agent;
      const firstName = agent?.first_name ?? '';
      const lastName = agent?.last_name ?? '';
      const agentName = `${firstName} ${lastName}`.trim() || 'Unknown';
      
      return {
        agentId: agentRecord.agent_id,
        agentName,
        leadCount: index < remainder ? leadsPerAgent + 1 : leadsPerAgent
      };
    });
    
    return { 
      success: true, 
      preview,
      totalAgents: checkedInAgentsResult.length,
      totalLeads: unassignedLeadsCount
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

// Manually assign a lead to an agent
export async function assignLeadToAgent(leadId: number, agentId: string) {
  try {
    const { userId } = await auth();
    
    // Verify admin permissions
    // In a real app, you'd check permissions here
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    // Update lead assignment
    await db
      .update(leads)
      .set({ 
        assigned_to: agentId,
        status: 'assigned',  // Change status from new to assigned
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(leads.id, leadId));
    
    return { 
      success: true, 
      message: "Lead successfully assigned" 
    };
  } catch (error) {
    console.error("Error assigning lead:", error);
    return { success: false, message: "Failed to assign lead" };
  }
} 