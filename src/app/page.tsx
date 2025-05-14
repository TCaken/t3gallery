import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { getMyImages } from "~/server/db/queries";
import { SignInButton } from "@clerk/nextjs";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dbImages = await getMyImages();

  return (
    <main className="">
      <SignedOut>
        <div className="min-h-[60vh] w-full flex flex-col justify-center items-center gap-8 py-10 bg-gradient-to-b from-blue-50 to-white rounded-lg shadow-sm my-4 px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-blue-800 mb-2">Welcome to AirConnect</h1>
            <p className="text-xl text-gray-600 mb-8">A powerful CRM for efficient lead management</p>
          </div>
          
          <div className="flex flex-col items-center gap-6 w-full max-w-md">
            <div className="bg-white p-6 rounded-lg shadow-md w-full text-center">
              <h2 className="text-2xl font-semibold mb-4 text-blue-700">Sign in to access your dashboard</h2>
              <p className="text-gray-600 mb-6">Manage your leads and appointments efficiently</p>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard/leads">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-md transition-colors w-full">
                  Sign in to AirConnect
                </button>
              </SignInButton>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 w-full">
              <p className="text-gray-700 text-center font-medium">
                After signing in, you&apos;ll be redirected to your 
                <span className="text-blue-600 font-semibold"> Dashboard &amp; Leads</span> page
              </p>
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="min-h-[60vh] w-full flex flex-col justify-center items-center gap-8 py-10 bg-gradient-to-b from-green-50 to-white rounded-lg shadow-sm my-4 px-4">
          <div className="text-center">
            <div className="mb-4 text-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">You&apos;re Signed In!</h1>
            <p className="text-xl text-gray-600 mb-8">Welcome back to AirConnect CRM</p>
          </div>
          
          <div className="flex flex-col items-center gap-6 w-full max-w-md">
            <div className="bg-white p-6 rounded-lg shadow-md w-full text-center">
              <h2 className="text-2xl font-semibold mb-4 text-gray-700">Ready to manage your leads?</h2>
              <p className="text-gray-600 mb-6">Access your dashboard to view and manage your leads</p>
              <Link href="/dashboard/leads">
                <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-md transition-colors w-full">
                  Go to Dashboard &amp; Leads
                </button>
              </Link>
            </div>
          </div>
        </div>
      </SignedIn>
    </main>
  );
}
