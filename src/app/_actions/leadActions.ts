'use server';

import { db } from "~/server/db";
import { leads, leadStatusEnum, leadTypeEnum, lead_notes, users, logs } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import type { InferSelectModel } from "drizzle-orm";
import { eq, desc, like, or, and, SQL, asc, sql } from "drizzle-orm";
import { getCurrentUserId } from "~/app/_actions/userActions";
import { checkLeadEligibility } from "./leadEligibility";
import { getUserRoles } from "~/server/rbac/queries";
import { sendAutoTriggeredMessage } from "./whatsappActions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { autoAssignSingleLead } from "./agentActions";


// Fetch all leads with optional filtering by status
export async function fetchLeads(statusFilter?: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    const baseQuery = db.select().from(leads);
    
    // Create filtered query
    const finalQuery = statusFilter?.length 
      ? baseQuery.where(or(...statusFilter.map(status => eq(leads.status, status))))
      : baseQuery;
    
    // Execute query with ordering
    const result = await finalQuery.orderBy(desc(leads.created_at));
    return { success: true, leads: result };
  } catch (error) {
    console.error("Error fetching leads:", error);
    return { success: false, leads: [] };
  }
}

// Fetch a single lead by ID
export async function fetchLeadById(leadId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    const result = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    
    if (result.length === 0) {
      return { success: false, message: "Lead not found" };
    }
    
    return { success: true, lead: result[0] };
  } catch (error) {
    console.error("Error fetching lead:", error);
    return { success: false, message: "Failed to fetch lead" };
  }
}

interface CreateLeadInput {
  phone_number: string;
  phone_number_2?: string;
  phone_number_3?: string;
  full_name?: string;
  email?: string;
  source?: string;
  residential_status?: string;
  has_work_pass_expiry?: string;
  proof_of_residence_type?: string;
  has_letter_of_consent?: boolean;
  employment_status?: string;
  employment_salary?: string;
  employment_length?: string;
  has_payslip_3months?: boolean;
  amount?: string;
  loan_purpose?: string;
  existing_loans?: string;
  outstanding_loan_amount?: string;
  contact_preference?: string;
  communication_language?: string;
  created_by?: string;
  received_time?: Date;
  bypassEligibility?: boolean;
}


