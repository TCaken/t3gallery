import { NextRequest, NextResponse } from 'next/server';
import { startPlaybook } from '~/app/_actions/playbookManagement';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playbookId = parseInt(params.id);
    
    if (isNaN(playbookId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid playbook ID',
        },
        { status: 400 }
      );
    }

    const result = await startPlaybook(playbookId);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error starting playbook:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to start playbook',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 