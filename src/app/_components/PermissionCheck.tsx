'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getUserRoles } from '~/server/rbac/queries';

interface PermissionCheckProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export default function PermissionCheck({ children, allowedRoles }: PermissionCheckProps) {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // async function checkPermissions() {
    //   if (!isLoaded) return;

    //   if (!userId) {
    //     router.push('/sign-in');
    //     return;
    //   }

    //   console.log('User ID:', userId);

    //   try {
    //     const userRoles = await getUserRoles();
    //     const hasPermission = userRoles.some(role => allowedRoles.includes(role.roleName));
        
    //     if (!hasPermission) {
    //       router.push('/not-found');
    //       return;
    //     }

    //     setIsAuthorized(true);
    //   } catch (error) {
    //     console.error('Error checking permissions:', error);
    //     router.push('/not-found');
    //   } finally {
    //     setIsLoading(false);
    //   }
    // }

    // void checkPermissions();
  }, [userId, isLoaded, router, allowedRoles]);

  // if (isLoading) {
    // return (
    //   <div className="min-h-screen flex items-center justify-center">
    //     <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    //   </div>
    // );
  // }

  // if (!isAuthorized) {
  //   return null;
  // }

  return <>{children}</>;
} 