export async function createLead(input: CreateLeadInput, assignedToMe = false) {
  try {
    const { userId } = await auth();
    
    // Format phone number
    const formattedPhone = formatSGPhoneNumber(input.phone_number);
    
    // Determine eligibility based on bypass parameter
    let eligibilityStatus = 'eligible';
    let eligibilityNotes = 'Manually created lead - bypassed eligibility check';
    let finalStatus = 'new';
    
    if (!input.bypassEligibility) {
      // Run eligibility check
      const eligibilityResult = await checkLeadEligibility(formattedPhone);
      console.log('eligibilityResult', eligibilityResult);
      eligibilityStatus = eligibilityResult.isEligible ? 'eligible' : 'ineligible';
      eligibilityNotes = eligibilityResult.notes;
      finalStatus = eligibilityResult.isEligible ? 'new' : 'unqualified';
    }
    
    // Prepare comprehensive values with all the new fields
    const baseValues = {
      phone_number: formattedPhone,
      phone_number_2: input.phone_number_2 ?? formattedPhone,
      phone_number_3: input.phone_number_3 ?? formattedPhone,
      full_name: input.full_name ?? '',
      email: input.email ?? '',
      source: input.source ?? 'Unknown',
      residential_status: input.residential_status ?? '',
      has_work_pass_expiry: input.has_work_pass_expiry ?? '',
      proof_of_residence_type: input.proof_of_residence_type ?? '',
      has_letter_of_consent: input.has_letter_of_consent ?? false,
      employment_status: input.employment_status ?? '',
      employment_salary: input.employment_salary ?? '',
      employment_length: input.employment_length ?? '',
      has_payslip_3months: input.has_payslip_3months ?? false,
      amount: input.amount ?? '',
      loan_purpose: input.loan_purpose ?? '',
      existing_loans: input.existing_loans ?? '',
      outstanding_loan_amount: input.outstanding_loan_amount ?? '',
      contact_preference: input.contact_preference ?? 'No Preferences',
      communication_language: input.communication_language ?? 'No Preferences',
      lead_type: 'new',
      status: finalStatus,
      eligibility_checked: true,
      eligibility_status: eligibilityStatus,
      eligibility_notes: eligibilityNotes,
      created_by: input.created_by ?? userId,
      created_at: input.received_time ? new Date(input.received_time) : undefined,
    };

    // Create the lead
    const [lead] = await db.insert(leads).values(baseValues).returning();

    // Add log entry for lead creation
    await db.insert(logs).values({
      description: `Created new lead with phone ${formattedPhone}${input.full_name ? ` for ${input.full_name}` : ''}`,
      entity_type: 'lead',
      entity_id: lead?.id.toString() ?? '',
      action: 'create',
      performed_by: input.created_by ?? userId,
    });

    // Auto-assign the lead only if eligible
    if (lead?.id && eligibilityStatus === 'eligible') {
      console.log("Inside auto-assignment", assignedToMe);
      if (assignedToMe) {
        // Check if the creator is an agent and assign directly to them
        const userRoles = await getUserRoles();
        const isAgent = userRoles.some(role => role.roleName.toLowerCase() === 'agent');
      
        
        if (isAgent) {
          // Assign the lead directly to the creator (agent)
          await db.update(leads)
            .set({ 
              assigned_to: userId,
              status: 'assigned',
              updated_at: new Date(),
              updated_by: userId
            })
            .where(eq(leads.id, lead.id));
          
          // Add log entry for direct assignment
          await db.insert(logs).values({
            description: `Lead assigned to creator ${userId}`,
            entity_type: 'lead',
            entity_id: lead.id.toString(),
            action: 'assign',
            performed_by: userId,
          });
        } else {
          // If creator is not an agent, fall back to auto-assignment
          await autoAssignSingleLead(lead.id);
        }
      } else {
        // Normal auto-assignment process
        await autoAssignSingleLead(lead.id);
      }
    }

    return { success: true, lead: lead };
  } catch (error) {
    console.error('Error creating lead:', error);
    return { success: false, error: 'Failed to create lead' };
  }
}

// Define a proper interface for import data
interface ImportLeadData {
  phone_number?: string | number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  source?: string;
  status?: string;
  lead_type?: string;
  amount?: string;
  [key: string]: unknown;
}

// Singapore phone number validation and formatting
const validateSGPhoneNumber = (phone: string) => {
  if (!phone) return false;
  
  // Remove spaces, dashes, and parentheses
  const cleaned = phone.replace(/\s+|-|\(|\)/g, '');
  
  // Check for international format with +65
  if (cleaned.startsWith('+65')) {
    return /^\+65[896]\d{7}$/.test(cleaned);
  }
  
  // Check for local format with 65 prefix
  if (cleaned.startsWith('65')) {
    return /^65[896]\d{7}$/.test(cleaned);
  }
  
  // Check for local format without country code (8 digits)
  return /^[896]\d{7}$/.test(cleaned);
};

const formatSGPhoneNumber = (phone: string) => {
  if (!phone) return '';
  
  // Remove all non-digit characters except the plus sign
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it doesn't have a country code, add +65
  if (!cleaned.includes('+')) {
    // If it starts with 65, add a + at the beginning
    if (cleaned.startsWith('65')) {
      return `+${cleaned}`;
    }
    // Otherwise, add +65 prefix
    return `+65${cleaned}`;
  }
  
  return cleaned;
};

// Push ineligible lead data to Workato retention sheets
async function pushToWorkatoRetention(leadData: {
  phone_number: string;
  full_name?: string;
  email?: string;
  source?: string;
  amount?: string;
  eligibility_notes?: string;
  created_at?: Date;
}) {
  try {
    const workatoPayload = {
      phone_number: leadData.phone_number,
      full_name: leadData.full_name ?? '',
      email: leadData.email ?? '',
      source: leadData.source ?? 'Import',
      amount: leadData.amount ?? '',
      eligibility_notes: leadData.eligibility_notes ?? '',
      status: 'ineligible',
      created_at: leadData.created_at?.toISOString() ?? new Date().toISOString(),
      retention_category: 'imported_ineligible'
    };

    console.log('Pushing to Workato retention sheets:', workatoPayload);

    const response = await fetch('https://api.capcfintech.com/api/workato/retention-sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': `${process.env.WORKATO_API_KEY ?? process.env.WHATSAPP_API_KEY}` // Fallback to existing key if Workato key not set
      },
      body: JSON.stringify(workatoPayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Failed to push to Workato retention sheets:', errorData);
      return { success: false, error: (errorData as { message?: string }).message ?? 'Failed to push to retention sheets' };
    }

    const result = await response.json();
    console.log('Successfully pushed to Workato retention sheets:', result);
    return { success: true, data: result };

  } catch (error) {
    console.error('Error pushing to Workato retention sheets:', error);
    return { success: false, error: 'Network error while pushing to retention sheets' };
  }
}

