'use server';

import { db } from "~/server/db";
import { leads, leadStatusEnum, leadTypeEnum, lead_notes } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc, InferSelectModel, like, or, and, SQL } from "drizzle-orm";
import { getCurrentUserId } from "~/app/_actions/userActions";
import { checkLeadEligibility } from "./leadEligibility";
import { checkLeadBlocklist } from "./blocklistActions";

// Populate the database with sample leads
export async function populateLeads() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  // Sample lead data with updated lead types and statuses
  const sampleLeads = [
    {
      phone_number: "+12345678901",
      first_name: "John",
      last_name: "Smith",
      email: "john.smith@example.com",
      status: "new", 
      source: "Website",
      lead_type: "new",
      created_by: userId,
    },
    {
      phone_number: "+12345678902",
      first_name: "Sarah",
      last_name: "Johnson",
      email: "sarah.j@example.com",
      status: "new",
      source: "Referral",
      lead_type: "reloan",
      created_by: userId,
    },
    {
      phone_number: "+12345678903",
      first_name: "Michael",
      last_name: "Brown",
      email: "m.brown@example.com",
      status: "unqualified",
      source: "LinkedIn",
      lead_type: "new",
      created_by: userId,
    },
    {
      phone_number: "+12345678904",
      first_name: "Jessica",
      last_name: "Williams",
      email: "j.williams@example.com",
      status: "give_up",
      source: "Trade Show",
      lead_type: "reloan",
      created_by: userId,
    },
    {
      phone_number: "+12345678905",
      first_name: "David",
      last_name: "Miller",
      email: "david.m@example.com",
      status: "blacklisted",
      source: "Cold Call",
      lead_type: "new",
      created_by: userId,
    }
  ];
  
  try {
    // Insert the sample leads
    const result = await db.insert(leads).values(sampleLeads).returning();
    return { success: true, count: result.length, message: `${result.length} leads populated` };
  } catch (error) {
    console.error("Error populating leads:", error);
    return { success: false, message: "Failed to populate leads: " + (error as Error).message };
  }
}

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
  full_name?: string;
  email?: string;
  residential_status?: string;
  employment_status?: string;
  loan_purpose?: string;
  existing_loans?: string;
  amount?: string;
  source?: string;
  created_by?: string;
  received_time?: Date;
}

export async function createLead(input: CreateLeadInput) {
  try {
    // Check eligibility first
    const eligibilityResult = await checkLeadEligibility(input.phone_number);

    // Note: We no longer reject leads with invalid phone numbers
    // Instead they will be created but marked as ineligible

    // Prepare base values
    const baseValues = {
      phone_number: input.phone_number,
      full_name: input.full_name,
      email: input.email,
      residential_status: input.residential_status,
      employment_status: input.employment_status,
      loan_purpose: input.loan_purpose,
      existing_loans: input.existing_loans,
      amount: input.amount,
      source: input.source,
      lead_type: 'new',
      status: eligibilityResult.status, // Use status from eligibility check
      eligibility_checked: true,
      eligibility_status: eligibilityResult.isEligible ? 'eligible' : 'ineligible',
      eligibility_notes: eligibilityResult.notes,
      created_by: input.created_by,
      created_at: input.received_time ? new Date(input.received_time) : undefined,
    };

    // Create the lead with or without the received_time
    const [lead] = await db
      .insert(leads)
      .values(baseValues)
      .returning();

    return { success: true, lead: lead };
  } catch (error) {
    console.error('Error creating lead:', error);
    return { success: false, error: 'Failed to create lead' };
  }
}

