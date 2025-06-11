'use client';

import { useContext, createContext } from 'react';

// Define user role type
export type UserRole = 'admin' | 'agent' | 'retail' | 'user';

// Create context for user role
export interface UserRoleContextType {
  userRole: UserRole;
  isLoadingUserRole: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

export const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

// Custom hook to use the user role context
export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}; 