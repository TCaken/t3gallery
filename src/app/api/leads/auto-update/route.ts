import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from "~/server/db";
import { leads } from "~/server/db/schema";
import { eq, and, lt, or, sql, gt } from "drizzle-orm";
import { updateLead } from "~/app/_actions/leadActions";

// Define the request schema
const RequestSchema = z.object({
  api_key: z.string().optional(), // API key for authentication
  reference_date: z.string().optional(), // Optional date to use as reference (for testing)
  days_threshold: z.number().optional(), // Optional days threshold override
});

/**
 * API endpoint to automatically move stale leads to "Give Up" status
 * Affects leads with status: New, Assigned, No Answer, Follow Up, Missed, RS
 * Moves them to "Give Up" if they haven't been updated in X days (default 14)
 * For assigned leads that arrived on the reference date, moves them to "No Answer" regardless of threshold
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const parsedBody = RequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: "Invalid request format", errors: parsedBody.error.errors },
        { status: 400 }
      );
    }

    // API key authentication (optional - only check if provided)
    if (parsedBody.data.api_key) {
      const apiKey = process.env.API_KEY;
      if (!apiKey || parsedBody.data.api_key !== apiKey) {
        return NextResponse.json(
          { success: false, message: "Invalid API key" },
          { status: 401 }
        );
      }
    }

    // Get the reference date (default to current date if not provided)
    const referenceDate = parsedBody.data.reference_date 
      ? new Date(parsedBody.data.reference_date) 
      : new Date();

    // Get days threshold from environment variable or request, default to 14 if not set
    const daysThreshold = parsedBody.data.days_threshold ?? 
                           Number(process.env.LEAD_GIVE_UP_DAYS_THRESHOLD ?? 14);

    // Calculate the date threshold (X days ago from reference date)
    const thresholdDate = new Date(referenceDate);
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
    console.log('thresholdDate', thresholdDate);

    // Statuses to check
    const statusesToUpdate = ['new', 'assigned', 'no_answer', 'follow_up', 'missed/RS', 'RS'];

    // Use system user ID for tracking updates
    const systemUserId = process.env.SYSTEM_USER_ID ?? 'system';

    // First, get all leads that need updating
    // For assigned leads created today, we don't check the threshold
    const leadsToUpdate = await db
      .select()
      .from(leads)
      .where(
        or(
          // Get assigned leads updated within 25 hours before reference date
          and(
            eq(leads.status, 'assigned'),
            sql`${leads.updated_at} >= DATE(${referenceDate}) - INTERVAL '25 hours' AND ${leads.updated_at} <= ${referenceDate}`
          ),
          // Get other leads that exceed threshold
          and(
            or(...statusesToUpdate.map(status => eq(leads.status, status))),
            lt(leads.updated_at, thresholdDate)
          )
        )
      );

    const results = {
      give_up: [] as typeof leadsToUpdate,
      no_answer: [] as typeof leadsToUpdate,
      errors: [] as { id: number; error: string }[]
    };

    // Process each lead
    for (const lead of leadsToUpdate) {
      try {
        // Check if this is an assigned lead updated within 25 hours before reference date
        const isAssignedLeadOnReferenceDate = 
          lead.status === 'assigned' && 
          lead.updated_at && 
          new Date(lead.updated_at) >= new Date(new Date(referenceDate).getTime() - (25 * 60 * 60 * 1000)) &&
          new Date(lead.updated_at) <= referenceDate;

        console.log(`Lead ID: ${lead.id} - Status: ${lead.status} - Updated At: ${lead.updated_at ? new Date(lead.updated_at).toLocaleString() : 'N/A'} - Reference Date: ${referenceDate.toLocaleString()} - isAssignedLeadOnReferenceDate: ${isAssignedLeadOnReferenceDate}`);

        // Update the lead using updateLead function
        const result = await updateLead(lead.id, {
          status: isAssignedLeadOnReferenceDate ? 'no_answer' : 'give_up',
          updated_by: systemUserId,
          updated_at: new Date(),
          eligibility_notes: isAssignedLeadOnReferenceDate 
            ? 'Auto-updated to No Answer - Lead updated within 25 hours'
            : 'Auto-updated to Give Up - No activity'
        });

        if (result.success) {
          if (isAssignedLeadOnReferenceDate) {
            results.no_answer.push(lead);
          } else {
            results.give_up.push(lead);
          }
        } else {
          results.errors.push({ id: lead.id, error: result.message || 'Unknown error' });
        }
      } catch (error) {
        results.errors.push({ 
          id: lead.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.give_up.length} leads to Give Up, ${results.no_answer.length} leads to No Answer`,
      results: {
        give_up: results.give_up.map(l => ({ id: l.id, phone_number: l.phone_number })),
        no_answer: results.no_answer.map(l => ({ id: l.id, phone_number: l.phone_number })),
        errors: results.errors
      }
    });
  } catch (error) {
    console.error('Error updating leads:', error);
    return NextResponse.json(
      { success: false, message: `Failed to update leads: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 