'use server';

import { getUserPermissions, getUserRoles } from '~/server/rbac/queries';

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