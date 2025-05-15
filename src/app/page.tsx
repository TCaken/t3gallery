import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { getDatabaseDiagnostics, getSafeEnvVars } from "~/app/_actions/diagnosticActions";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const diagnosticInfo = await getDatabaseDiagnostics();
  const safeEnvVars = await getSafeEnvVars();

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
          
          {/* Diagnostic information section */}
          <div className="w-full max-w-4xl mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Database Diagnostic Information</h2>
            
            {diagnosticInfo.error ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-4">
                <h3 className="font-bold">Error connecting to database:</h3>
                <p className="font-mono text-sm">{diagnosticInfo.error}</p>
              </div>
            ) : null}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-700">All Tables in Database</h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                  {diagnosticInfo.allTables && diagnosticInfo.allTables.length > 0 ? (
                    <ul className="list-disc ml-4 space-y-1">
                      {diagnosticInfo.allTables.map((table, index) => (
                        <li key={index} className="font-mono text-sm">{table.table_name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No tables found</p>
                  )}
                </div>
                
                <h3 className="text-lg font-medium mb-2 mt-4 text-gray-700">Tables with &quot;leads&quot; in name</h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {diagnosticInfo.leadsTable && diagnosticInfo.leadsTable.length > 0 ? (
                    <ul className="list-disc ml-4 space-y-1">
                      {diagnosticInfo.leadsTable.map((table, index) => (
                        <li key={index} className="font-mono text-sm">{table.table_name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No leads tables found</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-700">Environment Variables</h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <ul className="space-y-2">
                    {Object.entries(safeEnvVars).map(([key, value]) => (
                      <li key={key} className="text-sm">
                        <span className="font-bold font-mono">{key}:</span> 
                        <span className="ml-2 font-mono text-gray-600">{value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SignedIn>
    </main>
  );
}
