import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { 
  createRole, 
  createPermission, 
  assignPermissionToRole, 
  assignRoleToUser 
} from "~/server/rbac/queries";
import { createOrUpdateUser } from "~/server/db/queries";

export async function GET() {
  try {
    const user = await auth();
    
    if (!user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Create/update user in our database
    const dbUser = await createOrUpdateUser(
      user.userId,
      "",
      "",
      ""
    );
    
    if (!dbUser) {
      return NextResponse.json({ error: "Failed to create user record" }, { status: 500 });
    }
    
    // Create your specific roles
    const adminRole = await createRole("admin", "Full system access");
    const agentRole = await createRole("agent", "Sales agent with customer management");
    const retailRole = await createRole("retail", "Retail user with limited access");
    
    // Create permissions based on your business logic
    const viewDashboard = await createPermission("view_dashboard", "Can view dashboard");
    const manageUsers = await createPermission("manage_users", "Can manage users");
    const manageRoles = await createPermission("manage_roles", "Can manage roles");
    const viewReports = await createPermission("view_reports", "Can view reports");
    const createOrders = await createPermission("create_orders", "Can create orders");
    const manageProducts = await createPermission("manage_products", "Can manage products");
    const viewProducts = await createPermission("view_products", "Can view products");
    const checkout = await createPermission("checkout", "Can checkout products");
    
    // Also add lead-specific permissions
    const viewLeads = await createPermission("view_leads", "Can view leads");
    const addLeads = await createPermission("add_leads", "Can add new leads");
    const editLeads = await createPermission("edit_leads", "Can edit leads");
    const deleteLeads = await createPermission("delete_leads", "Can delete leads");
    const changeLeadStatus = await createPermission("change_lead_status", "Can change lead status");
    const assignLeads = await createPermission("assign_leads", "Can assign leads to users");
    
    // Admin permissions - full access
    await assignPermissionToRole(adminRole!.id, viewDashboard!.id);
    await assignPermissionToRole(adminRole!.id, manageUsers!.id);
    await assignPermissionToRole(adminRole!.id, manageRoles!.id);
    await assignPermissionToRole(adminRole!.id, viewReports!.id);
    await assignPermissionToRole(adminRole!.id, createOrders!.id);
    await assignPermissionToRole(adminRole!.id, manageProducts!.id);
    await assignPermissionToRole(adminRole!.id, viewProducts!.id);
    await assignPermissionToRole(adminRole!.id, checkout!.id);
    await assignPermissionToRole(adminRole!.id, viewLeads!.id);
    await assignPermissionToRole(adminRole!.id, addLeads!.id);
    await assignPermissionToRole(adminRole!.id, editLeads!.id);
    await assignPermissionToRole(adminRole!.id, deleteLeads!.id);
    await assignPermissionToRole(adminRole!.id, changeLeadStatus!.id);
    await assignPermissionToRole(adminRole!.id, assignLeads!.id);
    
    // Agent permissions
    await assignPermissionToRole(agentRole!.id, viewDashboard!.id);
    await assignPermissionToRole(agentRole!.id, viewReports!.id);
    await assignPermissionToRole(agentRole!.id, createOrders!.id);
    await assignPermissionToRole(agentRole!.id, viewProducts!.id);
    await assignPermissionToRole(agentRole!.id, viewLeads!.id);
    await assignPermissionToRole(agentRole!.id, addLeads!.id);
    await assignPermissionToRole(agentRole!.id, editLeads!.id);
    await assignPermissionToRole(agentRole!.id, changeLeadStatus!.id);
    
    // Retail permissions
    await assignPermissionToRole(retailRole!.id, viewProducts!.id);
    await assignPermissionToRole(retailRole!.id, checkout!.id);
    
    // Make the initializing user an admin
    await assignRoleToUser(user.userId, adminRole!.id);
    
    return NextResponse.json({ 
      success: true, 
      message: "RBAC system initialized with admin, agent, and retail roles",
      data: {
        user: dbUser,
        roles: [adminRole, agentRole, retailRole]
      }
    });
  } catch (error) {
    console.error("Failed to initialize RBAC system:", error);
    return NextResponse.json({ 
      error: "Failed to initialize RBAC system", 
      details: String(error) 
    }, { status: 500 });
  }
}
