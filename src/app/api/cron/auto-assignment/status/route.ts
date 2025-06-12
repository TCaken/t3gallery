import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '~/server/db';

// Define the request schema for GET (query params) and POST (body)
const RequestSchema = z.object({
  api_key: z.string(), // Required API key for authentication
});

/**
 * API endpoint to get auto-assignment status
 * GET /api/auto-assignment/status?api_key=your_key
 * POST /api/auto-assignment/status (with api_key in body)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const api_key = url.searchParams.get('api_key');

    if (!api_key) {
      return NextResponse.json(
        { success: false, message: "API key is required" },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = process.env.AUTO_ASSIGNMENT_API_KEY;
    if (!apiKey || api_key !== apiKey) {
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
      return NextResponse.json({
        success: true,
        message: "No auto-assignment settings found",
        settings: {
          is_enabled: false,
          assignment_method: 'round_robin',
          current_round_robin_index: 0,
          max_leads_per_agent_per_day: 20
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: "Auto-assignment status retrieved successfully",
      settings: currentSettings
    });

  } catch (error) {
    console.error('Error getting auto-assignment status:', error);
    return NextResponse.json(
      { success: false, message: `Error getting auto-assignment status: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json({
        success: true,
        message: "No auto-assignment settings found",
        settings: {
          is_enabled: false,
          assignment_method: 'round_robin',
          current_round_robin_index: 0,
          max_leads_per_agent_per_day: 20
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: "Auto-assignment status retrieved successfully",
      settings: currentSettings
    });

  } catch (error) {
    console.error('Error getting auto-assignment status:', error);
    return NextResponse.json(
      { success: false, message: `Error getting auto-assignment status: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 