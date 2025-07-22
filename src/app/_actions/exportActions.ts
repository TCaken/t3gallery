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
          // console.log("Lead", JSON.stringify(lead));
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
              value = lead.email !== null && lead.email !== "UNKNOWN" && lead.email !== ""
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

// PII Censoring utility functions
function censorName(name: string | null): string {
  if (!name || name.trim() === '') return 'N/A';
  
  const trimmedName = name.trim();
  if (trimmedName.length <= 3) {
    return trimmedName.charAt(0) + '*'.repeat(trimmedName.length - 1);
  }
  
  const firstTwo = trimmedName.substring(0, 2);
  const lastTwo = trimmedName.substring(trimmedName.length - 2);
  const middleLength = Math.max(0, trimmedName.length - 4);
  
  return firstTwo + '*'.repeat(middleLength) + lastTwo;
}

function censorPhoneNumber(phone: string | null): string {
  if (!phone || phone.trim() === '') return 'N/A';
  
  const trimmedPhone = phone.trim();
  if (trimmedPhone.length <= 5) {
    return '*'.repeat(trimmedPhone.length);
  }
  
  const lastFive = trimmedPhone.substring(trimmedPhone.length - 5);
  const hiddenLength = trimmedPhone.length - 5;
  
  return '*'.repeat(hiddenLength) + lastFive;
}

function censorEmail(email: string | null): string {
  if (!email || email.trim() === '' || email === 'UNKNOWN') return 'N/A';
  
  const trimmedEmail = email.trim();
  const atIndex = trimmedEmail.indexOf('@');
  
  if (atIndex <= 0) return 'N/A';
  
  const localPart = trimmedEmail.substring(0, atIndex);
  const domainPart = trimmedEmail.substring(atIndex);
  
  if (localPart.length <= 2) {
    return '*'.repeat(localPart.length) + domainPart;
  }
  
  const firstChar = localPart.charAt(0);
  const lastChar = localPart.charAt(localPart.length - 1);
  const middleLength = localPart.length - 2;
  
  return firstChar + '*'.repeat(middleLength) + lastChar + domainPart;
}

function censorAmount(amount: string | null): string {
  if (!amount || amount.trim() === '') return 'N/A';
  
  // For amounts, just show ranges instead of exact values
  const numericAmount = parseFloat(amount.replace(/[^\d.]/g, ''));
  
  if (isNaN(numericAmount)) return 'N/A';
  
  if (numericAmount < 5000) return '<5K';
  if (numericAmount < 10000) return '5K-10K';
  if (numericAmount < 20000) return '10K-20K';
  if (numericAmount < 50000) return '20K-50K';
  return '>50K';
}

// Type for censored export data
interface CensoredLeadData {
  id: number;
  censoredName: string;
  censoredEmail: string;
  censoredPhone: string;
  status: string;
  source: string;
  amount: string | null;
  createdAt: string;
  assignedAgent: string;
  eligibilityStatus: string | null;
  leadScore: number | null;
}