// Import multiple leads from an Excel file with eligibility checking
export async function importLeads(leadsData: ImportLeadData[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    const results = {
      successful: [] as InferSelectModel<typeof leads>[], // Fix type to use actual Lead type
      failed: [] as { lead: ImportLeadData; reason: string }[],
      pushedToRetention: [] as { leadId: number; phone_number: string; retention_data: unknown }[] // Fix type
    };

    // Process each lead using createLead function
    for (const leadData of leadsData) {
      try {
        // Prepare the lead data for createLead
        const createLeadData = {
          phone_number: leadData.phone_number?.toString() ?? '',
          full_name: leadData.full_name ?? leadData.first_name ?? '',
          email: leadData.email ?? '',
          source: 'SEO', // Default source for imports
          amount: leadData.amount ?? '',
          lead_type: ['new', 'reloan'].includes((leadData.lead_type ?? '').toString().toLowerCase())
            ? (leadData.lead_type ?? '').toString().toLowerCase()
            : 'new',
          created_by: userId,
          bypassEligibility: false // Always check eligibility for imports
        };

        // Use createLead which handles eligibility checking and auto-assignment
        const result = await createLead(createLeadData);
        
        if (result.success && result.lead) {
          results.successful.push(result.lead);
          // const autoAssignResult = await autoAssignSingleLead(result.lead.id);
          // console.log('autoAssignResult', autoAssignResult);
          
          // If the lead is ineligible, push to Workato retention sheets
          if (result.lead.eligibility_status === 'ineligible') {
            try {
              const retentionResult = await pushToWorkatoRetention({
                phone_number: result.lead.phone_number,
                full_name: result.lead.full_name ?? undefined,
                email: result.lead.email ?? undefined,
                source: result.lead.source ?? undefined,
                amount: result.lead.amount ?? undefined,
                eligibility_notes: result.lead.eligibility_notes ?? undefined,
                created_at: result.lead.created_at
              });
              
              if (retentionResult.success) {
                results.pushedToRetention.push({
                  leadId: result.lead.id,
                  phone_number: result.lead.phone_number,
                  retention_data: retentionResult.data
                });
                console.log(`✅ Pushed ineligible lead ${result.lead.id} to Workato retention sheets`);
              } else {
                console.error(`❌ Failed to push lead ${result.lead.id} to retention sheets:`, retentionResult.error);
              }
            } catch (retentionError) {
              console.error('Error pushing to retention sheets:', retentionError);
              // Don't fail the import if retention push fails
            }
          }
        } else {
          results.failed.push({
            lead: leadData,
            reason: result.error ?? 'Unknown error during lead creation'
          });
        }
        
      } catch (error) {
        results.failed.push({
          lead: leadData,
          reason: `Error: ${(error as Error).message}`
        });
      }
    }
    
    const retentionMessage = results.pushedToRetention.length > 0 
      ? `, ${results.pushedToRetention.length} ineligible leads pushed to retention sheets`
      : '';
    
    return { 
      success: true, 
      count: results.successful.length,
      leads: results.successful,
      failed: results.failed,
      pushedToRetention: results.pushedToRetention,
      message: `${results.successful.length} leads imported successfully${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}${retentionMessage}` 
    };
  } catch (error) {
    console.error("Error importing leads:", error);
    return { 
      success: false, 
      count: 0,
      failed: [],
      pushedToRetention: [],
      message: `Failed to import leads: ${(error as Error).message}` 
    };
  }
}

