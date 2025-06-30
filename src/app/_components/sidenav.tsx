"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { fetchUserData } from "~/app/_actions/userActions";

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
  ShoppingBagIcon,
  UserGroupIcon,
  BookOpenIcon,
  PhoneIcon
} from "@heroicons/react/24/solid";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles: string[]; // Add roles that can access this item
}

interface SideNavProps {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

export default function SideNav({ expanded, setExpanded }: SideNavProps) {
  const pathname = usePathname();
  const { userId, isLoaded } = useAuth();
  const [userRoles, setUserRoles] = useState<{roleId: number, roleName: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      if (isLoaded && userId) {
        try {
          const { roles } = await fetchUserData();
          setUserRoles(roles);
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setLoading(false);
        }
      } else if (isLoaded) {
        setLoading(false);
      }
    };

    void loadUserData();
  }, [isLoaded, userId]);

  const navItems: NavItem[] = [
    // {
    //   title: "Dashboard",
    //   href: "/dashboard",
    //   icon: <HomeIcon className="h-5 w-5" />,
    //   roles: ["admin", "agent", "retail"] // All roles can access dashboard
    // },
    {
      title: "Leads",
      href: "/dashboard/leads",
      icon: <UsersIcon className="h-5 w-5" />,
      roles: ["admin", "agent"] // Only admin and agent can access leads
    },
    {
      title: "Duplicate Phone Numbers",
      href: "/dashboard/leads/duplicates",
      icon: <PhoneIcon className="h-5 w-5" />,
      roles: ["admin", "agent"] // Only admin and agent can access duplicate detection
    },
    {
      title: "Appointments",
      href: "/dashboard/appointments",
      icon: <CalendarIcon className="h-5 w-5" />,
      roles: ["admin", "agent"] // Only admin and agent can access appointments
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
    // {
    //   title: "Retail",
    //   href: "/dashboard/retail",
    //   icon: <ShoppingBagIcon className="h-5 w-5" />,
    //   roles: ["admin", "retail"] // Only admin and retail can access retail section
    // },
    {
      title: "User Management",
      href: "/dashboard/users",
      icon: <UserGroupIcon className="h-5 w-5" />,
      roles: ["admin"] // Only admin can access user management
    },
    {
      title: "WhatsApp Templates",
      href: "/dashboard/users/templates",
      icon: <DocumentTextIcon className="h-5 w-5" />,
      roles: ["admin"]
    },
    {
      title: "Playbooks",
      href: "/dashboard/playbooks",
      icon: <BookOpenIcon className="h-5 w-5" />,
      roles: ["admin"]
    },
    {
      title: "Borrowers",
      href: "/dashboard/borrowers",
      icon: <UsersIcon className="h-5 w-5" />,
      roles: ["admin"] // Only admin can access borrowers
    },
    {
      title: "Borrower Settings",
      href: "/dashboard/borrowers/settings",
      icon: <Cog6ToothIcon className="h-5 w-5" />,
      roles: ["admin"]
    }
  ];

  // Filter nav items based on user roles
  const filteredNavItems = navItems.filter(item => {
    if (loading) return false;
    if (!userId) return false;
    return item.roles.some(role => 
      userRoles.some(userRole => userRole.roleName === role)
    );
  });

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
      
      {userId && !loading && (
        <div className="space-y-2">
          {filteredNavItems.length > 0 ? (
            filteredNavItems.map((item) => {
              const isActive = pathname === item.href;
                // (pathname.startsWith(item.href) && item.href !== "/dashboard");
                
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
            })
          ) : (
            <div className="text-gray-400 text-sm p-3">
              {expanded ? "No access granted" : "No access"}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
