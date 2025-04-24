"use client"

import { useState, useEffect } from 'react';
import { useAuth, UserButton } from '@clerk/nextjs';
import { fetchUserData } from '../_actions/userActions';

export default function RbacTestPage() {
  const { userId, isLoaded } = useAuth();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<{roleId: number, roleName: string}[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserPermissions = async () => {
    try {
      const {permissions, roles } = await fetchUserData();
      setUserPermissions(permissions);
      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && userId) {
      void fetchUserPermissions();
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [isLoaded, userId]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!userId) {
    return <div className="p-4">Please sign in to see your permissions</div>;
  }

  const hasPermission = (permission: string) => userPermissions.includes(permission);
  const hasRole = (role: string) => userRoles.some(r => r.roleName === role);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">RBAC Test Page</h1>
        <UserButton />
      </div>

      <div className="bg-gray-100 p-4 mb-6 rounded">
        <h2 className="text-lg font-semibold mb-2">Your Roles:</h2>
        {userRoles.length > 0 ? (
          <ul className="list-disc pl-5">
            {userRoles.map(role => (
              <li key={role.roleId}>{role.roleName}</li>
            ))}
          </ul>
        ) : (
          <p>No roles assigned</p>
        )}

        <h2 className="text-lg font-semibold mt-4 mb-2">Your Permissions:</h2>
        {userPermissions.length > 0 ? (
          <ul className="list-disc pl-5">
            {userPermissions.map(permission => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        ) : (
          <p>No permissions assigned</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Admin Section */}
        <div className="p-4 border rounded">
          <h2 className="text-xl font-bold mb-2">Admin Section</h2>
          {hasRole('admin') ? (
            <div className="bg-green-100 p-2 rounded">
              <p>You have admin access!</p>
              <div className="mt-2">
                {hasPermission('manage_users') && (
                  <div className="bg-blue-100 p-2 mb-2 rounded">User Management Panel</div>
                )}
                {hasPermission('manage_roles') && (
                  <div className="bg-purple-100 p-2 mb-2 rounded">Role Management Panel</div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-100 p-2 rounded">You don't have admin access</div>
          )}
        </div>

        {/* Agent Section */}
        <div className="p-4 border rounded">
          <h2 className="text-xl font-bold mb-2">Agent Section</h2>
          {hasRole('agent') || hasRole('admin') ? (
            <div className="bg-green-100 p-2 rounded">
              <p>You have agent access!</p>
              <div className="mt-2">
                {hasPermission('view_reports') && (
                  <div className="bg-blue-100 p-2 mb-2 rounded">Reports Dashboard</div>
                )}
                {hasPermission('create_orders') && (
                  <div className="bg-purple-100 p-2 mb-2 rounded">Create Order Form</div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-100 p-2 rounded">You don't have agent access</div>
          )}
        </div>

        {/* Retail Section */}
        <div className="p-4 border rounded">
          <h2 className="text-xl font-bold mb-2">Retail Section</h2>
          {hasRole('retail') || hasRole('admin') || hasRole('agent') ? (
            <div className="bg-green-100 p-2 rounded">
              <p>You have retail access!</p>
              <div className="mt-2">
                {hasPermission('view_products') && (
                  <div className="bg-blue-100 p-2 mb-2 rounded">Product Catalog</div>
                )}
                {hasPermission('checkout') && (
                  <div className="bg-purple-100 p-2 mb-2 rounded">Checkout</div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-100 p-2 rounded">You don't have retail access</div>
          )}
        </div>
      </div>

      {/* Admin Tools - Only visible to admins */}
      {hasPermission('manage_users') && (
        <div className="mt-6 p-4 border rounded">
          <h2 className="text-xl font-bold mb-4">Admin Tools</h2>
          
          <button 
            onClick={async () => {
              try {
                const response = await fetch('/api/rbac/init', {
                  method: 'POST',
                });
                const data = await response.json();
                alert(data.message || 'RBAC initialized successfully');
              } catch (error) {
                console.error('Error initializing RBAC:', error);
                alert('Failed to initialize RBAC');
              }
            }}
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Initialize RBAC System
          </button>
        </div>
      )}
    </div>
  );
}
