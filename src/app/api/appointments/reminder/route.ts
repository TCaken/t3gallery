'use server';

import { NextRequest, NextResponse } from 'next/server';
import { triggerTodayAppointmentWebhooks } from '~/app/_actions/appointmentWebhookTrigger';

export async function POST(request: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key') ?? request.headers.get('apikey');
    
    // Call the webhook trigger function with API key authentication
    const result = await triggerTodayAppointmentWebhooks(apiKey ?? undefined);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          processedCount: result.processedCount,
          successCount: result.successCount,
          errorCount: result.errorCount,
          currentDate: result.currentDate,
          singaporeTime: result.singaporeTime,
          appointments: result.appointments,
          authenticatedBy: result.authenticatedBy
        }
      }, { status: 200 });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Error in appointment reminder API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Appointment Reminder API',
    description: 'POST to this endpoint to trigger appointment reminders for today',
    authentication: 'Requires x-api-key or apikey header with valid WORKATO_API_KEY',
    usage: 'POST /api/appointments/reminder'
  }, { status: 200 });
}
