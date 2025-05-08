'use server';

import { db } from '~/server/db';
import { lead_notes } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

export async function getLeadComments(leadId: number) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const comments = await db.select()
      .from(lead_notes)
      .where(eq(lead_notes.lead_id, leadId))
      .orderBy(lead_notes.created_at);

    return { 
      success: true, 
      comments: comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        createdBy: comment.created_by
      }))
    };
  } catch (error) {
    console.error('Error fetching lead comments:', error);
    return { success: false, error: 'Failed to fetch comments' };
  }
}

export async function addLeadComment(leadId: number, content: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const [newComment] = await db.insert(lead_notes)
      .values({
        lead_id: leadId,
        content,
        created_by: userId
      })
      .returning();

    return { 
      success: true, 
      comment: {
        id: newComment.id,
        content: newComment.content,
        createdAt: newComment.created_at,
        createdBy: newComment.created_by
      }
    };
  } catch (error) {
    console.error('Error adding lead comment:', error);
    return { success: false, error: 'Failed to add comment' };
  }
} 