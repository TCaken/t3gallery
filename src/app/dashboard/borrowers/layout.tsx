'use client';

import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { fetchUserData } from '~/app/_actions/userActions';
import { UserRoleContext } from '../leads/useUserRole';
import type { UserRole, UserRoleContextType } from '../leads/useUserRole';

interface BorrowersLayoutProps {
  children: React.ReactNode;
}

// User role provider component
function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isLoadingUserRole, setIsLoadingUserRole] = useState(true);
  const { userId, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const loadUserRole = async () => {
      if (!isLoaded) return;

      if (!userId) {
        router.push('/sign-in');
        return;
      }

      try {
        const { roles } = await fetchUserData();
        
        if (roles && roles.length > 0) {
          const roleName = roles[0]?.roleName ?? 'user';
          
          // Check if user has required permissions for borrowers section
          const allowedRoles: UserRole[] = ['admin', 'agent'];
          if (!allowedRoles.includes(roleName as UserRole)) {
            router.push('/dashboard'); // Redirect to main dashboard
            return;
          }
          
          setUserRole(roleName as UserRole);
        } else {
          // If no roles found, redirect to main dashboard
          router.push('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Error loading user role:', error);
        router.push('/dashboard');
        return;
      } finally {
        setIsLoadingUserRole(false);
      }
    };

    void loadUserRole();
  }, [userId, isLoaded, router]);

  const hasRole = (role: UserRole): boolean => {
    return userRole === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.includes(userRole);
  };

  if (isLoadingUserRole) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const contextValue: UserRoleContextType = {
    userRole,
    isLoadingUserRole,
    hasRole,
    hasAnyRole,
  };

  return (
    <UserRoleContext.Provider value={contextValue}>
      {children}
    </UserRoleContext.Provider>
  );
}

export default function BorrowersLayout({ children }: BorrowersLayoutProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <UserRoleProvider>
        {children}
      </UserRoleProvider>
    </Suspense>
  );
} 