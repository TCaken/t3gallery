'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key') ?? request.headers.get('apikey');
    
    // Check if API key is provided
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key is required',
        message: 'Please provide x-api-key or apikey in headers'
      }, { status: 401 });
    }
    
    // Validate API key (you can add your actual validation logic here)
    const validApiKey = process.env.WORKATO_API_KEY;
    if (apiKey !== validApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      }, { status: 403 });
    }
    
    // Parse request body for additional parameters
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }
    
    // Extract today's date from request body
    const { todaysDate } = requestBody;
    
    console.log('🧪 Missed appointments API called with:', { 
      todaysDate, 
      apiKey: apiKey ? "***" + String(apiKey).slice(-4) : undefined 
    });
    
    // Return dummy data for Workato testing
    return NextResponse.json({
      success: true,
      message: 'Dummy missed appointments data for Workato testing',
      data: {
        processedCount: 15,
        successCount: 13,
        errorCount: 2,
        currentDate: todaysDate || new Date().toISOString().split('T')[0],
        singaporeTime: new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
        missedAppointments: [
          {
            id: 1,
            customer_name: "John Doe",
            phone_number: "+6598765432",
            appointment_date: "2024-01-15",
            time_slot: "10:00 AM",
            status: "missed",
            reason: "No show"
          },
          {
            id: 2,
            customer_name: "Jane Smith",
            phone_number: "+6598765433",
            appointment_date: "2024-01-15",
            time_slot: "11:00 AM",
            status: "cancelled",
            reason: "Customer requested cancellation"
          },
          {
            id: 3,
            customer_name: "Bob Johnson",
            phone_number: "+6598765434",
            appointment_date: "2024-01-15",
            time_slot: "02:00 PM",
            status: "missed",
            reason: "Late arrival"
          },
          {
            id: 4,
            customer_name: "Alice Brown",
            phone_number: "+6598765435",
            appointment_date: "2024-01-15",
            time_slot: "03:00 PM",
            status: "cancelled",
            reason: "Emergency situation"
          }
        ],
        summary: {
          totalMissed: 2,
          totalCancelled: 2,
          totalProcessed: 4,
          rescheduledCount: 1,
          followUpRequired: 3
        },
        testMode: true,
        receivedParameters: {
          todaysDate: todaysDate || 'Not provided'
        }
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Error in missed appointments API:', error);
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
    message: 'Missed Appointments API',
    description: 'POST to this endpoint to get missed appointments data for today',
    authentication: 'Requires x-api-key or apikey header with valid WORKATO_API_KEY',
    usage: 'POST /api/appointments/missed',
    bodyParameters: {
      todaysDate: 'Optional: Date in YYYY-MM-DD format (defaults to today)'
    },
    example: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'your_api_key_here'
      },
      body: {
        todaysDate: '2024-01-15'
      }
    },
    response: {
      success: true,
      data: {
        missedAppointments: 'Array of missed/cancelled appointments',
        summary: 'Summary statistics',
        testMode: 'Always true for this endpoint'
      }
    }
  }, { status: 200 });
}
