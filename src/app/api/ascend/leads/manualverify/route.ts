import { NextResponse } from 'next/server';
import { storeManualVerification } from '~/app/_actions/whatsappActions';

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

    console.log('✅ Valid API key provided for Ascend manual verification');

    const body = await request.json();
    
    // Validate required fields and types
    const { customerName, phoneNumber, customerHyperLink, app } = body;
    
    if (!customerName || !phoneNumber || !customerHyperLink) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: customerName, phoneNumber, customerHyperLink' 
        },
        { status: 400 }
      );
    }

    // Type validation
    if (typeof customerName !== 'string' || typeof phoneNumber !== 'string' || 
        typeof customerHyperLink !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'All required fields must be strings' 
        },
        { status: 400 }
      );
    }

    // App parameter is optional but must be string if provided
    const appName = app && typeof app === 'string' ? app : 'ascend-manual-verify';

    console.log('📝 API: Storing manual verification data for:', {
      customerName,
      phoneNumber,
      customerHyperLink,
      app: appName
    });

    // Call the storeManualVerification function
    const result = await storeManualVerification(
      customerName,
      phoneNumber,
      customerHyperLink,
      appName
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
    console.error('❌ Error in manual verification API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
