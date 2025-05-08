import { NextResponse } from 'next/server';
import { db } from '~/server/db';
import { roles, userRoles, users } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';

// Hardcoded user ID for the agent
const AGENT_USER_ID = 'user_2w6ph5gT8w9TTmFNTAPKgMnvaQT'
export async function GET(req: Request) {
  try {
    // Get the agent role ID
    const agentRole = await db.select()
      .from(roles)
      .where(eq(roles.name, 'agent'))
      .limit(1);

    if (!agentRole[0]) {
      return NextResponse.json({ error: 'Agent role not found' }, { status: 404 });
    }

    const agentRoleId = agentRole[0].id;

    // Check if user exists in the users table
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, AGENT_USER_ID))
      .limit(1);

    if (existingUser.length === 0) {
      // Create user record if it doesn't exist
      await db.insert(users).values({
        id: AGENT_USER_ID,
        role: 'agent',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Check if user already has the agent role
    const existingRole = await db.select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, AGENT_USER_ID),
          eq(userRoles.roleId, agentRoleId)
        )
      )
      .limit(1);

    if (existingRole.length === 0) {
      // Assign the agent role
      await db.insert(userRoles).values({
        userId: AGENT_USER_ID,
        roleId: agentRoleId
      });
      return NextResponse.json({ 
        message: 'Agent role assigned successfully',
        data: {
          userId: AGENT_USER_ID,
          roleAssigned: true
        }
      });
    } else {
      return NextResponse.json({ 
        message: 'User already has agent role',
        data: {
          userId: AGENT_USER_ID,
          roleAssigned: false
        }
      });
    }
  } catch (error) {
    console.error('Error assigning agent role:', error);
    return NextResponse.json({ error: 'Failed to assign agent role' }, { status: 500 });
  }
} 