// Add a note to a lead
export async function addLeadNote(leadId: number, content: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    // First verify the lead exists
    const leadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    
    if (leadResult.length === 0) {
      return { success: false, message: "Lead not found" };
    }
    
    // Insert the note
    const [note] = await db.insert(lead_notes).values({
      lead_id: leadId,
      content,
      created_by: userId,
      created_at: new Date()
    }).returning();
    
    return { 
      success: true, 
      note,
      message: "Note added successfully" 
    };
  } catch (error) {
    console.error("Error adding lead note:", error);
    return { 
      success: false, 
      message: `Failed to add note: ${(error as Error).message}` 
    };
  }
}

// Fetch notes for a lead
export async function fetchLeadNotes(leadId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    const result = await db.select()
      .from(lead_notes)
      .where(eq(lead_notes.lead_id, leadId))
      .orderBy(desc(lead_notes.created_at));
    
    return { 
      success: true, 
      notes: result
    };
  } catch (error) {
    console.error("Error fetching lead notes:", error);
    return { 
      success: false, 
      notes: [],
      message: `Failed to fetch notes: ${(error as Error).message}` 
    };
  }
}

export async function updateLeadDetails (leadId: number, newStatus: string) {
  return { success: true };
}

// Update a lead with any valid fields
export async function updateLead(
  leadId: number,
  leadData: Partial<InferSelectModel<typeof leads>>
) {
  const { userId } = await auth();
  // console.log('userId', userId);
  // if (!userId) {
  //   return { 
  //     success: false, 
  //     message: "Not authenticated" 
  //   };
  // }

  try {
    // First check if lead exists
    const existingLead = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    
    if (existingLead.length === 0) {
      return { success: false, message: "Lead not found" };
    }

    const originalLead = existingLead[0]!;

    // Validate phone number if it's being updated
    if (leadData.phone_number) {
      if (!validateSGPhoneNumber(leadData.phone_number)) {
        return { 
          success: false, 
          message: "Invalid Singapore phone number format" 
        };
      }
      // Format phone number
      leadData.phone_number = formatSGPhoneNumber(leadData.phone_number);
    }

    // Validate status if it's being updated
    if (leadData.status) {
      const validStatuses = [
        'new',
        'assigned',
        'no_answer',
        'follow_up',
        'booked',
        'done',
        'missed/RS',
        'unqualified',
        'give_up',
        'blacklisted'
      ];
      
      if (!validStatuses.includes(leadData.status)) {
        return { 
          success: false, 
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        };
      }
    }

    // Validate lead type if it's being updated
    if (leadData.lead_type) {
      const validLeadTypes = ['new', 'reloan'];
      if (!validLeadTypes.includes(leadData.lead_type)) {
        return { 
          success: false, 
          message: "Invalid lead type. Must be one of: new, reloan" 
        };
      }
    }

    // Remove any fields that shouldn't be updated
    const updateData = {
      ...leadData,
      assigned_to: originalLead.assigned_to,
      updated_by: userId,
      updated_at: new Date()
    };

    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;
    console.log('updateData', updateData);

    // Update the lead
    const [updated] = await db.update(leads)
      .set(updateData)
      .where(eq(leads.id, leadId))
      .returning();

    // Add log entry for lead update
    const changedFields = Object.keys(leadData).filter(key => 
      leadData[key as keyof typeof leadData] !== originalLead[key as keyof typeof originalLead]
    );

    await db.insert(logs).values({
      description: `Fields: ${changedFields.join(', ')}`,
      entity_type: 'lead',
      entity_id: leadId.toString(),
      action: 'update',
      performed_by: userId,
    });

    // Check if status changed and trigger auto-messages
    if (leadData.status && originalLead && leadData.status !== originalLead.status) {
      try {
        await sendAutoTriggeredMessage(
          leadId,
          leadData.status,
          updated?.phone_number ?? originalLead.phone_number
        );
      } catch (error) {
        console.error('Error sending auto-triggered WhatsApp message:', error);
        // Don't fail the lead update if WhatsApp fails
      }
    }

    return { 
      success: true, 
      lead: updated,
      message: "Lead updated successfully" 
    };

  } catch (error) {
    console.error("Error updating lead:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to update lead"
    };
  }
}

