import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

// GET /api/agents - Get all active agents
export async function GET() {
  try {
    const agents = await db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        email: users.email,
        role: users.role,
        team: users.team,
        status: users.status,
      })
      .from(users)
      .where(eq(users.status, 'active'))
      .orderBy(users.first_name);

    return NextResponse.json({
      success: true,
      message: `Found ${agents.length} agents`,
      data: agents,
    });

  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch agents',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 