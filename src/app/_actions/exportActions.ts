"use server";

import { db } from "~/server/db";
import { leads, users } from "~/server/db/schema";
import { desc, asc, sql, eq, inArray } from "drizzle-orm";
import { type InferSelectModel } from 'drizzle-orm';

type Lead = InferSelectModel<typeof leads>;

interface LeadWithAgent extends Lead {
  assigned_user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface CSVData {
  agentName: string;
  csvData: string;
}

interface ExportResult {
  success: boolean;
  error?: string;
  csvDataByStatusAndAgent?: Record<string, Record<string, CSVData>>;
  totalExported?: number;
  statusAgentCounts?: Record<string, Record<string, number>>;
  agentNames?: Record<string, string>;
}

export async function exportAllLeadsToCSV(selectedStatuses: string[] = []): Promise<ExportResult> {
  try {
    // Fetch leads with assigned user information
    let allLeads: LeadWithAgent[] = [];
    
    if (selectedStatuses.length > 0) {
      allLeads = await db.query.leads.findMany({
        where: inArray(leads.status, selectedStatuses),
        orderBy: [desc(leads.created_at)],
        with: {
          assigned_user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });
    } else {
      allLeads = await db.query.leads.findMany({
        orderBy: [desc(leads.created_at)],
        with: {
          assigned_user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });
    }

    if (!allLeads || allLeads.length === 0) {
      return {
        success: false,
        error: "No leads found to export",
      };
    }

    // Group leads by status and assigned agent
    const leadsByStatusAndAgent: Record<string, Record<string, LeadWithAgent[]>> = {};
    const agentNames: Record<string, string> = {};
    
    // Initialize the structure for each status
    selectedStatuses.forEach(status => {
      leadsByStatusAndAgent[status] = {};
    });
    
    // Group leads by status and agent
    allLeads.forEach(lead => {
      if (!lead.status || !selectedStatuses.includes(lead.status)) return;
      
      const agentId = lead.assigned_to || 'unassigned';
      const agentName = lead.assigned_user 
        ? `${lead.assigned_user.firstName || ''} ${lead.assigned_user.lastName || ''}`.trim() || 'Unknown'
        : 'Unassigned';
      
      // Store agent name for later use
      agentNames[agentId] = agentName;
      
      // Initialize agent group if it doesn't exist
      leadsByStatusAndAgent[lead.status][agentId] ??= [];
      
      // Add lead to appropriate group
      leadsByStatusAndAgent[lead.status][agentId].push(lead);
    });

    // Define CSV columns
    const columns = [
      "firstName",
      "lastName",
      "email",
      "personalPhone"
    ];

    // Create CSV header row
    const csvHeader = columns.join(",");

    // Generate CSV data for each status and agent combination
    const csvDataByStatusAndAgent: Record<string, Record<string, CSVData>> = {};
    const statusAgentCounts: Record<string, Record<string, number>> = {};
    
    for (const [status, agentGroups] of Object.entries(leadsByStatusAndAgent)) {
      csvDataByStatusAndAgent[status] = {};
      statusAgentCounts[status] = {};
      
      for (const [agentId, agentLeads] of Object.entries(agentGroups)) {
        if (agentLeads.length === 0) continue;
        
        // Map leads to CSV rows
        const csvRows = agentLeads.map(lead => {
          return columns.map(column => {
            let value = "";
            
            if (column === "firstName") {
              value = "AirConnect";
            } else if (column === "lastName") {
              value = lead.full_name ?? "AirConnect";
            } else if (column === "personalPhone") {
              const phoneNumber = lead.phone_number || "";
              value = phoneNumber.startsWith("+65") ? phoneNumber.substring(1) : phoneNumber;
            } else if (column === "email") {
              value = lead.email !== null && lead.email !== "UNKNOWN" 
                ? lead.email 
                : `notimportant${lead.phone_number}@test.com`;
            } else if (lead[column as keyof typeof lead] !== undefined) {
              value = String(lead[column as keyof typeof lead] ?? "");
            }
            
            if (value.includes(",") || value.includes("\"")) {
              value = `"${value.replace(/"/g, '""')}"`;
            }
            
            return value;
          }).join(",");
        });

        // Store CSV data with agent name
        const agentName = agentNames[agentId];
        csvDataByStatusAndAgent[status][agentId] = {
          agentName,
          csvData: [csvHeader, ...csvRows].join("\n")
        };
        
        // Store counts
        statusAgentCounts[status][agentId] = agentLeads.length;
      }
    }

    return {
      success: true,
      csvDataByStatusAndAgent,
      totalExported: allLeads.length,
      statusAgentCounts,
      agentNames
    };
  } catch (error) {
    console.error("Error exporting leads to CSV:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
} 