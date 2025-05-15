import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from "~/server/db";
import { leads } from "~/server/db/schema";
import { eq, and, lt, or, sql } from "drizzle-orm";

// Define the request schema
const RequestSchema = z.object({
  api_key: z.string().optional(), // API key for authentication
  reference_date: z.string().optional(), // Optional date to use as reference (for testing)
  days_threshold: z.number().optional(), // Optional days threshold override
});

/**
 * API endpoint to automatically delete old leads
 * - Deletes Give Up leads after 90 days in that status
 * - Deletes Unqualified leads after 90 days in that status
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
      const apiKey = process.env.LEAD_MAINTENANCE_API_KEY;
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

    // Get days threshold from environment variable or request, default to 90 if not set
    const daysThreshold = parsedBody.data.days_threshold ?? 
                          Number(process.env.LEAD_DELETE_DAYS_THRESHOLD ?? 90);

    // Calculate the date threshold (90 days ago from reference date)
    const thresholdDate = new Date(referenceDate);
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Find leads that meet the deletion criteria
    const leadsToDelete = await db
      .select({ id: leads.id, phone_number: leads.phone_number, status: leads.status })
      .from(leads)
      .where(
        and(
          or(
            eq(leads.status, 'give_up'),
            eq(leads.status, 'unqualified')
          ),
          // The lead has been in this status for at least X days
          // We check updated_at since that's when the status would have last changed
          lt(leads.updated_at, thresholdDate)
        )
      );

    // If no leads to delete, return early
    if (leadsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No leads meet the deletion criteria",
        deleted_count: 0
      });
    }

    // Get the IDs of leads to delete
    const leadIdsToDelete = leadsToDelete.map(lead => lead.id);

    // Delete the leads
    await db
      .delete(leads)
      .where(
        sql`id IN (${sql.join(leadIdsToDelete, sql`, `)})`
      );

    return NextResponse.json({
      success: true,
      message: `${leadIdsToDelete.length} leads deleted`,
      deleted_count: leadIdsToDelete.length,
      deleted_leads: leadsToDelete
    });
  } catch (error) {
    console.error('Error deleting leads:', error);
    return NextResponse.json(
      { success: false, message: `Failed to delete leads: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 