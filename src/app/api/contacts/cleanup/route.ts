import { NextRequest, NextResponse } from "next/server";
import { cleanupAllContacts } from "~/app/_actions/contactActions";

// POST /api/contacts/cleanup - Delete all contacts (evening routine)
export async function POST(request: NextRequest) {
  try {
    console.log('Starting end-of-day contact cleanup');

    const result = await cleanupAllContacts();

    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error cleaning up contacts:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to cleanup contacts',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 