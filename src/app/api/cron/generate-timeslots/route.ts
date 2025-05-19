import { NextResponse } from 'next/server';
import { z } from 'zod';

const RequestSchema = z.object({
  api_key: z.string(),
});

// Define error response type
interface ErrorResponse {
  error?: string;
  [key: string]: unknown;
}

/**
 * API endpoint to be called by a cron job to generate timeslots for the next 30 days.
 * This acts as a secure wrapper around the timeslots/generate endpoint.
 */
export async function POST(request: Request) {
  try {
    // Parse and validate the request body
    const body = await request.json().catch(() => ({}));
    const validationResult = RequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = process.env.API_KEY;
    if (!apiKey || validationResult.data.api_key !== apiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Call the timeslots/generate endpoint with the same API key
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Make internal request to the timeslots/generate endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const generateUrl = `${baseUrl}/api/timeslots/generate`;
    console.log('generateUrl', generateUrl);

    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        days_ahead: 30,
        calendar_setting_id: 1,
        api_key: apiKey
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as ErrorResponse;
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to generate timeslots',
          details: errorData?.error ?? 'Unknown error',
          status: response.status
        },
        { status: 500 }
      );
    }

    const result = await response.json();
    
    // Add timestamp to the response
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      cron_execution: true
    });

  } catch (error) {
    console.error('Error in cron timeslot generation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cron job execution failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 