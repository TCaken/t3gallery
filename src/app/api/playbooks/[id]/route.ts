import { NextRequest, NextResponse } from "next/server";
import { startPlaybook, stopPlaybook, deletePlaybook } from "~/app/_actions/playbookManagement";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// DELETE /api/playbooks/[id] - Delete a playbook
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const playbookId = parseInt(id);

    if (isNaN(playbookId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid playbook ID',
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

// POST /api/playbooks/[id] - Start or stop a playbook based on action in body
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const playbookId = parseInt(id);
    const body = await request.json();
    const { action } = body;

    if (isNaN(playbookId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid playbook ID',
        },
        { status: 400 }
      );
    }

    let result;

    if (action === 'start') {
      result = await startPlaybook(playbookId);
    } else if (action === 'stop') {
      result = await stopPlaybook(playbookId);
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid action. Use "start" or "stop"',
        },
        { status: 400 }
      );
    }

    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error with playbook action:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to perform playbook action',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 