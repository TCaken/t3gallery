import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from "~/server/db";
import { leads } from "~/server/db/schema";
import { eq, and, lt, or, sql, gt } from "drizzle-orm";

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

    // Update leads that match the criteria
    const result = await db
      .update(leads)
      .set({ 
        status: 'give_up',
        updated_at: new Date(),
        updated_by: systemUserId
      })
      .where(
        and(
          or(...statusesToUpdate.map(status => eq(leads.status, status))),
          lt(leads.updated_at, thresholdDate)
        )
      )
      .returning({ id: leads.id, phone_number: leads.phone_number, status: leads.status });

    return NextResponse.json({
      success: true,
      message: `${result.length} leads moved to Give Up status`,
      updated_leads: result
    });
  } catch (error) {
    console.error('Error updating leads:', error);
    return NextResponse.json(
      { success: false, message: `Failed to update leads: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 