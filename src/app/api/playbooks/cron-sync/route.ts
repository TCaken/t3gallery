import { NextResponse } from 'next/server';
import { cronSyncPlaybooks } from '~/app/_actions/playbookManagement';

// POST /api/playbooks/cron-sync - Cron job to sync all playbooks
export async function POST() {
  try {
    console.log('Cron sync API called');
    
    const result = await cronSyncPlaybooks();
    const status = result.success ? 200 : 400;
    
    console.log('Cron sync result:', result.message);
    return NextResponse.json(result, { status });

  } catch (error) {
    console.error('Error in cron sync:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to run cron sync',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 