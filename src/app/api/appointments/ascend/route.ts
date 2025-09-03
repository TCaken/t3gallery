import { NextResponse } from 'next/server';
import { processAppointmentReminderWithLeadProcessing } from '~/app/_actions/ascendLeadProcessing';

export async function POST(request: Request) {
  try {
    // Check for API key in headers
    const apiKey = request.headers.get('x-api-key') ?? request.headers.get('apikey');
    const expectedApiKey = process.env.ASCEND_API_KEY;

    if (!expectedApiKey) {
      console.error('❌ ASCEND_API_KEY environment variable not configured');
      return NextResponse.json(
        { 
          success: false, 
          error: 'API key configuration missing. Please contact administrator.' 
        },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'API key required. Please provide x-api-key or apikey header.' 
        },
        { status: 401 }
      );
    }

    if (apiKey !== expectedApiKey) {
      console.warn('❌ Invalid API key attempted:', apiKey?.substring(0, 8) + '...');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid API key provided.' 
        },
        { status: 403 }
      );
    }

    console.log('✅ Valid API key provided for Ascend appointment reminder');

    const body = await request.json();
    
    // Validate required fields and types
    const { customerName, phoneNumber, appointmentDate, timeSlot, app } = body;
    
    if (!customerName || !phoneNumber || !appointmentDate || !timeSlot) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: customerName, phoneNumber, appointmentDate, timeSlot' 
        },
        { status: 400 }
      );
    }

    // Type validation
    if (typeof customerName !== 'string' || typeof phoneNumber !== 'string' || 
        typeof appointmentDate !== 'string' || typeof timeSlot !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'All required fields must be strings' 
        },
        { status: 400 }
      );
    }

    // App parameter is optional but must be string if provided
    const appName = app && typeof app === 'string' ? app : 'api-endpoint';

    console.log('📞 API: Sending Ascend appointment reminder for:', {
      customerName,
      phoneNumber,
      appointmentDate,
      timeSlot,
      app: appName
    });

    // Call the enhanced appointment reminder function with lead processing
    const result = await processAppointmentReminderWithLeadProcessing(
      customerName,
      phoneNumber,
      appointmentDate,
      timeSlot,
      appName,
      body // Pass the complete request body for debugging
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error in appointment reminder API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 