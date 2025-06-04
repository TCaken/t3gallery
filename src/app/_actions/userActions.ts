'use server';

import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { users, userRoles, roles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { getUserPermissions, getUserRoles } from '~/server/rbac/queries';

export async function getCurrentUserId() {
  const { userId } = await auth();
  console.log('Current User ID:', userId);
  return userId ?? null;
}

export async function assignAgentRole(userId: string) {
  try {
    // First, get the agent role ID
    const agentRole = await db.select()
      .from(roles)
      .where(eq(roles.name, 'agent'))
      .limit(1);

    if (agentRole.length === 0) {
      throw new Error('Agent role not found');
    }

    const agentRoleId = agentRole[0].id;

    // Check if user already has the agent role
    const existingRole = await db.select()
      .from(userRoles)
      .where(
        eq(userRoles.userId, userId) && eq(userRoles.roleId, agentRoleId)
      )
      .limit(1);

    if (existingRole.length === 0) {
      // Assign the agent role
      await db.insert(userRoles).values({
        userId,
        roleId: agentRoleId
      });
      console.log(`Successfully assigned agent role to user ${userId}`);
      return { success: true, message: 'Agent role assigned successfully' };
    } else {
      console.log(`User ${userId} already has agent role`);
      return { success: true, message: 'User already has agent role' };
    }
  } catch (error) {
    console.error('Error assigning agent role:', error);
    return { success: false, error: 'Failed to assign agent role' };
  }
}

export async function fetchUserData() {
  try {
    const permissions = await getUserPermissions();
    const roles = await getUserRoles();
    return { permissions, roles };
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw new Error('Failed to fetch user data');
  }
}

// Add fetchUsers function to retrieve user list
export async function fetchUsers() {
  try {
    const users = await db.query.users.findMany({
      with: {
        roles: {
          with: {
            role: true
          }
        }
      }
    });
    // console.log('fetchUsers users:', users);
    
    return { 
      success: true, 
      users: users.map(user => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        roles: user.roles.map(role => ({
          id: role.role.id,
          roleName: role.role.name
        }))
      }))
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false, users: [] };
  }
}