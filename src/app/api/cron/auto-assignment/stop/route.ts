import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '~/server/db';
import { autoAssignmentSettings } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

// Define the request schema
const RequestSchema = z.object({
  api_key: z.string(), // Required API key for authentication
});

/**
 * API endpoint to disable auto-assignment
 * POST /api/auto-assignment/stop
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

    // Validate API key
    const apiKey = process.env.AUTO_ASSIGNMENT_API_KEY;
    if (!apiKey || parsedBody.data.api_key !== apiKey) {
      return NextResponse.json(
        { success: false, message: "Invalid API key" },
        { status: 401 }
      );
    }

    // Get current settings
    const currentSettings = await db.query.autoAssignmentSettings.findFirst({
      orderBy: (table, { desc }) => [desc(table.id)]
    });

    if (!currentSettings) {
      // Create default settings with auto-assignment disabled
      const newSettings = await db.insert(autoAssignmentSettings).values({
        is_enabled: false,
        assignment_method: 'round_robin',
        current_round_robin_index: 0,
        max_leads_per_agent_per_day: 500,
        updated_at: new Date(),
        updated_by: 'api'
      }).returning();

      return NextResponse.json({
        success: true,
        message: "Auto-assignment disabled successfully (created new settings)",
        settings: newSettings[0]
      });
    }

    // Update existing settings to disable auto-assignment
    const updatedSettings = await db
      .update(autoAssignmentSettings)
      .set({
        is_enabled: false,
        updated_at: new Date(),
        updated_by: 'api'
      })
      .where(eq(autoAssignmentSettings.id, currentSettings.id))
      .returning();

    return NextResponse.json({
      success: true,
      message: "Auto-assignment disabled successfully",
      settings: updatedSettings[0]
    });

  } catch (error) {
    console.error('Error disabling auto-assignment:', error);
    return NextResponse.json(
      { success: false, message: `Error disabling auto-assignment: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 