import { NextResponse } from 'next/server';
import { stopAllPlaybooks } from '~/app/_actions/playbookManagement';

// POST /api/playbooks/stop-all - Stop all running playbooks
export async function POST() {
  try {
    console.log('Stop all playbooks API called');
    
    const result = await stopAllPlaybooks();
    const status = result.success ? 200 : 400;
    
    console.log('Stop all result:', result.message);
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error stopping all playbooks:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to stop all playbooks',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 