// Update just the lead status
export async function updateLeadStatus(leadId: number, newStatus: string) {
  try {
    await db.update(leads)
      .set({ 
        status: newStatus,
        updated_at: new Date()
      })
      .where(eq(leads.id, leadId));

    return { success: true };
  } catch (error) {
    console.error("Error updating lead status:", error);
    return { success: false, error: "Failed to update lead status" };
  }
}

// Add this new action
// Get total lead counts by status for each user role
export async function getLeadCountsByStatus() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Not authenticated");

    // Get user roles to determine what counts to return
    const userRoles = await getUserRoles();
    const isAgent = userRoles.some(role => role.roleName === 'agent');

    let countQuery;
    
    if (isAgent) {
      // For agents, only count leads assigned to them
      countQuery = db
        .select({
          status: leads.status,
          count: sql<number>`count(*)::int`
        })
        .from(leads)
        .where(eq(leads.assigned_to, userId))
        .groupBy(leads.status);
    } else {
      // For admins and other roles, count all leads
      countQuery = db
        .select({
          status: leads.status,
          count: sql<number>`count(*)::int`
        })
        .from(leads)
        .groupBy(leads.status);
    }

    const results = await countQuery;
    
    // Convert to a more convenient object format
    const statusCounts: Record<string, number> = {};
    results.forEach(result => {
      statusCounts[result.status] = result.count;
    });

    return { success: true, statusCounts };
  } catch (error) {
    console.error("Error fetching lead counts by status:", error);
    return { success: false, statusCounts: {} };
  }
}

