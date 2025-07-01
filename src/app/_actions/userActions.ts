'use server';

import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { users, userRoles, roles } from "~/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
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

// Enhanced fetchUsers function with optional role filtering
export async function fetchUsers(roleNames?: string[]) {
  try {
    let query;
    
    if (roleNames && roleNames.length > 0) {
      // Fetch users with specific roles
      query = db.query.users.findMany({
        with: {
          roles: {
            with: {
              role: true
            },
            where: (userRole, { exists }) => 
              exists(
                db.select()
                  .from(roles)
                  .where(
                    and(
                      eq(roles.id, userRole.roleId),
                      inArray(roles.name, roleNames)
                    )
                  )
              )
          }
        }
      });
    } else {
      // Fetch all users (original behavior)
      query = db.query.users.findMany({
        with: {
          roles: {
            with: {
              role: true
            }
          }
        }
      });
    }

    const usersResult = await query;
    
    // Filter users to only include those with the requested roles
    const filteredUsers = roleNames && roleNames.length > 0
      ? usersResult.filter(user => 
          user.roles.some(userRole => 
            roleNames.includes(userRole.role.name)
          )
        )
      : usersResult;

    console.log(`✅ Fetched ${filteredUsers.length} users${roleNames ? ` with roles: ${roleNames.join(', ')}` : ''}`);
    
    return { 
      success: true, 
      users: filteredUsers.map(user => ({
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

// Convenience function to fetch only agents
export async function fetchAgents() {
  return fetchUsers(['agent']);
}

export async function fetchAgentReloan() {
  return fetchUsers(['agent-reloan']);
}

// Convenience function to fetch only admins  
export async function fetchAdmins() {
  return fetchUsers(['admin']);
}