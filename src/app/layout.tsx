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

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode, modal: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable}`}>
        <body className="flex flex-col min-h-screen">
          <SignedIn>
            {children}
          </SignedIn>
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
          <div id="modal-root" />
        </body>
      </html>
    </ClerkProvider>
  );
}
