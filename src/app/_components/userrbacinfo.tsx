import { auth } from "@clerk/nextjs/server";

export const dynamic = 'force-dynamic';

export default async function UserRbacInfo() {
  const user = await auth();
  if (!user.userId) {
    return null;
  }
  const permissions = await getUserPermissions(user.userId);
  const roles = await getUserRoles(user.userId);
  return (
    <div>
      <h3 className="text-xl">User RBAC Info</h3>
    </div>
  );
}
