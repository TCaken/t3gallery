import { NextRequest, NextResponse } from 'next/server';
import { registerPlaybook, getAllPlaybooks, deletePlaybook } from '~/app/_actions/playbookManagement';


// GET /api/playbooks - Get all playbooks
export async function GET() {
  try {
    const result = await getAllPlaybooks();
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error('Error fetching playbooks:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch playbooks',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/playbooks - Register a new playbook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { samespacePlaybookId, name, agentId } = body;

    if (!samespacePlaybookId || !name || !agentId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: samespacePlaybookId, name, agentId',
        },
        { status: 400 }
      );
    }

    const result = await registerPlaybook(samespacePlaybookId, name, agentId);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error registering playbook:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to register playbook',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/playbooks - Delete a playbook
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { playbookId } = body;

    if (!playbookId || typeof playbookId !== 'number') {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing or invalid playbookId',
        },
        { status: 400 }
      );
    }

    const result = await deletePlaybook(playbookId);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error deleting playbook:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete playbook',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 