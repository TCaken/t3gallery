import { NextRequest, NextResponse } from "next/server";
import { cleanupPlaybookContacts } from "~/app/_actions/playbookManagement";

// POST /api/playbooks/cleanup - Cleanup contacts for a playbook (hygiene)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playbookId } = body;

    if (!playbookId || typeof playbookId !== 'number') {
      return NextResponse.json(
        {
          success: false,
          message: 'Valid playbook ID is required',
        },
        { status: 400 }
      );
    }

    console.log('Starting playbook cleanup:', { playbookId });

    const result = await cleanupPlaybookContacts(playbookId);

    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error cleaning up playbook:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to cleanup playbook',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 