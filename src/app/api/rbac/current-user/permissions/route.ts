// src/app/api/rbac/current-user/permissions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserPermissions, getUserRoles } from "~/server/rbac/queries";

export async function GET() {
  try {
    const user = await auth();
    
    if (!user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const [permissions, roles] = await Promise.all([
      getUserPermissions(user.userId),
      getUserRoles(user.userId)
    ]);
    
    return NextResponse.json({
      userId: user.userId,
      permissions,
      roles
    });
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return NextResponse.json({ error: "Failed to get user permissions" }, { status: 500 });
  }
}