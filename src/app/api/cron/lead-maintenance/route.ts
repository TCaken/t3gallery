import { NextResponse } from 'next/server';
import { z } from 'zod';

// Define the request schema
const RequestSchema = z.object({
  api_key: z.string(), // Required API key for authentication
  reference_date: z.string().optional(), // Optional date to use as reference
  update_days_threshold: z.number().optional(), // Optional days threshold for updates
  delete_days_threshold: z.number().optional(), // Optional days threshold for deletions
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

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: "Invalid request format", errors: parsedBody.error.errors },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = process.env.LEAD_MAINTENANCE_API_KEY;
    if (!apiKey || parsedBody.data.api_key !== apiKey) {
      return NextResponse.json(
        { success: false, message: "Invalid API key" },
        { status: 401 }
      );
    }

    // Prepare parameters for the API calls
    const params: Record<string, string | number> = {
      api_key: parsedBody.data.api_key // Pass API key to individual APIs
    };
    
    if (parsedBody.data.reference_date) {
      params.reference_date = parsedBody.data.reference_date;
    }
    
    if (parsedBody.data.update_days_threshold) {
      params.days_threshold = parsedBody.data.update_days_threshold;
    }

    // Step 1: Call the auto-update API
    const updateResponse = await fetch(new URL('/api/leads/auto-update', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!updateResponse.ok) {
      const updateError = await updateResponse.json();
      return NextResponse.json(
        { 
          success: false, 
          message: "Error in lead status update step",
          update_error: updateError 
        },
        { status: 500 }
      );
    }

    const updateResult = await updateResponse.json();

    // Step 2: Call the auto-delete API with potentially different threshold
    if (parsedBody.data.delete_days_threshold) {
      params.days_threshold = parsedBody.data.delete_days_threshold;
    } else if (parsedBody.data.update_days_threshold) {
      // Reset to default if delete threshold not specified
      delete params.days_threshold;
    }

    const deleteResponse = await fetch(new URL('/api/leads/auto-delete', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!deleteResponse.ok) {
      const deleteError = await deleteResponse.json();
      return NextResponse.json(
        { 
          success: false, 
          message: "Error in lead deletion step",
          update_result: updateResult,
          delete_error: deleteError 
        },
        { status: 500 }
      );
    }

    const deleteResult = await deleteResponse.json();

    // Return combined results
    return NextResponse.json({
      success: true,
      update_result: updateResult,
      delete_result: deleteResult
    });

  } catch (error) {
    console.error('Error in lead maintenance cron job:', error);
    return NextResponse.json(
      { success: false, message: `Error in lead maintenance: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 