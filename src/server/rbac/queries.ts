// src/server/rbac/utils.ts
"use server"

import { db } from "~/server/db";
import { eq, and } from "drizzle-orm";
import { permissions, roles, rolePermissions, userRoles } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";

// Check if a user has a specific permission
export async function hasPermission(permissionName: string): Promise<boolean> {
  const user = await auth();
  if (!user.userId) return false;

  const result = await db
    .select()
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userRoles.userId, user.userId),
        eq(permissions.name, permissionName)
      )
    );

  return result.length > 0;
}

// Get all permissions for a user
export async function getUserPermissions(): Promise<string[]> {
  const user = await auth();
  if (!user.userId) return [];

  const result = await db
    .select({ name: permissions.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, user.userId));
    
  return result.map(row => row.name);
}

// Get all roles for a user
export async function getUserRoles() {
  const user = await auth();
  if (!user.userId) return [];

  const result = await db
    .select({
      roleId: userRoles.roleId,
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.userId));
    
  return result;
}

// Assign a role to a user
export async function assignRoleToUser(userId: string, roleId: number) {
  try {
    await db.insert(userRoles).values({ userId, roleId });
    return true;
  } catch (error) {
    console.error("Error assigning role to user:", error);
    return false;
  }
}

// Create a new role
export async function createRole(name: string, description?: string) {
  try {
    const [newRole] = await db.insert(roles)
      .values({ name, description })
      .returning();
    return newRole;
  } catch (error) {
    console.error("Error creating role:", error);
    return null;
  }
}

// Create a new permission
export async function createPermission(name: string, description?: string) {
  try {
    const [newPermission] = await db.insert(permissions)
      .values({ name, description })
      .returning();
    return newPermission;
  } catch (error) {
    console.error("Error creating permission:", error);
    return null;
  }
}

// Assign a permission to a role
export async function assignPermissionToRole(roleId: number, permissionId: number) {
  try {
    await db.insert(rolePermissions).values({ roleId, permissionId });
    return true;
  } catch (error) {
    console.error("Error assigning permission to role:", error);
    return false;
  }
}

// Check if user has a specific role
export async function hasRole(roleName: string): Promise<boolean> {
  const user = await auth();
  if (!user.userId) return false;

  const result = await db
    .select()
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        eq(userRoles.userId, user.userId),
        eq(roles.name, roleName)
      )
    );

  return result.length > 0;
}