"use client";

import { 
    UserButton,
    SignedIn,
    SignedOut,
    SignInButton
} from "@clerk/nextjs";
import { 
    BellIcon, 
    MagnifyingGlassIcon,
    Bars3Icon
} from "@heroicons/react/24/outline";

interface TopNavProps {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  isMobile: boolean;
}

export default function TopNav({ expanded, setExpanded, isMobile }: TopNavProps) {
  return (
    <nav className="bg-white shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-5">
      {isMobile && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors mr-4"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      )}
      
      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <BellIcon className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
            3
          </span>
        </button>
        
        <div className="border-l h-8 border-gray-300 mx-2"></div>
        
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
        
        <SignedIn>
          <div className="flex items-center">
            <div className="mr-2 text-sm hidden sm:block">
              <div className="font-medium text-gray-700">John Doe</div>
              <div className="text-xs text-gray-500">Admin</div>
            </div>
          <UserButton />
          </div>
        </SignedIn>
      </div>
    </nav>
  );
  }