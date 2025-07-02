"use server";

import { db } from "~/server/db";
import { 
  borrowers, 
  borrower_actions, 
  logs, 
  playbook_contacts,
  playbooks,
  users,
  loan_plans
} from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc, and, sql, ilike, or, gte, lt, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Types for borrower operations
export type CreateBorrowerInput = {
  atom_borrower_id?: string;
  full_name: string;
  phone_number: string;
  phone_number_2?: string;
  phone_number_3?: string;
  email?: string;
  residential_status?: string;
  status: string;
  source?: string;
  aa_status?: string;
  id_type: string;
  id_number?: string;
  income_document_type?: string;
  current_employer?: string;
  average_monthly_income?: string;
  annual_income?: string;
  estimated_reloan_amount?: string;
  loan_id?: string;
  latest_completed_loan_date?: string | Date | null;
  credit_score?: string;
  loan_amount?: string;
  loan_status?: string;
  loan_notes?: string;
  lead_score?: number;
  financial_commitment_change?: string;
  contact_preference?: string;
  communication_language?: string;
  follow_up_date?: Date | null;
  assigned_to?: string | null;
  // Performance bucket fields
  is_in_closed_loan?: string | null;
  is_in_2nd_reloan?: string | null;
  is_in_attrition?: string | null;
  is_in_last_payment_due?: string | null;
  is_in_bhv1?: string | null;
  // Questionnaire fields
  employment_status_changed?: boolean;
  employment_change_details?: string;
  work_pass_expiry_status?: string;
  customer_experience_feedback?: string;
  last_questionnaire_date?: Date;
};

export type UpdateBorrowerInput = Partial<CreateBorrowerInput> & {
  id: number;
};

export type BorrowerFilters = {
  search?: string;
  status?: string;
  assigned_to?: string;
  aa_status?: string;
  id_type?: string;
  source?: string;
  lead_score_range?: string; // 'high', 'medium', 'low'
  performance_bucket?: string; // 'closed_loan', '2nd_reloan', 'attrition', 'last_payment', 'bhv1'
  assigned_filter?: string; // 'assigned', 'unassigned', 'my_borrowers'
  date_range?: string; // 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year'
  created_date_start?: string; // Date string in YYYY-MM-DD format
  created_date_end?: string; // Date string in YYYY-MM-DD format
  follow_up_date_start?: string; // Date string in YYYY-MM-DD format
  follow_up_date_end?: string; // Date string in YYYY-MM-DD format
  last_loan_date_start?: string; // Date string in YYYY-MM-DD format
  last_loan_date_end?: string; // Date string in YYYY-MM-DD format
  limit?: number;
  offset?: number;
};

