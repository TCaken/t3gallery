"use server";

import { db } from "~/server/db";
import { 
  borrower_notes, 
  borrowers,
  users,
  logs,
  borrower_actions
} from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Types for borrower notes operations
export type CreateBorrowerNoteInput = {
  borrower_id: number;
  content: string;
  note_type?: 'general' | 'loan_discussion' | 'payment_issue' | 'follow_up' | 'other';
};

export type CreateBorrowerActionInput = {
  borrower_id: number;
  content: string;
  action_type: 'note' | 'questionnaire' | 'call' | 'whatsapp' | 'assignment' | 'status_update' | 'communication';
};

export type UpdateBorrowerNoteInput = {
  id: number;
  content?: string;
  note_type?: string;
};

export type BorrowerNoteFilters = {
  borrower_id?: number;
  note_type?: string;
  limit?: number;
  offset?: number;
};

export type BorrowerActionFilters = {
  borrower_id?: number;
  action_type?: string;
  limit?: number;
  offset?: number;
};

// Log borrower note action helper
async function logBorrowerNoteAction(
  noteId: number,
  borrowerId: number,
  action: string,
  description: string,
  userId: string
) {
  try {
    // Log to borrower_actions table
    await db.insert(borrower_actions).values({
      borrower_id: borrowerId,
      user_id: userId,
      action_type: "note",
      content: description,
      timestamp: new Date(),
      created_by: userId,
    });

    // // Log to main logs table
    // await db.insert(logs).values({
    //   description,
    //   entity_type: "borrower_note",
    //   entity_id: noteId.toString(),
    //   action,
    //   performed_by: userId,
    //   timestamp: new Date(),
    // });
  } catch (error) {
    console.error("Error logging borrower note action:", error);
  }
}

// Create borrower note (for manual notes and custom messages)
export async function createBorrowerNote(input: CreateBorrowerNoteInput) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const result = await db.insert(borrower_notes).values({
      borrower_id: input.borrower_id,
      content: input.content,
      note_type: input.note_type ?? 'general',
      created_by: userId,
      created_at: new Date(),
    });

    revalidatePath(`/dashboard/borrowers/${input.borrower_id}`);
    revalidatePath('/dashboard/borrowers');

    return { success: true, message: "Note created successfully" };
  } catch (error) {
    console.error("Error creating borrower note:", error);
    throw new Error("Failed to create borrower note");
  }
}

// Create borrower action (for system actions like questionnaire, calls, etc.)
export async function createBorrowerAction(input: CreateBorrowerActionInput) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const result = await db.insert(borrower_actions).values({
      borrower_id: input.borrower_id,
      user_id: userId,
      action_type: input.action_type,
      content: input.content,
      timestamp: new Date(),
      created_by: userId,
    });

    revalidatePath(`/dashboard/borrowers/${input.borrower_id}`);
    revalidatePath('/dashboard/borrowers');

    return { success: true, message: "Action logged successfully" };
  } catch (error) {
    console.error("Error creating borrower action:", error);
    throw new Error("Failed to create borrower action");
  }
}

// Get borrower notes with filters
export async function getBorrowerNotes(filters: BorrowerNoteFilters = {}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const {
      borrower_id,
      note_type,
      limit = 50,
      offset = 0
    } = filters;

    // Build query conditions
    const conditions = [];
    if (borrower_id) {
      conditions.push(eq(borrower_notes.borrower_id, borrower_id));
    }
    if (note_type) {
      conditions.push(eq(borrower_notes.note_type, note_type));
    }

    // Get notes with user details
    const notes = await db
      .select({
        id: borrower_notes.id,
        borrower_id: borrower_notes.borrower_id,
        content: borrower_notes.content,
        note_type: borrower_notes.note_type,
        created_at: borrower_notes.created_at,
        updated_at: borrower_notes.updated_at,
        created_by_name: users.first_name,
        created_by_last_name: users.last_name,
        created_by_email: users.email,
        borrower_name: borrowers.full_name,
      })
      .from(borrower_notes)
      .leftJoin(users, eq(borrower_notes.created_by, users.id))
      .leftJoin(borrowers, eq(borrower_notes.borrower_id, borrowers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(borrower_notes.created_at))
      .limit(limit)
      .offset(offset);

    return { success: true, data: notes };

  } catch (error) {
    console.error("Error fetching borrower notes:", error);
    throw new Error("Failed to fetch borrower notes");
  }
}