export async function fetchFilteredLeads({
  status,
  search,
  sortBy = 'updated_at',
  sortOrder = 'desc',
  page = 1,
  limit = 200,
  isSearchMode = false
}: {
  status?: typeof leadStatusEnum.enumValues[number];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  isSearchMode?: boolean;
}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get user's roles
    const userRolesResult = await getUserRoles();
    const isAdmin = userRolesResult.some(r => r.roleName.toLowerCase() === 'admin');
    const isAgent = userRolesResult.some(r => r.roleName.toLowerCase() === 'agent');

    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: SQL[] = [];
    
    // In search mode, ignore role restrictions and status filters
    // Otherwise maintain existing logic
    if (!isSearchMode) {
      // Normal mode: apply status filter if provided
      if (status) {
        conditions.push(eq(leads.status, status));
      }
      
      // For agents in normal mode: only show leads assigned to them
      if (isAgent) {
        conditions.push(eq(leads.assigned_to, userId));
      }
    }
    // In search mode: don't apply status filter or agent filter to search across all statuses and all leads
    if (search) {
      const searchConditions = [
        like(leads.full_name, `%${search}%`),
        like(leads.phone_number, `%${search}%`),
        like(sql`${leads.id}::text`, `%${search}%`) // Allow searching by ID
      ].filter(Boolean);
      
      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions)!);
      }
    }

    // Build the query with proper joins and selection
    const baseQuery = db.select({
      id: leads.id,
      phone_number: leads.phone_number,
      phone_number_2: leads.phone_number_2,
      phone_number_3: leads.phone_number_3,
      full_name: leads.full_name,
      email: leads.email,
      residential_status: leads.residential_status,
      employment_status: leads.employment_status,
      employment_salary: leads.employment_salary,
      employment_length: leads.employment_length,
      has_work_pass_expiry: leads.has_work_pass_expiry,
      has_payslip_3months: leads.has_payslip_3months,
      has_proof_of_residence: leads.has_proof_of_residence,
      proof_of_residence_type: leads.proof_of_residence_type,
      has_letter_of_consent: leads.has_letter_of_consent,
      loan_purpose: leads.loan_purpose,
      existing_loans: leads.existing_loans,
      outstanding_loan_amount: leads.outstanding_loan_amount,
      amount: leads.amount,
      source: leads.source,
      status: leads.status,
      lead_type: leads.lead_type,
      created_at: leads.created_at,
      updated_at: leads.updated_at,
      created_by: leads.created_by,
      updated_by: leads.updated_by,
      assigned_to: leads.assigned_to,
      eligibility_checked: leads.eligibility_checked,
      eligibility_status: leads.eligibility_status,
      eligibility_notes: leads.eligibility_notes,
      contact_preference: leads.contact_preference,
      communication_language: leads.communication_language,
      lead_score: leads.lead_score,
      is_contactable: leads.is_contactable,
      is_deleted: leads.is_deleted,
      assigned_user: {
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        email: users.email
      },
      follow_up_date: leads.follow_up_date,
    })
    .from(leads)
    .leftJoin(users, eq(leads.assigned_to, users.id));
    
    // Build final query with conditions, sorting, and pagination
    let finalQuery;
    
    if (isSearchMode) {
      // Search mode: Simple sorting by relevance and updated_at, no role restrictions
      if (conditions.length > 0) {
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(
            desc(leads.updated_at),
            asc(leads.follow_up_date)
          )
          .limit(limit + 1)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .orderBy(
            desc(leads.updated_at),
            asc(leads.follow_up_date)
          )
          .limit(limit + 1)
          .offset(offset);
      }
    } else if (isAgent) {
      // For agents: Layer 1 (status priority: assigned, follow_up, missed/RS, done) + Layer 2 (updated_at) + Layer 3 (follow_up_date)
      if (conditions.length > 0) {
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(
            sql`CASE 
              WHEN ${leads.status} = 'assigned' THEN 1
              WHEN ${leads.status} = 'follow_up' THEN 2
              WHEN ${leads.status} = 'missed/RS' THEN 3
              WHEN ${leads.status} = 'done' THEN 4
              ELSE 5
            END`,
            desc(leads.updated_at),
            asc(leads.follow_up_date)
          )
          .limit(limit + 1)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .orderBy(
            sql`CASE 
              WHEN ${leads.status} = 'assigned' THEN 1
              WHEN ${leads.status} = 'follow_up' THEN 2
              WHEN ${leads.status} = 'missed/RS' THEN 3
              WHEN ${leads.status} = 'done' THEN 4
              ELSE 5
            END`,
            desc(leads.updated_at),
            asc(leads.follow_up_date)
          )
          .limit(limit + 1)
          .offset(offset);
      }
    } else {
      // For admins: Layer 2 (updated_at) + Layer 3 (follow_up_date)
      if (conditions.length > 0) {
        finalQuery = baseQuery
          .where(and(...conditions))
          .orderBy(
            desc(leads.updated_at),
            asc(leads.follow_up_date)
          )
          .limit(limit + 1)
          .offset(offset);
      } else {
        finalQuery = baseQuery
          .orderBy(
            desc(leads.updated_at),
            asc(leads.follow_up_date)
          )
          .limit(limit + 1)
          .offset(offset);
      }
    }

    // Execute query
    const results = await finalQuery;
    
    // Transform the results to match the Lead type
    const transformedLeads = results.map(result => ({
      ...result,
      assigned_to: result.assigned_user ? `${result.assigned_user.first_name} ${result.assigned_user.last_name}` : null
    }));
    
    // Check if there are more results
    const hasMore = results.length > limit;
    const leadsToReturn = hasMore ? transformedLeads.slice(0, limit) : transformedLeads;

    return {
      success: true,
      leads: leadsToReturn,
      hasMore,
      page,
      limit
    };

  } catch (error) {
    console.error('Error fetching leads:', error);
    return {
      success: false,
      error: 'Failed to fetch leads',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function deleteLead(leadId: number) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, message: 'Not authenticated' };
  }

  try {
    // Check if user has admin role
    const userRolesResult = await getUserRoles();
    const isAdmin = userRolesResult.some(r => r.roleName.toLowerCase() === 'admin');
    
    if (!isAdmin) {
      return { success: false, message: 'Unauthorized - Admin access required' };
    }

    // Get lead details before deletion for logging
    const [leadToDelete] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    
    if (!leadToDelete) {
      return { success: false, message: 'Lead not found' };
    }

    // Delete the lead (cascade will handle related records)
    await db.delete(leads).where(eq(leads.id, leadId));

    // Add log entry for lead deletion
    await db.insert(logs).values({
      description: `Deleted lead with phone ${leadToDelete.phone_number}${leadToDelete.full_name ? ` for ${leadToDelete.full_name}` : ''}`,
      entity_type: 'lead',
      entity_id: leadId.toString(),
      action: 'delete',
      performed_by: userId,
    });

    return { success: true, message: 'Lead deleted successfully' };
  } catch (error) {
    console.error('Error deleting lead:', error);
    return { success: false, message: 'Failed to delete lead' };
  }
}
