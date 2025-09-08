import { NextResponse } from 'next/server';
import { processReloanCustomer } from '~/app/_actions/ascendLeadProcessing';
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

    console.log('✅ Valid API key provided for Ascend reloan customer processing');

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
    const appName = app && typeof app === 'string' ? app : 'ascend-reloan';

    console.log('🔄 API: Processing reloan customer:', {
      customerName,
      phoneNumber,
      customerHyperLink,
      app: appName
    });

    // Process the reloan customer
    const reloanResult = await processReloanCustomer(
      phoneNumber,
      customerName,
      customerHyperLink,
      {
        app: appName,
        source: 'Ascend Reloan'
      }
    );

    if (!reloanResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: reloanResult.error
        },
        { status: 500 }
      );
    }

    // Store the manual verification log entry
    const verificationResult = await storeManualVerification(
      customerName,
      phoneNumber,
      customerHyperLink,
      appName,
      body // Pass the complete request body for debugging
    );

    if (verificationResult.success) {
      return NextResponse.json({
        success: true,
        message: `${reloanResult.message}. ${verificationResult.message}`,
        data: {
          reloanProcessing: reloanResult.data,
          verification: verificationResult.data
        }
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: verificationResult.error
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error in reloan customer API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
