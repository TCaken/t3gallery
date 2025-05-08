"use client";

import { useEffect, useState, Suspense } from "react";
import PermissionCheck from '~/app/_components/PermissionCheck';
import SideNav from "~/app/_components/sidenav";
import TopNav from "~/app/_components/topnav";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [expanded, setExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const checkIfMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setExpanded(false);
      } else {
        setExpanded(true);
      }
    };

    // Check on initial load
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener("resize", checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile overlay when sidebar is open */}
      {isMobile && expanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Sidebar */}
      <SideNav expanded={expanded} setExpanded={setExpanded} />
      
      {/* Main content */}
      <div 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          expanded ? (isMobile ? "ml-0" : "ml-64") : "ml-20"
        }`}
      >
        <TopNav expanded={expanded} setExpanded={setExpanded} isMobile={isMobile} />
        <main className="p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          }>
            <PermissionCheck allowedRoles={['admin', 'agent', 'retail']}>
              {children}
            </PermissionCheck>
          </Suspense>
        </main>
      </div>
    </div>
  );
} 