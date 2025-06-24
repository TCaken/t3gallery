"use server";

import { db } from "~/server/db";
import { leads, users } from "~/server/db/schema";
import { desc, asc, sql, eq, inArray } from "drizzle-orm";
import { type InferSelectModel } from 'drizzle-orm';

type Lead = InferSelectModel<typeof leads>;
type User = InferSelectModel<typeof users>;

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
    // Fetch leads with a manual join to users table
    let allLeads: LeadWithAgent[] = [];
    console.log(selectedStatuses);
    
    if (selectedStatuses.length > 0) {
      // Manual join query
      const leadsWithUsers = await db
        .select({
          // Lead fields
          id: leads.id,
          phone_number: leads.phone_number,
          phone_number_2: leads.phone_number_2,
          phone_number_3: leads.phone_number_3,
          full_name: leads.full_name,
          email: leads.email,
          residential_status: leads.residential_status,
          has_work_pass_expiry: leads.has_work_pass_expiry,
          has_payslip_3months: leads.has_payslip_3months,
          has_proof_of_residence: leads.has_proof_of_residence,
          proof_of_residence_type: leads.proof_of_residence_type,
          has_letter_of_consent: leads.has_letter_of_consent,
          employment_status: leads.employment_status,
          employment_salary: leads.employment_salary,
          employment_length: leads.employment_length,
          amount: leads.amount,
          loan_purpose: leads.loan_purpose,
          existing_loans: leads.existing_loans,
          outstanding_loan_amount: leads.outstanding_loan_amount,
          status: leads.status,
          source: leads.source,
          assigned_to: leads.assigned_to,
          lead_type: leads.lead_type,
          eligibility_checked: leads.eligibility_checked,
          eligibility_status: leads.eligibility_status,
          eligibility_notes: leads.eligibility_notes,
          lead_score: leads.lead_score,
          contact_preference: leads.contact_preference,
          communication_language: leads.communication_language,
          follow_up_date: leads.follow_up_date,
          created_at: leads.created_at,
          updated_at: leads.updated_at,
          created_by: leads.created_by,
          updated_by: leads.updated_by,
          is_contactable: leads.is_contactable,
          is_deleted: leads.is_deleted,
          // User fields
          user_id: users.id,
          user_first_name: users.first_name,
          user_last_name: users.last_name,
        })
        .from(leads)
        .leftJoin(users, eq(leads.assigned_to, users.id))
        .where(inArray(leads.status, selectedStatuses))
        .orderBy(desc(leads.created_at));

      // Transform the result to match LeadWithAgent interface
      allLeads = leadsWithUsers.map(row => ({
        id: row.id,
        phone_number: row.phone_number,
        phone_number_2: row.phone_number_2,
        phone_number_3: row.phone_number_3,
        full_name: row.full_name,
        email: row.email,
        residential_status: row.residential_status,
        has_work_pass_expiry: row.has_work_pass_expiry,
        has_payslip_3months: row.has_payslip_3months,
        has_proof_of_residence: row.has_proof_of_residence,
        proof_of_residence_type: row.proof_of_residence_type,
        has_letter_of_consent: row.has_letter_of_consent,
        employment_status: row.employment_status,
        employment_salary: row.employment_salary,
        employment_length: row.employment_length,
        amount: row.amount,
        loan_purpose: row.loan_purpose,
        existing_loans: row.existing_loans,
        outstanding_loan_amount: row.outstanding_loan_amount,
        status: row.status,
        source: row.source,
        assigned_to: row.assigned_to,
        lead_type: row.lead_type,
        eligibility_checked: row.eligibility_checked,
        eligibility_status: row.eligibility_status,
        eligibility_notes: row.eligibility_notes,
        lead_score: row.lead_score,
        contact_preference: row.contact_preference,
        communication_language: row.communication_language,
        follow_up_date: row.follow_up_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
        updated_by: row.updated_by,
        is_contactable: row.is_contactable,
        is_deleted: row.is_deleted,
        assigned_user: row.user_id ? {
          id: row.user_id,
          firstName: row.user_first_name,
          lastName: row.user_last_name,
        } : null,
      }));
    } else {
      // Same query but without where clause
      const leadsWithUsers = await db
        .select({
          // Lead fields
          id: leads.id,
          phone_number: leads.phone_number,
          phone_number_2: leads.phone_number_2,
          phone_number_3: leads.phone_number_3,
          full_name: leads.full_name,
          email: leads.email,
          residential_status: leads.residential_status,
          has_work_pass_expiry: leads.has_work_pass_expiry,
          has_payslip_3months: leads.has_payslip_3months,
          has_proof_of_residence: leads.has_proof_of_residence,
          proof_of_residence_type: leads.proof_of_residence_type,
          has_letter_of_consent: leads.has_letter_of_consent,
          employment_status: leads.employment_status,
          employment_salary: leads.employment_salary,
          employment_length: leads.employment_length,
          amount: leads.amount,
          loan_purpose: leads.loan_purpose,
          existing_loans: leads.existing_loans,
          outstanding_loan_amount: leads.outstanding_loan_amount,
          status: leads.status,
          source: leads.source,
          assigned_to: leads.assigned_to,
          lead_type: leads.lead_type,
          eligibility_checked: leads.eligibility_checked,
          eligibility_status: leads.eligibility_status,
          eligibility_notes: leads.eligibility_notes,
          lead_score: leads.lead_score,
          contact_preference: leads.contact_preference,
          communication_language: leads.communication_language,
          follow_up_date: leads.follow_up_date,
          created_at: leads.created_at,
          updated_at: leads.updated_at,
          created_by: leads.created_by,
          updated_by: leads.updated_by,
          is_contactable: leads.is_contactable,
          is_deleted: leads.is_deleted,
          // User fields
          user_id: users.id,
          user_first_name: users.first_name,
          user_last_name: users.last_name,
        })
        .from(leads)
        .leftJoin(users, eq(leads.assigned_to, users.id))
        .orderBy(desc(leads.created_at));

      // Transform the result to match LeadWithAgent interface
      allLeads = leadsWithUsers.map(row => ({
        id: row.id,
        phone_number: row.phone_number,
        phone_number_2: row.phone_number_2,
        phone_number_3: row.phone_number_3,
        full_name: row.full_name,
        email: row.email,
        residential_status: row.residential_status,
        has_work_pass_expiry: row.has_work_pass_expiry,
        has_payslip_3months: row.has_payslip_3months,
        has_proof_of_residence: row.has_proof_of_residence,
        proof_of_residence_type: row.proof_of_residence_type,
        has_letter_of_consent: row.has_letter_of_consent,
        employment_status: row.employment_status,
        employment_salary: row.employment_salary,
        employment_length: row.employment_length,
        amount: row.amount,
        loan_purpose: row.loan_purpose,
        existing_loans: row.existing_loans,
        outstanding_loan_amount: row.outstanding_loan_amount,
        status: row.status,
        source: row.source,
        assigned_to: row.assigned_to,
        lead_type: row.lead_type,
        eligibility_checked: row.eligibility_checked,
        eligibility_status: row.eligibility_status,
        eligibility_notes: row.eligibility_notes,
        lead_score: row.lead_score,
        contact_preference: row.contact_preference,
        communication_language: row.communication_language,
        follow_up_date: row.follow_up_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
        updated_by: row.updated_by,
        is_contactable: row.is_contactable,
        is_deleted: row.is_deleted,
        assigned_user: row.user_id ? {
          id: row.user_id,
          firstName: row.user_first_name,
          lastName: row.user_last_name,
        } : null,
      }));
    }

    if (!allLeads || allLeads.length === 0) {
      return {
        success: false,
        error: "No leads found to export",
      };
    }
    console.log(allLeads);

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
      
      // Special handling for follow_up status - check follow_up_date
      if (lead.status === 'follow_up') {
        if (!lead.follow_up_date) {
          console.log(`Lead ${lead.id}: No follow_up_date, skipping`);
          return;
        }
        
        // Convert GMT to SGT (GMT+8)
        const followUpDateGMT = new Date(lead.follow_up_date);
        const followUpDateSGT = new Date(followUpDateGMT.getTime() + (8 * 60 * 60 * 1000));
        
        // Get today's date in SGT
        const nowSGT = new Date(new Date().getTime() + (8 * 60 * 60 * 1000));
        const todaySGT = new Date(nowSGT.getFullYear(), nowSGT.getMonth(), nowSGT.getDate());
        const followUpDateOnly = new Date(followUpDateSGT.getFullYear(), followUpDateSGT.getMonth(), followUpDateSGT.getDate());
        
        console.log(`Lead ${lead.id}: Follow-up date GMT: ${followUpDateGMT.toISOString()}`);
        console.log(`Lead ${lead.id}: Follow-up date SGT: ${followUpDateSGT.toISOString()}`);
        console.log(`Lead ${lead.id}: Today SGT: ${todaySGT.toISOString()}`);
        console.log(`Lead ${lead.id}: Follow-up date only: ${followUpDateOnly.toISOString()}`);
        console.log(`Lead ${lead.id}: SGT Hours: ${followUpDateSGT.getHours()}, Minutes: ${followUpDateSGT.getMinutes()}`);
        
        // Check if time is 00:00 (midnight)
        const isAtMidnight = followUpDateSGT.getHours() === 0 && followUpDateSGT.getMinutes() === 0;
        
        // Check if follow-up date is today or in the past (not future)
        const isNotFutureDate = followUpDateOnly <= todaySGT;
        
        if (!isAtMidnight) {
          console.log(`Lead ${lead.id}: Follow-up time is not 00:00 SGT, skipping export`);
          return;
        }
        
        if (!isNotFutureDate) {
          console.log(`Lead ${lead.id}: Follow-up date is in the future, skipping export`);
          return;
        }
        
        console.log(`Lead ${lead.id}: Follow-up time is 00:00 SGT and date is today or past, including in export`);
      }
      
      const agentId = lead.assigned_to ?? 'unassigned';
      const agentName = lead.assigned_user 
        ? `${lead.assigned_user.firstName ?? ''} ${lead.assigned_user.lastName ?? ''}`.trim() || 'Unknown'
        : 'Unassigned';
      
      // Store agent name for later use
      agentNames[agentId] = agentName;
      
      // Initialize agent group if it doesn't exist
      leadsByStatusAndAgent[lead.status] ??= {};
      leadsByStatusAndAgent[lead.status]![agentId] ??= [];
      
      // Add lead to appropriate group
      leadsByStatusAndAgent[lead.status]![agentId]!.push(lead);
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
            } else {
              // Handle other columns safely
              // const leadValue = lead[column as keyof typeof lead];
              // if (leadValue !== undefined && leadValue !== null && typeof leadValue !== 'object') {
              //   value = String(leadValue);
              // }
            }
            
            if (value.includes(",") || value.includes("\"")) {
              value = `"${value.replace(/"/g, '""')}"`;
            }
            
            return value;
          }).join(",");
        });

        // Store CSV data with agent name
        const agentName = agentNames[agentId];
        if (agentName) {
          csvDataByStatusAndAgent[status][agentId] = {
            agentName,
            csvData: [csvHeader, ...csvRows].join("\n")
          };
          
          // Store counts
          statusAgentCounts[status][agentId] = agentLeads.length;
        }
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