// Log borrower action helper
async function logBorrowerAction(
  borrowerId: number,
  action: string,
  description: string,
  userId: string,
  actionType = "system"
) {
  try {
    // Log to borrower_actions table
    await db.insert(borrower_actions).values({
      borrower_id: borrowerId,
      user_id: userId,
      action_type: actionType,
      content: description,
      timestamp: new Date(),
      created_by: userId,
    });

    // Log to main logs table
    await db.insert(logs).values({
      description,
      entity_type: "borrower",
      entity_id: borrowerId.toString(),
      action,
      performed_by: userId,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error logging borrower action:", error);
  }
}

// Create borrower
export async function createBorrower(input: CreateBorrowerInput) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Check for duplicate phone number
    const existingBorrower = await db
      .select()
      .from(borrowers)
      .where(
        and(
          eq(borrowers.phone_number, input.phone_number),
          eq(borrowers.is_deleted, false)
        )
      )
      .limit(1);

    if (existingBorrower.length > 0) {
      throw new Error("A borrower with this phone number already exists");
    }

    // Automatically determine source if not provided
    const determinedSource = input.source ?? determineBorrowerSource(input);

    // Determine status - if not in any bucket, set to done
    const finalStatus = determinedSource === "Not in All Buckets" ? "done" : input.status;

    // Prepare borrower data
    const borrowerData = {
      atom_borrower_id: input.atom_borrower_id ?? "",
      full_name: input.full_name,
      phone_number: input.phone_number,
      phone_number_2: input.phone_number_2 ?? "",
      phone_number_3: input.phone_number_3 ?? "",
      email: input.email ?? "",
      residential_status: input.residential_status ?? "",
      status: finalStatus,
      source: determinedSource,
      aa_status: input.aa_status ?? "pending",
      id_type: input.id_type,
      id_number: input.id_number ?? "",
      income_document_type: input.income_document_type ?? "",
      current_employer: input.current_employer ?? "",
      average_monthly_income: input.average_monthly_income ?? "",
      annual_income: input.annual_income ?? "",
      estimated_reloan_amount: input.estimated_reloan_amount ?? "",
      loan_id: input.loan_id ?? "",
      latest_completed_loan_date: input.latest_completed_loan_date 
        ? (typeof input.latest_completed_loan_date === 'string' ? input.latest_completed_loan_date : input.latest_completed_loan_date.toISOString().split('T')[0])
        : null,
      is_in_closed_loan: input.is_in_closed_loan ?? "",
      is_in_2nd_reloan: input.is_in_2nd_reloan ?? "",
      is_in_attrition: input.is_in_attrition ?? "",
      is_in_last_payment_due: input.is_in_last_payment_due ?? "",
      is_in_bhv1: input.is_in_bhv1 ?? "",
      credit_score: input.credit_score ?? "",
      loan_amount: input.loan_amount ?? "",
      loan_status: input.loan_status ?? null,
      loan_notes: input.loan_notes ?? null,
      lead_score: input.lead_score ?? 0,
      financial_commitment_change: input.financial_commitment_change ?? "not_applicable",
      contact_preference: input.contact_preference ?? "No Preferences",
      communication_language: input.communication_language ?? "No Preferences",
      follow_up_date: input.follow_up_date ?? null,
      assigned_to: input.assigned_to,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      is_deleted: false,
    };

    // Create borrower
    const result = await db
      .insert(borrowers)
      .values(borrowerData)
      .returning();

    const newBorrower = result[0];
    if (!newBorrower) {
      throw new Error("Failed to create borrower");
    }

    // Log the creation
    await logBorrowerAction(
      newBorrower.id,
      "create",
      `Created new borrower: ${input.full_name}`,
      userId,
      "note"
    );

    // Auto-add to playbooks if assigned to an agent
    if (input.assigned_to) {
      await addBorrowerToPlaybooks(newBorrower.id, input.assigned_to, userId);
    }

    revalidatePath("/dashboard/borrowers");
    return { success: true, data: newBorrower };

  } catch (error) {
    console.error("Error creating borrower:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to create borrower");
  }
}

