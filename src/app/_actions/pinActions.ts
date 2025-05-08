'use server';

import { db } from "~/server/db";
import { pinned_leads } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";

export async function pinLead(leadId: number) {
  try {
    const { userId } = auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    await db.insert(pinned_leads).values({
      lead_id: leadId,
      user_id: userId,
      pinned_at: new Date(),
      primary: false
    });

    return { success: true };
  } catch (error) {
    console.error('Error pinning lead:', error);
    return { success: false, error: 'Failed to pin lead' };
  }
}

export async function unpinLead(leadId: number) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    await db.delete(pinned_leads)
      .where(
        and(
          eq(pinned_leads.lead_id, leadId),
          eq(pinned_leads.user_id, userId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Error unpinning lead:', error);
    return { success: false, error: 'Failed to unpin lead' };
  }
}

export async function getPinnedLeads() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const pinnedLeads = await db.query.pinned_leads.findMany({
      where: eq(pinned_leads.user_id, userId),
      with: {
        lead: true
      }
    });

    return { success: true, data: pinnedLeads.map(p => p.lead) };
  } catch (error) {
    console.error('Error fetching pinned leads:', error);
    return { success: false, error: 'Failed to fetch pinned leads' };
  }
} 