// Export all leads with PII censoring for webhook upload
export async function exportLeadsWithPIICensoring(
  selectedStatuses: string[] = [],
  webhookUrl?: string
): Promise<{
  success: boolean;
  error?: string;
  data?: CensoredLeadData[];
  totalExported?: number;
  webhookResponse?: any;
}> {
  try {
    // Fetch leads with manual join to users table (similar to existing function)
    let allLeads: LeadWithAgent[] = [];
    
    if (selectedStatuses.length > 0) {
      const leadsWithUsers = await db
        .select({
          // Lead fields
          id: leads.id,
          phone_number: leads.phone_number,
          phone_number_2: leads.phone_number_2,
          phone_number_3: leads.phone_number_3,
          full_name: leads.full_name,
          email: leads.email,
          amount: leads.amount,
          status: leads.status,
          source: leads.source,
          assigned_to: leads.assigned_to,
          eligibility_status: leads.eligibility_status,
          lead_score: leads.lead_score,
          created_at: leads.created_at,
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
        amount: row.amount,
        status: row.status,
        source: row.source,
        assigned_to: row.assigned_to,
        eligibility_status: row.eligibility_status,
        lead_score: row.lead_score,
        created_at: row.created_at,
        assigned_user: row.user_id ? {
          id: row.user_id,
          firstName: row.user_first_name,
          lastName: row.user_last_name,
        } : null,
      })) as LeadWithAgent[];
    } else {
      // Fetch all leads if no status filter
      const leadsWithUsers = await db
        .select({
          // Lead fields
          id: leads.id,
          phone_number: leads.phone_number,
          phone_number_2: leads.phone_number_2,
          phone_number_3: leads.phone_number_3,
          full_name: leads.full_name,
          email: leads.email,
          amount: leads.amount,
          status: leads.status,
          source: leads.source,
          assigned_to: leads.assigned_to,
          eligibility_status: leads.eligibility_status,
          lead_score: leads.lead_score,
          created_at: leads.created_at,
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
        amount: row.amount,
        status: row.status,
        source: row.source,
        assigned_to: row.assigned_to,
        eligibility_status: row.eligibility_status,
        lead_score: row.lead_score,
        created_at: row.created_at,
        assigned_user: row.user_id ? {
          id: row.user_id,
          firstName: row.user_first_name,
          lastName: row.user_last_name,
        } : null,
      })) as LeadWithAgent[];
    }

    if (!allLeads || allLeads.length === 0) {
      return {
        success: false,
        error: "No leads found to export",
      };
    }

    // Process leads with PII censoring
    const censoredData: CensoredLeadData[] = allLeads.map(lead => ({
      id: lead.id,
      censoredName: censorName(lead.full_name),
      censoredEmail: censorEmail(lead.email),
      censoredPhone: censorPhoneNumber(lead.phone_number),
      status: lead.status ?? 'unknown',
      source: lead.source ?? 'unknown',
      amount: lead.amount ?? null,
      createdAt: lead.created_at ? new Date(lead.created_at).toISOString() : 'unknown',
      assignedAgent: lead.assigned_user 
        ? `${lead.assigned_user.firstName ?? ''} ${lead.assigned_user.lastName ?? ''}`.trim() || 'Unknown'
        : 'Unassigned',
      eligibilityStatus: lead.eligibility_status ?? null,
      leadScore: lead.lead_score ?? null,
    }));

    // If webhook URL is provided, send data to webhook
    let webhookResponse = null;
    if (webhookUrl && webhookUrl.trim() !== '') {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            export_timestamp: new Date().toISOString(),
            total_leads: censoredData.length,
            leads: censoredData,
            export_type: 'pii_censored',
            statuses_exported: selectedStatuses.length > 0 ? selectedStatuses : ['all'],
          }),
        });

        if (!response.ok) {
          console.error('Webhook response not OK:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('Webhook error response:', errorText);
          
          return {
            success: false,
            error: `Webhook failed: ${response.status} ${response.statusText}`,
          };
        }

        webhookResponse = await response.json();
        console.log('Webhook sent successfully:', webhookResponse);
      } catch (webhookError) {
        console.error('Error sending to webhook:', webhookError);
        return {
          success: false,
          error: `Webhook error: ${webhookError instanceof Error ? webhookError.message : 'Unknown error'}`,
        };
      }
    }

    return {
      success: true,
      data: censoredData,
      totalExported: censoredData.length,
      webhookResponse,
    };
  } catch (error) {
    console.error("Error exporting leads with PII censoring:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
} 

// Interface for censored export lead data
interface CensoredExportLead {
  id: number;
  phone_number: string;
  phone_number_2: string | null;
  phone_number_3: string | null;
  full_name: string | null;
  email: string | null;
  residential_status: string | null;
  has_work_pass_expiry: string | null;
  has_payslip_3months: boolean | null;
  has_proof_of_residence: boolean | null;
  proof_of_residence_type: string | null;
  has_letter_of_consent: boolean | null;
  employment_status: string | null;
  employment_salary: string | null;
  employment_length: string | null;
  amount: string | null;
  loan_purpose: string | null;
  existing_loans: string | null;
  outstanding_loan_amount: string | null;
  status: string;
  source: string | null;
  assigned_to: string | null;
  lead_type: string | null;
  eligibility_checked: boolean | null;
  eligibility_status: string | null;
  eligibility_notes: string | null;
  loan_status: string | null;
  loan_notes: string | null;
  lead_score: number | null;
  contact_preference: string | null;
  communication_language: string | null;
  follow_up_date: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  is_contactable: boolean | null;
  is_deleted: boolean | null;
  has_exported: boolean | null;
  exported_at: Date | null;
  assigned_user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

// New function to export PII-censored lead data to Excel and upload to webhook
export async function exportCensoredLeadsToExcel(selectedStatuses: string[] = []): Promise<{
  success: boolean;
  error?: string;
  totalExported?: number;
  webhookResponse?: any;
}> {
  try {
    // Fetch leads data (similar to existing function)
    let allLeads: CensoredExportLead[] = [];
    
    if (selectedStatuses.length > 0) {
      const leadsWithUsers = await db
        .select({
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
          loan_status: leads.loan_status,
          loan_notes: leads.loan_notes,
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
          has_exported: leads.has_exported,
          exported_at: leads.exported_at,
          user_id: users.id,
          user_first_name: users.first_name,
          user_last_name: users.last_name,
        })
        .from(leads)
        .leftJoin(users, eq(leads.assigned_to, users.id))
        .where(inArray(leads.status, selectedStatuses))
        .orderBy(desc(leads.created_at));

             // Transform the result
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
         loan_status: row.loan_status,
         loan_notes: row.loan_notes,
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
         has_exported: row.has_exported,
         exported_at: row.exported_at,
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

    // Create censored data for each lead
    const censoredLeads = allLeads.map(lead => ({
      id: lead.id,
      full_name_censored: censorName(lead.full_name),
      phone_number_censored: censorPhoneNumber(lead.phone_number),
      email_censored: censorEmail(lead.email),
      amount_range: censorAmount(lead.amount),
      status: lead.status,
      source: lead.source,
      eligibility_status: lead.eligibility_status,
      employment_status: lead.employment_status,
      loan_purpose: lead.loan_purpose,
      contact_preference: lead.contact_preference,
      communication_language: lead.communication_language,
      assigned_agent: lead.assigned_user 
        ? `${lead.assigned_user.firstName ?? ''} ${lead.assigned_user.lastName ?? ''}`.trim() || 'Unknown'
        : 'Unassigned',
      created_at: lead.created_at?.toISOString().split('T')[0], // YYYY-MM-DD format
      updated_at: lead.updated_at?.toISOString().split('T')[0], // YYYY-MM-DD format
    }));

    // Prepare data for webhook
    const webhookPayload = {
      export_type: 'leads_censored',
      export_timestamp: new Date().toISOString(),
      total_leads: censoredLeads.length,
      statuses_exported: selectedStatuses,
      leads: censoredLeads
    };

    // Upload to webhook
    const webhookUrl = process.env.LEAD_EXPORT_WEBHOOK_URL || process.env.WHATSAPP_API_URL;
    
    if (!webhookUrl) {
      console.warn('No webhook URL configured for lead export');
      return {
        success: true,
        totalExported: censoredLeads.length,
        error: 'Export completed but no webhook URL configured'
      };
    }

    console.log('Uploading censored lead data to webhook:', webhookUrl);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.WHATSAPP_API_KEY || '',
        'X-Export-Type': 'leads-censored'
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Failed to upload to webhook:', errorData);
      return {
        success: false,
        error: `Webhook upload failed: ${(errorData as { message?: string }).message ?? 'Unknown error'}`,
        totalExported: censoredLeads.length
      };
    }

    const webhookResult = await response.json();
    console.log('Successfully uploaded censored lead data to webhook:', webhookResult);

    return {
      success: true,
      totalExported: censoredLeads.length,
      webhookResponse: webhookResult
    };

  } catch (error) {
    console.error("Error exporting censored leads:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
} 