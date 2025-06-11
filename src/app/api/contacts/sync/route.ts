import { NextRequest, NextResponse } from "next/server";
import { syncContactsForPlaybook } from "~/app/_actions/contactActions";

// POST /api/contacts/sync - Sync contacts for a playbook (morning routine)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playbookId, agentId } = body;

    if (!playbookId || !agentId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: playbookId and agentId',
        },
        { status: 400 }
      );
    }

    console.log('Starting contact sync:', { playbookId, agentId });

    const result = await syncContactsForPlaybook(playbookId, agentId);

    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error syncing contacts:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to sync contacts',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 