// Get borrowers with filters
export async function getBorrowers(filters: BorrowerFilters = {}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const {
      search,
      status,
      assigned_to,
      aa_status,
      id_type,
      source,
      lead_score_range,
      performance_bucket,
      assigned_filter,
      date_range,
      created_date_start,
      created_date_end,
      follow_up_date_start,
      follow_up_date_end,
      last_loan_date_start,
      last_loan_date_end,
      limit = 50,
      offset = 0
    } = filters;

    // Build query conditions
    const conditions = [eq(borrowers.is_deleted, false)];

    // Basic filters
    if (search) {
      const searchConditions = or(
        ilike(borrowers.full_name, `%${search}%`),
        ilike(borrowers.phone_number, `%${search}%`),
        ilike(borrowers.email, `%${search}%`),
        ilike(borrowers.loan_id, `%${search}%`)
      );
      if (searchConditions) {
        conditions.push(searchConditions);
      }
    }

    if (status) conditions.push(eq(borrowers.status, status));
    if (assigned_to) conditions.push(eq(borrowers.assigned_to, assigned_to));
    if (aa_status) conditions.push(eq(borrowers.aa_status, aa_status));
    if (id_type) conditions.push(eq(borrowers.id_type, id_type));
    if (source) conditions.push(eq(borrowers.source, source));

    // Lead score range filter
    if (lead_score_range) {
      switch (lead_score_range) {
        case 'high':
          conditions.push(gte(borrowers.lead_score, 75));
          break;
        case 'medium':
          conditions.push(and(gte(borrowers.lead_score, 50), lt(borrowers.lead_score, 75))!);
          break;
        case 'low':
          conditions.push(lt(borrowers.lead_score, 50));
          break;
      }
    }

    // Performance bucket filter
    if (performance_bucket) {
      switch (performance_bucket) {
        case 'closed_loan':
          conditions.push(eq(borrowers.is_in_closed_loan, 'yes'));
          break;
        case '2nd_reloan':
          conditions.push(eq(borrowers.is_in_2nd_reloan, 'yes'));
          break;
        case 'attrition':
          conditions.push(eq(borrowers.is_in_attrition, 'yes'));
          break;
        case 'last_payment':
          conditions.push(eq(borrowers.is_in_last_payment_due, 'yes'));
          break;
        case 'bhv1':
          conditions.push(eq(borrowers.is_in_bhv1, 'yes'));
          break;
      }
    }

    // Assignment filter
    if (assigned_filter) {
      switch (assigned_filter) {
        case 'assigned':
          conditions.push(isNotNull(borrowers.assigned_to));
          break;
        case 'unassigned':
          conditions.push(isNull(borrowers.assigned_to));
          break;
        case 'my_borrowers':
          conditions.push(eq(borrowers.assigned_to, userId));
          break;
      }
    }

    // Date range filter
    if (date_range) {
      const now = new Date();
      let startDate: Date;
      
      switch (date_range) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          conditions.push(gte(borrowers.created_at, startDate));
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          conditions.push(and(gte(borrowers.created_at, startDate), lt(borrowers.created_at, endDate))!);
          break;
        case 'this_week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          conditions.push(gte(borrowers.created_at, startDate));
          break;
        case 'last_week':
          const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
          const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          conditions.push(and(gte(borrowers.created_at, lastWeekStart), lt(borrowers.created_at, lastWeekEnd))!);
          break;
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          conditions.push(gte(borrowers.created_at, startDate));
          break;
        case 'last_month':
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
          conditions.push(and(gte(borrowers.created_at, lastMonthStart), lt(borrowers.created_at, lastMonthEnd))!);
          break;
        case 'this_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          conditions.push(gte(borrowers.created_at, startDate));
          break;
      }
    }

    // Created date range filter
    if (created_date_start) {
      const startDate = new Date(created_date_start + 'T00:00:00');
      conditions.push(gte(borrowers.created_at, startDate));
    }
    if (created_date_end) {
      const endDate = new Date(created_date_end + 'T23:59:59');
      conditions.push(lt(borrowers.created_at, endDate));
    }

    // Follow-up date range filter
    if (follow_up_date_start) {
      const startDate = new Date(follow_up_date_start + 'T00:00:00');
      conditions.push(gte(borrowers.follow_up_date, startDate));
    }
    if (follow_up_date_end) {
      const endDate = new Date(follow_up_date_end + 'T23:59:59');
      conditions.push(lt(borrowers.follow_up_date, endDate));
    }

    // Last loan completed date range filter
    if (last_loan_date_start) {
      conditions.push(sql`${borrowers.latest_completed_loan_date} >= ${last_loan_date_start}`);
    }
    if (last_loan_date_end) {
      conditions.push(sql`${borrowers.latest_completed_loan_date} <= ${last_loan_date_end}`);
    }

    // Get borrowers with assigned user details
    const borrowersList = await db
      .select({
        id: borrowers.id,
        full_name: borrowers.full_name,
        phone_number: borrowers.phone_number,
        phone_number_2: borrowers.phone_number_2,
        phone_number_3: borrowers.phone_number_3,
        email: borrowers.email,
        residential_status: borrowers.residential_status,
        status: borrowers.status,
        source: borrowers.source,
        aa_status: borrowers.aa_status,
        id_type: borrowers.id_type,
        id_number: borrowers.id_number,
        current_employer: borrowers.current_employer,
        average_monthly_income: borrowers.average_monthly_income,
        loan_id: borrowers.loan_id,
        latest_completed_loan_date: borrowers.latest_completed_loan_date,
        is_in_closed_loan: borrowers.is_in_closed_loan,
        is_in_2nd_reloan: borrowers.is_in_2nd_reloan,
        is_in_attrition: borrowers.is_in_attrition,
        is_in_last_payment_due: borrowers.is_in_last_payment_due,
        is_in_bhv1: borrowers.is_in_bhv1,
        credit_score: borrowers.credit_score,
        loan_status: borrowers.loan_status,
        lead_score: borrowers.lead_score,
        financial_commitment_change: borrowers.financial_commitment_change,
        contact_preference: borrowers.contact_preference,
        assigned_to: borrowers.assigned_to,
        follow_up_date: borrowers.follow_up_date,
        created_at: borrowers.created_at,
        updated_at: borrowers.updated_at,
        assigned_agent_name: sql<string>`CONCAT(${users.first_name}, ' ', ${users.last_name})`,
        assigned_agent_email: users.email,
      })
      .from(borrowers)
      .leftJoin(users, eq(borrowers.assigned_to, users.id))
      .where(and(...conditions))
      .orderBy(desc(borrowers.updated_at))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(borrowers)
      .where(and(...conditions));

    const totalCount = totalCountResult[0]?.count ?? 0;

    return {
      success: true,
      data: borrowersList,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    };

  } catch (error) {
    console.error("Error fetching borrowers:", error);
    throw new Error("Failed to fetch borrowers");
  }
}

