import { NextResponse } from 'next/server';
import { db } from '~/server/db';
import { autoAssignmentSettings, checkedInAgents } from '~/server/db/schema';
import { eq, and, sql, asc } from 'drizzle-orm';
import { autoAssignLeads } from '~/app/_actions/agentActions';

/**
 * API endpoint to enable auto-assignment
 * POST /api/auto-assignment/start
 */
export async function POST(request: Request) {
  try {
    // Check for CRON_SECRET authorization (for Vercel cron jobs)
    // const authHeader = request.headers.get('Authorization');
    // const cronSecret = process.env.CRON_SECRET;
    
    // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //   return NextResponse.json(
    //     { success: false, message: "Unauthorized: Invalid CRON_SECRET" },
    //     { status: 401 }
    //   );
    // }

    // Parse request body
    // const body = await request.json();

    // Get current settings
    const currentSettings = await db.query.autoAssignmentSettings.findFirst({
      orderBy: (table, { desc }) => [desc(table.id)]
    });

    if (!currentSettings) {
      // Create default settings if none exist
      const newSettings = await db.insert(autoAssignmentSettings).values({
        is_enabled: true,
        assignment_method: 'round_robin',
        current_round_robin_index: 0,
        max_leads_per_agent_per_day: 500,
        updated_at: new Date(),
        updated_by: 'api'
      }).returning();

      return NextResponse.json({
        success: true,
        message: "Auto-assignment enabled successfully (created new settings)",
        settings: newSettings[0]
      });
    }

    // Check if there are any checked-in agents for today
    const checkedInAgentsList = await db.query.checkedInAgents.findMany({
      where: and(
        eq(checkedInAgents.checked_in_date, sql`CURRENT_DATE`),
        eq(checkedInAgents.is_active, true)
      ),
      with: {
        agent: true
      },
      orderBy: [asc(checkedInAgents.id)]
    });

    if (checkedInAgentsList.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No agents are checked in today. Auto-assignment cannot proceed."
      }, { status: 400 });
    }

    // Update existing settings to enable auto-assignment
    const updatedSettings = await db
      .update(autoAssignmentSettings)
      .set({
        is_enabled: true,
        updated_at: new Date(),
        updated_by: 'api'
      })
      .where(eq(autoAssignmentSettings.id, currentSettings.id))
      .returning();

    // Trigger auto-assignment of leads with API key
    const autoAssignResult = await autoAssignLeads(process.env.AUTO_ASSIGNMENT_API_KEY);

    return NextResponse.json({
      success: true,
      message: "Auto-assignment enabled successfully and leads assigned",
      settings: updatedSettings[0],
      autoAssignResult: autoAssignResult
    });

  } catch (error) {
    console.error('Error enabling auto-assignment:', error);
    return NextResponse.json(
      { success: false, message: `Error enabling auto-assignment: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 