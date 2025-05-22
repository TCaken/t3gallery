"use server";

import { db } from "~/server/db";
import { leads } from "~/server/db/schema";
import { desc, asc, sql, eq, inArray } from "drizzle-orm";

export async function exportAllLeadsToCSV(selectedStatuses: string[] = []) {
  try {
    // Prepare the query based on selected statuses
    let allLeads = [];
    
    if (selectedStatuses.length > 0) {
      // Fetch leads with the selected statuses
      allLeads = await db.query.leads.findMany({
        where: inArray(leads.status, selectedStatuses),
        orderBy: [desc(leads.created_at)],
        with: {
          // Include any relations you might need, like assigned agent, etc.
        },
      });
    } else {
      // Fetch all leads if no statuses are selected
      allLeads = await db.query.leads.findMany({
        orderBy: [desc(leads.created_at)],
        with: {
          // Include any relations you might need, like assigned agent, etc.
        },
      });
    }

    // If no leads found, return an error
    if (!allLeads || allLeads.length === 0) {
      return {
        success: false,
        error: "No leads found to export",
        csvData: null,
      };
    }

    // Group leads by status for separate exports
    const leadsByStatus: Record<string, typeof allLeads> = {};
    
    if (selectedStatuses.length > 0) {
      // Initialize empty arrays for each selected status
      selectedStatuses.forEach(status => {
        leadsByStatus[status] = [];
      });
      
      // Group leads by status
      allLeads.forEach(lead => {
        if (lead.status && selectedStatuses.includes(lead.status)) {
          // Use optional chaining to safely access and update
          leadsByStatus[lead.status]?.push(lead);
        }
      });
    } else {
      // Create a single group with all leads
      leadsByStatus.all = allLeads;
    }

    // Define the columns for the CSV based on the provided fields
    const columns = [
      "firstName",
      "lastName",
      "email",
      "personalPhone"
    ];

    // Create CSV header row
    const csvHeader = columns.join(",");

    // Generate CSV data for each status group
    const csvDataByStatus: Record<string, string> = {};
    
    for (const [status, statusLeads] of Object.entries(leadsByStatus)) {
      if (statusLeads.length === 0) continue;
      
      // Map leads to CSV rows
      const csvRows = statusLeads.map(lead => {
        // Map each lead to the columns
        return columns.map(column => {
          // Get the value for the current column
          let value = "";
          
          // Special handling for name fields (split from full_name)
          if (column === "firstName") {
            // value = lead.full_name ? lead.full_name.split(" ")[0] ?? "" : "";
            value = "AirConnect"
          } else if (column === "lastName") {
            value = lead.full_name ?? "AirConnect";
          } else if (column === "personalPhone") {
            // Remove "65" prefix if it exists and format the phone number
            const phoneNumber = lead.phone_number || "";
            value = phoneNumber.startsWith("+65") ? phoneNumber.substring(1) : phoneNumber
            // value = lead.phone_number || "";
          } else if (column === "email") {
            value = lead.email !== null && lead.email !== "UNKNOWN" ? lead.email : `notimportant${lead.phone_number}@test.com`;
          } else if (lead[column as keyof typeof lead] !== undefined) {
            value = String(lead[column as keyof typeof lead] ?? "");
          }
          
          // Escape quotes and wrap values with commas in double quotes
          if (value.includes(",") || value.includes("\"")) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          
          return value;
        }).join(",");
      });

      // Combine header and rows
      csvDataByStatus[status] = [csvHeader, ...csvRows].join("\n");
    }

    return {
      success: true,
      csvDataByStatus,
      totalExported: allLeads.length,
      statusCounts: Object.fromEntries(
        Object.entries(leadsByStatus).map(([status, leads]) => [status, leads.length])
      ),
    };
  } catch (error) {
    console.error("Error exporting leads to CSV:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
      csvData: null,
    };
  }
} 