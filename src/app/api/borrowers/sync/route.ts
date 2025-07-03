import { NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { syncAllBorrowers } from '~/app/_actions/borrowerSync';

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

    console.log(`Starting borrower sync for last_two_digits=${lastTwoDigit}`);

    // Call the sync function with the lastTwoDigit parameter
    const result = await syncAllBorrowers(lastTwoDigit);

    if (result.success) {
      console.log(`Sync completed: ${result.results.created} created, ${result.results.updated} updated, ${result.results.errors} errors`);
      
      return NextResponse.json({
        success: true,
        message: `Sync completed successfully for digits ${lastTwoDigit}`,
        results: result.results
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Sync failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Borrower sync API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check sync status or get sync history
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Borrower sync API is available',
      availableDigits: Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'))
    });

  } catch (error) {
    console.error('Borrower sync API GET error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 