import { NextRequest, NextResponse } from 'next/server';
import { registerPlaybook, getAllPlaybooks, deletePlaybook, createBorrowerPlaybook, syncBorrowerPlaybookContacts } from '~/app/_actions/playbookManagement';

interface BorrowerFilters {
  status?: string;
  aa_status?: string;
  performance_bucket?: string;
  source?: string;
  assigned_filter?: string;
  limit?: number;
}

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

// POST /api/playbooks - Register a new playbook or create borrower playbook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as any;
    
    // Check if this is a borrower playbook creation
    if (body.type === 'borrower') {
      const name = body.name as string;
      const agentId = body.agentId as string;
      const borrowerFilters = (body.borrowerFilters || {}) as BorrowerFilters;
      const callScript = body.callScript as string | undefined;
      const timesetId = body.timesetId as string | undefined;
      const teamId = body.teamId as string | undefined;

      const result = await createBorrowerPlaybook(
        name,
        agentId,
        borrowerFilters,
        callScript,
        timesetId,
        teamId
      );
      
      return NextResponse.json(result);
    }
    
    // Register existing borrower playbook with filters
    if (body.type === 'borrower_register') {
      const samespacePlaybookId = body.samespacePlaybookId as string;
      const name = body.name as string;
      const agentId = body.agentId as string;
      const borrowerFilters = (body.borrowerFilters || {}) as BorrowerFilters;
      
      if (!samespacePlaybookId || !name || !agentId) {
        return NextResponse.json({
          success: false,
          message: 'Missing required fields: samespacePlaybookId, name, agentId',
        }, { status: 400 });
      }

      // First register the playbook
      const registerResult = await registerPlaybook(samespacePlaybookId, name, agentId);
      
      if (!registerResult.success) {
        return NextResponse.json(registerResult);
      }

      // If filters are provided, we could store them for future syncing
      // For now, just return the registration result
      return NextResponse.json({
        ...registerResult,
        message: `Borrower playbook registered successfully. Use sync to add contacts with filters.`,
        data: { ...registerResult.data, borrowerFilters }
      });
    }
    
    // Regular lead playbook registration
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

// POST /api/playbooks/sync - Sync borrower playbook contacts
export async function SYNC(request: NextRequest) {
  try {
    const body = await request.json() as any;
    const playbookId = body.playbookId as number;
    const borrowerFilters = (body.borrowerFilters || {}) as BorrowerFilters;

    if (!playbookId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing playbookId',
        },
        { status: 400 }
      );
    }

    const result = await syncBorrowerPlaybookContacts(playbookId, borrowerFilters);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error syncing borrower playbook contacts:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to sync borrower playbook contacts',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 