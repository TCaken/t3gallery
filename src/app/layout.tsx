import "~/styles/globals.css";
import "@uploadthing/react/styles.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton
} from '@clerk/nextjs';

export const metadata: Metadata = {
  title: "AirConnect",
  description: "AirConnect, A CRM App for Marketing",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

// # Testing for claude code bug finder
// # again
export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode, modal: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable}`}>
        <body className="bg-gray-50">
          <SignedIn>
            <div className="min-h-screen">
              {children}
            </div>
          </SignedIn>
          <SignedOut>
            <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gray-50">
              <div className="w-full max-w-md mx-auto px-4">
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-800 mb-2">Welcome to AirConnect</h1>
                    <p className="text-gray-600">A powerful CRM for efficient lead management</p>
                  </div>
                  
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold mb-3 text-blue-700">Sign in to access your dashboard</h2>
                    <p className="text-gray-600 mb-6">Manage your leads and appointments efficiently</p>
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard/leads">
                      <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-md transition-colors w-full">
                        Sign in to AirConnect
                      </button>
                    </SignInButton>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-blue-700 text-sm">
                    After signing in, you&apos;ll be redirected to your 
                    <span className="font-semibold"> Dashboard &amp; Leads</span> page
                  </p>
                </div>
              </div>
            </div>
          </SignedOut>
          <div id="modal-root" />
        </body>
      </html>
    </ClerkProvider>
  );
}
