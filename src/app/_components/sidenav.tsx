"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Use Heroicons
import { 
  HomeIcon, 
  UsersIcon, 
  ChartBarIcon, 
  Cog6ToothIcon, 
  DocumentTextIcon,
  Bars3Icon,
  ChevronLeftIcon,
  CalendarIcon,
  ShoppingBagIcon
} from "@heroicons/react/24/outline";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

interface SideNavProps {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

export default function SideNav({ expanded, setExpanded }: SideNavProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <HomeIcon className="h-5 w-5" />
    },
    {
      title: "Leads",
      href: "/dashboard/leads",
      icon: <UsersIcon className="h-5 w-5" />
    },
    {
      title: "Appointments",
      href: "/dashboard/appointments",
      icon: <CalendarIcon className="h-5 w-5" />
    },
    // {
    //   title: "Analytics",
    //   href: "/dashboard/analytics",
    //   icon: <ChartBarIcon className="h-5 w-5" />
    // },
    // {
    //   title: "Reports",
    //   href: "/dashboard/reports",
    //   icon: <DocumentTextIcon className="h-5 w-5" />
    // },
    {
      title: "Retail",
      href: "/dashboard/retail",
      icon: <ShoppingBagIcon className="h-5 w-5" />
    }
  ];

  return (
    <aside className={`${expanded ? "w-64" : "w-20"} h-screen bg-gray-800 text-white p-4 transition-all duration-300 ease-in-out fixed left-0 top-0 z-10`}>
      <div className="flex justify-between items-center mb-8">
        {expanded && <h1 className="text-xl font-bold">AirConnect</h1>}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          {expanded ? <ChevronLeftIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
        </button>
      </div>
      
      <div className="space-y-2">
        {navItems.map((item) => {
          // Check if current path starts with the nav item path for active state
          // This allows sub-pages to highlight the parent nav item
          const isActive = pathname === item.href || 
            (pathname.startsWith(item.href) && item.href !== "/dashboard");
            
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center p-3 rounded-lg transition-colors ${
                isActive 
                  ? "bg-gray-700 text-white" 
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <div className="flex items-center flex-shrink-0">
                {item.icon}
              </div>
              {expanded && (
                <span className="ml-3 text-sm font-medium">{item.title}</span>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
