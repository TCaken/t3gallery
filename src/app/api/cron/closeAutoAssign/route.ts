import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAutoAssignmentSettings } from '~/app/_actions/agentActions';
import { db } from '~/server/db';
import { autoAssignmentSettings } from '~/server/db/schema';

// Define the request schema
const RequestSchema = z.object({
  api_key: z.string(), // Required API key for authentication
});

/**
 * API endpoint to run both lead maintenance jobs:
 * 1. Move stale leads to "Give Up" status
 * 2. Delete old "Give Up" and "Unqualified" leads
 * 
 * This can be called by a scheduler like GitHub Actions or Vercel Cron Jobs
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const parsedBody = RequestSchema.safeParse(body);
    console.log('parsedBody', parsedBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: "Invalid request format", errors: parsedBody.error.errors },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = process.env.API_KEY;
    if (!apiKey || parsedBody.data.api_key !== apiKey) {
      return NextResponse.json(
        { success: false, message: "Invalid API key" },
        { status: 401 }
      );
    }


    const currentSettings = await getAutoAssignmentSettings();
    if (!currentSettings.success || !currentSettings.settings) {
      return { success: false, message: "Could not get current settings" };
    }

    const updatedSettings = await db
      .update(autoAssignmentSettings)
      .set({
        is_enabled: false,  
        updated_at: new Date(),
        updated_by: 'cron'
      })
      .where(eq(autoAssignmentSettings.id, currentSettings.settings.id))
      .returning();

    return NextResponse.json({
      success: true,
      settings: updatedSettings[0],
      message: "Auto-assignment settings updated successfully"
    });


  } catch (error) {
    console.error('Error in admin maintenance cron job:', error);
    return NextResponse.json(
      { success: false, message: `Error in lead maintenance: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 