// Import multiple leads from an Excel file
export async function importLeads(leadsData: any[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  
  try {
    // Clean and format the data
    const formattedLeads = leadsData.map(lead => ({
      phone_number: lead.phone_number || '', // Required field
      first_name: lead.first_name || '-',
      last_name: lead.last_name || '-',
      email: lead.email || '',
      // Only allow valid statuses, default to 'new'
      status: ['new', 'unqualified', 'give_up', 'blacklisted'].includes(lead.status?.toLowerCase()) 
        ? lead.status?.toLowerCase() 
        : 'new',
      source: lead.source || '',
      // Only allow valid lead types, default to 'new'
      lead_type: ['new', 'reloan'].includes(lead.lead_type?.toLowerCase())
        ? lead.lead_type?.toLowerCase()
        : 'new',
      created_by: userId,
      created_at: new Date(),
    }));
    
    // Insert all leads
    const result = await db.insert(leads).values(formattedLeads).returning();
    
    return { 
      success: true, 
      count: result.length,
      leads: result,
      message: `${result.length} leads imported successfully` 
    };
  } catch (error) {
    console.error("Error importing leads:", error);
    return { 
      success: false, 
      count: 0,
      message: `Failed to import leads: ${(error as Error).message}` 
    };
  }
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

// Update a lead
export async function updateLead(
  leadId: number, 
  leadData: {
    phone_number: string;
    first_name: string;
    last_name: string;
    email: string;
    status: string;
    source?: string;
    lead_type: string;
  }
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  // Validate phone number
  if (!validateSGPhoneNumber(leadData.phone_number)) {
    return { 
      success: false, 
      message: "Invalid Singapore phone number format" 
    };
  }
  
  // Format phone number
  const formattedPhone = formatSGPhoneNumber(leadData.phone_number);
  
  // Validate status and lead_type
  const validStatuses = ['new', 'unqualified', 'give_up', 'blacklisted'];
  const validLeadTypes = ['new', 'reloan'];
  
  if (!validStatuses.includes(leadData.status)) {
    return { 
      success: false, 
      message: "Invalid status. Must be one of: new, unqualified, give_up, blacklisted" 
    };
  }
  
  if (!validLeadTypes.includes(leadData.lead_type)) {
    return { 
      success: false, 
      message: "Invalid lead type. Must be one of: new, reloan" 
    };
  }
  
  try {
    // First check if lead exists
    const existingLead = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    
    if (existingLead.length === 0) {
      return { success: false, message: "Lead not found" };
    }
    
    // Update the lead
    const [updated] = await db.update(leads)
      .set({
        ...leadData,
        phone_number: formattedPhone,
        updated_by: userId,
        updated_at: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();
    
    return { 
      success: true, 
      lead: updated,
      message: "Lead updated successfully" 
    };
  } catch (error) {
    console.error("Error updating lead:", error);
    return { 
      success: false, 
      message: `Failed to update lead: ${(error as Error).message}` 
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

export async function updateLeadDetails(leadId: number, leadData: Partial<InferSelectModel<typeof leads>>) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }
    
    // Check if user has admin role - implement your own role checking logic
    
    // Prepare the data to update
    const updateData = {
      ...leadData,
      updated_at: new Date(),
      updated_by: userId
    };
    
    // Remove any fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;
    
    // Update the lead in the database
    await db.update(leads)
      .set(updateData)
      .where(eq(leads.id, leadId));
    
    // Fetch the updated lead to return
    const updatedLead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId)
    });
    
    return { 
      success: true, 
      message: 'Lead updated successfully',
      lead: updatedLead
    };
  } catch (error) {
    console.error('Error updating lead details:', error);
    return { success: false, message: 'Failed to update lead details' };
  }
}

// Add this new action
export async function fetchFilteredLeads({
  status,
  search,
  sortBy = 'created_at',
  sortOrder = 'desc',
  page = 1,
  limit = 50
}: {
  status?: typeof leadStatusEnum.enumValues[number];
  search?: string;
  sortBy?: keyof typeof leads;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  try {
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: SQL[] = [];
    if (status) {
      conditions.push(eq(leads.status, status));
    }
    if (search) {
      conditions.push(
        or(
          like(leads.full_name, `%${search}%`),
          like(leads.phone_number, `%${search}%`)
        )
      );
    }

    // Build the query
    const baseQuery = db.select().from(leads);
    
    // Add conditions if any
    const queryWithConditions = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    // Add sorting
    const sortColumn = leads[sortBy];
    const queryWithSort = sortColumn
      ? queryWithConditions.orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
      : queryWithConditions;

    // Add pagination
    const finalQuery = queryWithSort.limit(limit + 1).offset(offset);

    // Execute query
    const results = await finalQuery;
    
    // Check if there are more results
    const hasMore = results.length > limit;
    const leadsToReturn = hasMore ? results.slice(0, limit) : results;

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
