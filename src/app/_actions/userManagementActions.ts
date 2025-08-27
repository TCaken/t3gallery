'use server';

import { db } from "~/server/db";
import { users, roles, userRoles } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

// Get all users with their roles
export async function getAllUsers() {
  try {
    const allUsers = await db.select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      email: users.email,
      weight: users.weight,
      roleId: userRoles.roleId,
      roleName: roles.name,
      roleDescription: roles.description
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id));

    // console.log('allUsers:', allUsers);

    // Group users and their roles
    const userMap = new Map();
    allUsers.forEach((row) => {
      if (!userMap.has(row.id)) {
        userMap.set(row.id, {
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          weight: row.weight,
          roles: []
        });
      }
      if (row.roleId) {
        userMap.get(row.id).roles.push({
          role: {
            id: row.roleId,
            name: row.roleName,
            description: row.roleDescription
          }
        });
      }
    });

    return { success: true, users: Array.from(userMap.values()) };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

// Get all available roles
export async function getAllRoles() {
  try {
    const allRoles = await db.select({
      id: roles.id,
      name: roles.name,
      description: roles.description
    }).from(roles);
    
    return { success: true, roles: allRoles };
  } catch (error) {
    console.error('Error fetching roles:', error);
    return { success: false, error: 'Failed to fetch roles' };
  }
}

// Assign a role to a user
export async function assignRoleToUser(userId: string, roleId: number) {
  try {
    // Check if the role is already assigned
    const existingRole = await db.select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId)
        )
      );

    if (existingRole.length > 0) {
      return { success: true }; // Role already assigned
    }

    await db.insert(userRoles).values({
      userId,
      roleId
    });
    return { success: true };
  } catch (error) {
    console.error('Error assigning role:', error);
    return { success: false, error: 'Failed to assign role' };
  }
}

// Get user by ID with full details
export async function getUserById(userId: string) {
  try {
    const user = await db.select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      email: users.email,
      role: users.role,
      team: users.team,
      weight: users.weight,
      status: users.status,
      created_at: users.created_at,
      updated_at: users.updated_at
    })
    .from(users)
    .where(eq(users.id, userId));

    if (user.length === 0) {
      return { success: false, error: 'User not found' };
    }

    return { success: true, user: user[0] };
  } catch (error) {
    console.error('Error fetching user:', error);
    return { success: false, error: 'Failed to fetch user' };
  }
}

// Update user weight for lead distribution
export async function updateUserWeight(userId: string, weight: number) {
  try {
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Validate weight
    if (weight < 0 || !Number.isInteger(weight)) {
      return { success: false, error: 'Weight must be a non-negative integer' };
    }

    await db
      .update(users)
      .set({
        weight: weight,
        updated_at: new Date(),
        updated_by: currentUserId
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Error updating user weight:', error);
    return { success: false, error: 'Failed to update user weight' };
  }
}

// Remove a role from a user
export async function removeRoleFromUser(userId: string, roleId: number) {
  try {
    await db.delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId)
        )
      );
    return { success: true };
  } catch (error) {
    console.error('Error removing role:', error);
    return { success: false, error: 'Failed to remove role' };
  }
}

// Get user's current roles
export async function getUserRoles(userId: string) {
  try {
    const userRolesList = await db.select({
      roleId: userRoles.roleId,
      role: {
        id: roles.id,
        name: roles.name,
        description: roles.description
      }
    })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

    return { success: true, roles: userRolesList };
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return { success: false, error: 'Failed to fetch user roles' };
  }
} 