// Get single borrower
export async function getBorrower(id: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const borrowerData = await db
      .select({
        id: borrowers.id,
        full_name: borrowers.full_name,
        phone_number: borrowers.phone_number,
        phone_number_2: borrowers.phone_number_2,
        phone_number_3: borrowers.phone_number_3,
        email: borrowers.email,
        residential_status: borrowers.residential_status,
        status: borrowers.status,
        source: borrowers.source,
        aa_status: borrowers.aa_status,
        id_type: borrowers.id_type,
        id_number: borrowers.id_number,
        income_document_type: borrowers.income_document_type,
        current_employer: borrowers.current_employer,
        average_monthly_income: borrowers.average_monthly_income,
        annual_income: borrowers.annual_income,
        estimated_reloan_amount: borrowers.estimated_reloan_amount,
        loan_id: borrowers.loan_id,
        latest_completed_loan_date: borrowers.latest_completed_loan_date,
        is_in_closed_loan: borrowers.is_in_closed_loan,
        is_in_2nd_reloan: borrowers.is_in_2nd_reloan,
        is_in_attrition: borrowers.is_in_attrition,
        is_in_last_payment_due: borrowers.is_in_last_payment_due,
        is_in_bhv1: borrowers.is_in_bhv1,
        credit_score: borrowers.credit_score,
        loan_amount: borrowers.loan_amount,
        loan_status: borrowers.loan_status,
        loan_notes: borrowers.loan_notes,
        lead_score: borrowers.lead_score,
        financial_commitment_change: borrowers.financial_commitment_change,
        contact_preference: borrowers.contact_preference,
        communication_language: borrowers.communication_language,
        follow_up_date: borrowers.follow_up_date,
        assigned_to: borrowers.assigned_to,
        created_at: borrowers.created_at,
        updated_at: borrowers.updated_at,
        assigned_agent_name: sql<string>`CONCAT(${users.first_name}, ' ', ${users.last_name})`,
        assigned_agent_email: users.email,
      })
      .from(borrowers)
      .leftJoin(users, eq(borrowers.assigned_to, users.id))
      .where(eq(borrowers.id, id))
      .limit(1);

    if (borrowerData.length === 0) {
      throw new Error("Borrower not found");
    }

    return { success: true, data: borrowerData[0] };

  } catch (error) {
    console.error("Error fetching borrower:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch borrower");
  }
}

