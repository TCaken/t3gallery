import { NextRequest, NextResponse } from "next/server";
import { syncPlaybookContacts } from "~/app/_actions/playbookManagement";

// POST /api/playbooks/sync - Sync contacts for a playbook (morning routine)
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

    console.log('Starting playbook sync:', { playbookId });

    const result = await syncPlaybookContacts(playbookId);

    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error syncing playbook:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to sync playbook',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 