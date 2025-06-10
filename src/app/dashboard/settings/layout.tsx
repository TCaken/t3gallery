import { Suspense } from 'react';
import PermissionCheck from '~/app/_components/PermissionCheck';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <PermissionCheck allowedRoles={['admin']}>
        {children}
      </PermissionCheck>
    </Suspense>
  );
} 