// Update borrower
export async function updateBorrower(input: UpdateBorrowerInput) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const { id, ...updateData } = input;

    // Check if borrower exists
    const existingBorrower = await db
      .select()
      .from(borrowers)
      .where(eq(borrowers.id, id))
      .limit(1);

    if (existingBorrower.length === 0) {
      throw new Error("Borrower not found");
    }

    const oldData = existingBorrower[0]!;

    // Build update object with only provided fields
    const fieldsToUpdate: Partial<typeof borrowers.$inferInsert> = {
      updated_by: userId,
      updated_at: new Date()
    };

    // Add all provided fields to update
    Object.keys(updateData).forEach(key => {
      const typedKey = key as keyof typeof updateData;
      if (updateData[typedKey] !== undefined) {
        (fieldsToUpdate as Record<string, unknown>)[key] = updateData[typedKey];
      }
    });

    const result = await db
      .update(borrowers)
      .set(fieldsToUpdate)
      .where(eq(borrowers.id, id))
      .returning();

    const updatedBorrower = result[0];
    if (!updatedBorrower) {
      throw new Error("Failed to update borrower");
    }

    // Track what changed for logging
    const changes: string[] = [];
    Object.keys(updateData).forEach(key => {
      const typedKey = key as keyof typeof updateData;
      const oldValue = (oldData as Record<string, unknown>)[key];
      const newValue = updateData[typedKey];
      if (oldValue !== newValue) {
        changes.push(`${key}: ${String(oldValue)} → ${String(newValue)}`);
      }
    });

    // Log the update
    await logBorrowerAction(
      id,
      "update",
      `Updated borrower: ${updatedBorrower.full_name}. Changes: ${changes.join(", ")}`,
      userId,
      "note"
    );

    // Handle assignment changes for playbooks
    if (updateData.assigned_to && updateData.assigned_to !== oldData.assigned_to) {
      await addBorrowerToPlaybooks(id, updateData.assigned_to, userId);
      await logBorrowerAction(
        id,
        "assigned",
        `Assigned borrower to agent: ${updateData.assigned_to}`,
        userId,
        "assigned"
      );
    }

    // Check if status changed and trigger auto-messages for borrowers
    if (updateData.status && oldData.status !== updateData.status) {
      try {
        // Import here to avoid circular dependency
        const { sendAutoTriggeredMessage } = await import('./whatsappActions');
        await sendAutoTriggeredMessage(
          id,
          updateData.status,
          updatedBorrower.phone_number
        );
        console.log(`✅ Auto-triggered WhatsApp check for borrower ${id} status change: ${oldData.status} → ${updateData.status}`);
      } catch (error) {
        console.error('Error sending auto-triggered WhatsApp message for borrower:', error);
        // Don't fail the borrower update if WhatsApp fails
      }
    }

    revalidatePath("/dashboard/borrowers");
    revalidatePath(`/dashboard/borrowers/${id}`);

    return { success: true, data: updatedBorrower };

  } catch (error) {
    console.error("Error updating borrower:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update borrower");
  }
}

// Delete borrower (soft delete)
export async function deleteBorrower(id: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Check if borrower exists
    const existingBorrower = await db
      .select()
      .from(borrowers)
      .where(eq(borrowers.id, id))
      .limit(1);

    if (existingBorrower.length === 0) {
      throw new Error("Borrower not found");
    }

    const borrowerToDelete = existingBorrower[0]!;

    // Soft delete
    const result = await db
      .update(borrowers)
      .set({
        is_deleted: true,
        updated_by: userId,
        updated_at: new Date()
      })
      .where(eq(borrowers.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error("Failed to delete borrower");
    }

    // Log the deletion
    await logBorrowerAction(
      id,
      "delete",
      `Deleted borrower: ${borrowerToDelete.full_name}`,
      userId,
      "note"
    );

    revalidatePath("/dashboard/borrowers");

    return { success: true, message: "Borrower deleted successfully" };

  } catch (error) {
    console.error("Error deleting borrower:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to delete borrower");
  }
}

