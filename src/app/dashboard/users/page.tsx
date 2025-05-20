"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { 
  getAllUsers, 
  getAllRoles, 
  assignRoleToUser, 
  removeRoleFromUser 
} from '~/app/_actions/userManagementActions';
import { UserButton } from '@clerk/nextjs';

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  roles: Array<{
    role: {
      id: number;
      name: string;
      description: string | null;
    };
  }>;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
}

export default function UserManagementPage() {
  const { userId } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersResult, rolesResult] = await Promise.all([
          getAllUsers(),
          getAllRoles()
        ]);

        console.log('usersResult:', usersResult);
        console.log('rolesResult:', rolesResult);

        if (usersResult.success && rolesResult.success) {
          setUsers(usersResult.users as User[]);
          setRoles(rolesResult.roles as Role[]);
        } else {
          setError('Failed to load data');
        }
      } catch (err) {
        setError('An error occurred while loading data');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleRoleToggle = async (userId: string, roleId: number, currentRoles: Array<{ role: { id: number } }>) => {
    const hasRole = currentRoles.some(r => r.role.id === roleId);
    
    try {
      if (hasRole) {
        const result = await removeRoleFromUser(userId, roleId);
        if (result.success) {
          setUsers(users.map(user => {
            if (user.id === userId) {
              return {
                ...user,
                roles: user.roles.filter(r => r.role.id !== roleId)
              };
            }
            return user;
          }));
        }
      } else {
        const result = await assignRoleToUser(userId, roleId);
        if (result.success) {
          const role = roles.find(r => r.id === roleId);
          if (role) {
            setUsers(users.map(user => {
              if (user.id === userId) {
                return {
                  ...user,
                  roles: [...user.roles, { role }]
                };
              }
              return user;
            }));
          }
        }
      }
    } catch (err) {
      console.error('Error toggling role:', err);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-red-600">Error</h2>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <UserButton />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map(({ role }) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex flex-col gap-2">
                    {roles.map((role) => {
                      const hasRole = user.roles.some(r => r.role.id === role.id);
                      return (
                        <button
                          key={role.id}
                          onClick={() => handleRoleToggle(user.id, role.id, user.roles)}
                          className={`px-3 py-1 rounded text-sm ${
                            hasRole
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {hasRole ? `Remove ${role.name}` : `Add ${role.name}`}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 