// Get single borrower note
export async function getBorrowerNote(id: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const noteData = await db
      .select({
        id: borrower_notes.id,
        borrower_id: borrower_notes.borrower_id,
        content: borrower_notes.content,
        note_type: borrower_notes.note_type,
        created_at: borrower_notes.created_at,
        updated_at: borrower_notes.updated_at,
        created_by_name: users.first_name,
        created_by_last_name: users.last_name,
        created_by_email: users.email,
        borrower_name: borrowers.full_name,
      })
      .from(borrower_notes)
      .leftJoin(users, eq(borrower_notes.created_by, users.id))
      .leftJoin(borrowers, eq(borrower_notes.borrower_id, borrowers.id))
      .where(eq(borrower_notes.id, id))
      .limit(1);

    if (noteData.length === 0) {
      throw new Error("Note not found");
    }

    return { success: true, data: noteData[0] };

  } catch (error) {
    console.error("Error fetching borrower note:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch borrower note");
  }
}

// Update borrower note
export async function updateBorrowerNote(input: UpdateBorrowerNoteInput) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const { id, ...updateData } = input;

    // Check if note exists
    const existingNote = await db
      .select()
      .from(borrower_notes)
      .where(eq(borrower_notes.id, id))
      .limit(1);

    if (existingNote.length === 0) {
      throw new Error("Note not found");
    }

    const oldNote = existingNote[0];

    // Build update object with only provided fields
    const fieldsToUpdate: Partial<typeof borrower_notes.$inferInsert> = {
      updated_by: userId,
      updated_at: new Date()
    };

    // Add provided fields to update
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] !== undefined) {
        (fieldsToUpdate as any)[key] = updateData[key as keyof typeof updateData];
      }
    });

    const result = await db
      .update(borrower_notes)
      .set(fieldsToUpdate)
      .where(eq(borrower_notes.id, id))
      .returning();

    const updatedNote = result[0];
    if (!updatedNote) {
      throw new Error("Failed to update note");
    }

    // Track what changed for logging
    const changes: string[] = [];
    Object.keys(updateData).forEach(key => {
      const oldValue = (oldNote as any)[key];
      const newValue = updateData[key as keyof typeof updateData];
      if (oldValue !== newValue) {
        changes.push(`${key}: ${oldValue} → ${newValue}`);
      }
    });

    // Log the update
    await logBorrowerNoteAction(
      id,
      oldNote.borrower_id,
      "update",
      `Updated note. Changes: ${changes.join(", ")}`,
      userId
    );

    revalidatePath("/dashboard/borrowers");
    revalidatePath(`/dashboard/borrowers/${oldNote.borrower_id}`);

    return { success: true, data: updatedNote };

  } catch (error) {
    console.error("Error updating borrower note:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update borrower note");
  }
}

// Delete borrower note
export async function deleteBorrowerNote(id: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Check if note exists
    const existingNote = await db
      .select()
      .from(borrower_notes)
      .where(eq(borrower_notes.id, id))
      .limit(1);

    if (existingNote.length === 0) {
      throw new Error("Note not found");
    }

    const note = existingNote[0];

    // Delete the note
    await db
      .delete(borrower_notes)
      .where(eq(borrower_notes.id, id));

    // Log the deletion
    await logBorrowerNoteAction(
      id,
      note.borrower_id,
      "delete",
      `Deleted note: ${note.content.substring(0, 100)}${note.content.length > 100 ? "..." : ""}`,
      userId
    );

    revalidatePath("/dashboard/borrowers");
    revalidatePath(`/dashboard/borrowers/${note.borrower_id}`);

    return { success: true, message: "Borrower note deleted successfully" };

  } catch (error) {
    console.error("Error deleting borrower note:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to delete borrower note");
  }
}

// Get borrower actions with filters
export async function getBorrowerActions(filters: BorrowerActionFilters = {}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const {
      borrower_id,
      action_type,
      limit = 50,
      offset = 0
    } = filters;

    // Build query conditions
    const conditions = [];
    if (borrower_id) {
      conditions.push(eq(borrower_actions.borrower_id, borrower_id));
    }
    if (action_type) {
      conditions.push(eq(borrower_actions.action_type, action_type));
    }

    // Get actions with user details
    const actions = await db
      .select({
        action_id: borrower_actions.action_id,
        borrower_id: borrower_actions.borrower_id,
        content: borrower_actions.content,
        action_type: borrower_actions.action_type,
        timestamp: borrower_actions.timestamp,
        created_by_name: users.first_name,
        created_by_last_name: users.last_name,
        created_by_email: users.email,
        borrower_name: borrowers.full_name,
      })
      .from(borrower_actions)
      .leftJoin(users, eq(borrower_actions.user_id, users.id))
      .leftJoin(borrowers, eq(borrower_actions.borrower_id, borrowers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(borrower_actions.timestamp))
      .limit(limit)
      .offset(offset);

    return { success: true, data: actions };

  } catch (error) {
    console.error("Error fetching borrower actions:", error);
    throw new Error("Failed to fetch borrower actions");
  }
} 