// Add borrower to agent's playbooks
async function addBorrowerToPlaybooks(borrowerId: number, agentId: string, userId: string) {
  try {
    // Get agent's active playbooks
    const agentPlaybooks = await db
      .select()
      .from(playbooks)
      .where(
        and(
          eq(playbooks.agent_id, agentId),
          eq(playbooks.is_active, true)
        )
      );

    // Get borrower data
    const borrower = await db
      .select()
      .from(borrowers)
      .where(eq(borrowers.id, borrowerId))
      .limit(1);

    if (borrower.length === 0 || agentPlaybooks.length === 0) {
      return;
    }

    const borrowerData = borrower[0]!;

    // Add borrower to each active playbook
    for (const playbook of agentPlaybooks) {
      // Check if already exists
      const existingContact = await db
        .select()
        .from(playbook_contacts)
        .where(
          and(
            eq(playbook_contacts.playbook_id, playbook.id),
            eq(playbook_contacts.lead_id, borrowerId)
          )
        )
        .limit(1);

      if (existingContact.length === 0) {
        await db.insert(playbook_contacts).values({
          playbook_id: playbook.id,
          lead_id: borrowerId,
          phone_number: borrowerData.phone_number,
          first_name: borrowerData.full_name.split(" ")[0] ?? "",
          last_name: borrowerData.full_name.split(" ").slice(1).join(" ") ?? "",
          data_source: "AirConnect",
          status: "pending",
          sync_status: "pending",
          created_at: new Date(),
          updated_at: new Date(),
        });

        // Log playbook addition
        await logBorrowerAction(
          borrowerId,
          "playbook_added",
          `Added to playbook: ${playbook.name}`,
          userId,
          "others"
        );
      }
    }
  } catch (error) {
    console.error("Error adding borrower to playbooks:", error);
  }
}

// Get borrower actions/history
export async function getBorrowerActions(borrowerId: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const actions = await db
      .select({
        action_id: borrower_actions.action_id,
        action_type: borrower_actions.action_type,
        content: borrower_actions.content,
        timestamp: borrower_actions.timestamp,
        user_first_name: users.first_name,
        user_last_name: users.last_name,
        user_email: users.email,
      })
      .from(borrower_actions)
      .leftJoin(users, eq(borrower_actions.user_id, users.id))
      .where(eq(borrower_actions.borrower_id, borrowerId))
      .orderBy(desc(borrower_actions.timestamp));

    return { success: true, data: actions };

  } catch (error) {
    console.error("Error fetching borrower actions:", error);
    throw new Error("Failed to fetch borrower actions");
  }
}

// Get borrowers with their loan plans
export async function getBorrowersWithLoanPlans(filters: BorrowerFilters = {}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const borrowersResult = await getBorrowers(filters);
    
    if (!borrowersResult.success || !borrowersResult.data) {
      return borrowersResult;
    }

    // Get loan plans for each borrower
    const borrowersWithPlans = await Promise.all(
      borrowersResult.data.map(async (borrower) => {
        const loanPlansResult = await db
          .select()
          .from(loan_plans)
          .where(eq(loan_plans.borrower_id, borrower.id))
          .orderBy(desc(loan_plans.is_selected), desc(loan_plans.created_at));

        const primaryLoanPlan = loanPlansResult.find(plan => plan.is_selected);
        
        return {
          ...borrower,
          loanPlans: loanPlansResult,
          primaryLoanPlan,
          totalLoanPlans: loanPlansResult.length,
        };
      })
    );

    return {
      success: true,
      data: borrowersWithPlans,
      pagination: borrowersResult.pagination
    };

  } catch (error) {
    console.error("Error fetching borrowers with loan plans:", error);
    throw new Error("Failed to fetch borrowers with loan plans");
  }
}

// Determine borrower source based on performance buckets
function determineBorrowerSource(input: CreateBorrowerInput): string {
  // Priority order: Closed Loan (High) → 2nd Reloan (Medium) → Attrition (High) → Last Payment Due (Medium) → BHV1 (Low) → Standard
  
  if (input.is_in_closed_loan === "Yes") {
    return "Closed Loan (High Priority)";
  }
  
  if (input.is_in_attrition === "Yes") {
    return "Attrition Risk (High Priority)";
  }
  
  if (input.is_in_2nd_reloan === "Yes") {
    return "2nd Reloan (Medium Priority)";
  }
  
  if (input.is_in_last_payment_due === "Yes") {
    return "Last Payment Due (Medium Priority)";
  }
  
  if (input.is_in_bhv1 === "Yes") {
    return "BHV1 Pattern (Low Priority)";
  }
  
  return "Not in All Buckets";
} 