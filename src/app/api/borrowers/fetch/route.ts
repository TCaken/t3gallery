import { NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { fetchExternalBorrowers } from '~/app/_actions/borrowerSync';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body to get lastTwoDigit parameter
    const body = await request.json();
    const { lastTwoDigit = "02" } = body;

    // Validate lastTwoDigit parameter
    if (!/^\d{2}$/.test(lastTwoDigit)) {
      return NextResponse.json({ 
        error: 'Invalid lastTwoDigit parameter. Must be a 2-digit number (00-99)' 
      }, { status: 400 });
    }

    console.log(`Fetching external borrowers for last_two_digits=${lastTwoDigit}`);

    // Fetch external borrowers
    const result = await fetchExternalBorrowers(lastTwoDigit);

    if (result.success) {
      console.log(`Fetched ${result.data.length} borrowers from external API`);
      
      return NextResponse.json({
        success: true,
        message: `Fetched ${result.data.length} borrowers for digits ${lastTwoDigit}`,
        data: result.data,
        count: result.data.length
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch borrowers'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Borrower fetch API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to get default fetch parameters
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Borrower fetch API is available',
      availableDigits: Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')),
      defaultDigits: "02"
    });

  } catch (error) {
    console.error('Borrower fetch API GET error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 