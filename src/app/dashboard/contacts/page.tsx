"use client";

import { useState } from "react";

export default function ContactsPage() {
  const [playbookId, setPlaybookId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSync = async () => {
    if (!playbookId || !agentId) {
      alert("Please enter both playbook ID and agent ID");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/contacts/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playbookId,
          agentId,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error syncing contacts:", error);
      setResult({
        success: false,
        message: "Failed to sync contacts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("Are you sure you want to delete ALL contacts? This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/contacts/cleanup", {
        method: "POST",
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error cleaning up contacts:", error);
      setResult({
        success: false,
        message: "Failed to cleanup contacts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Contact Management</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sync Contacts */}
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Sync Contacts</h2>
          <p className="text-gray-600 mb-4">
            Create contacts for agent's follow-up leads and update playbook
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Playbook ID
              </label>
              <input
                type="text"
                value={playbookId}
                onChange={(e) => setPlaybookId(e.target.value)}
                placeholder="Enter Samespace playbook ID"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Agent ID
              </label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="Enter agent user ID"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <button
              onClick={handleSync}
              disabled={isLoading}
              className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Syncing..." : "Sync Contacts"}
            </button>
          </div>
        </div>

        {/* Cleanup Contacts */}
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Cleanup Contacts</h2>
          <p className="text-gray-600 mb-4">
            Delete all contacts with data source "AirConnect"
          </p>

          <button
            onClick={handleCleanup}
            disabled={isLoading}
            className="w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? "Cleaning up..." : "Delete All Contacts"}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-6 rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">
            Result {result.success ? "✅" : "❌"}
          </h3>

          <div className="space-y-2">
            <p><strong>Status:</strong> {result.success ? "Success" : "Failed"}</p>
            <p><strong>Message:</strong> {result.message}</p>

            {result.data && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Details:</h4>
                <ul className="space-y-1 text-sm">
                  <li>Contacts Created: {result.data.contactsCreated}</li>
                  <li>Contacts Failed: {result.data.contactsFailed}</li>
                  <li>Playbook Updated: {result.data.playbookUpdated ? "Yes" : "No"}</li>
                </ul>

                {result.data.details && result.data.details.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium mb-2">Contact Details:</h5>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Lead ID</th>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Phone</th>
                            <th className="text-left p-2">Status</th>
                            <th className="text-left p-2">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.details.map((detail: any, index: number) => (
                            <tr key={index} className="border-b">
                              <td className="p-2">{detail.leadId}</td>
                              <td className="p-2">{detail.leadName}</td>
                              <td className="p-2">{detail.phone}</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  detail.status === 'created' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {detail.status}
                                </span>
                              </td>
                              <td className="p-2 text-red-600">
                                {detail.error || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600"><strong>Error:</strong> {result.error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Environment Setup */}
      <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <h3 className="text-lg font-semibold mb-2">⚠️ Environment Setup Required</h3>
        <p className="text-gray-700">
          Make sure to add your Samespace API key to your environment file:
        </p>
        <code className="block mt-2 p-2 bg-gray-100 rounded text-sm">
          SAMESPACE_API_KEY=your_api_key_here
        </code>
      </div>
    </div>
  );
} 