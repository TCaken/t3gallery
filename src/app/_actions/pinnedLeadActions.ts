'use server';

import { db } from '~/server/db';
import { pinned_leads } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

export async function togglePinLead(leadId: number) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if lead is already pinned
    const existingPin = await db.select()
      .from(pinned_leads)
      .where(
        and(
          eq(pinned_leads.user_id, userId),
          eq(pinned_leads.lead_id, leadId)
        )
      )
      .limit(1);

    if (existingPin.length > 0) {
      // Unpin the lead
      await db.delete(pinned_leads)
        .where(
          and(
            eq(pinned_leads.user_id, userId),
            eq(pinned_leads.lead_id, leadId)
          )
        );
      return { success: true, action: 'unpinned' };
    } else {
      // Pin the lead
      await db.insert(pinned_leads).values({
        user_id: userId,
        lead_id: leadId,
        pinned_at: new Date(),
        primary: false
      });
      return { success: true, action: 'pinned' };
    }
  } catch (error) {
    console.error('Error toggling pin status:', error);
    return { success: false, error: 'Failed to toggle pin status' };
  }
}

export async function getPinnedLeads() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const pinnedLeads = await db.select()
      .from(pinned_leads)
      .where(eq(pinned_leads.user_id, userId));

    return { success: true, pinnedLeads };
  } catch (error) {
    console.error('Error fetching pinned leads:', error);
    return { success: false, error: 'Failed to fetch pinned leads' };
  }
}

export async function isLeadPinned(leadId: number) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const pinnedLead = await db.select()
      .from(pinned_leads)
      .where(
        and(
          eq(pinned_leads.user_id, userId),
          eq(pinned_leads.lead_id, leadId)
        )
      )
      .limit(1);

    return { success: true, isPinned: pinnedLead.length > 0 };
  } catch (error) {
    console.error('Error checking pin status:', error);
    return { success: false, error: 'Failed to check pin status' };
  }
} 