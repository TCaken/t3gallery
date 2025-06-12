"use client";

import { useState, useEffect } from "react";

interface Playbook {
  id: number;
  samespace_playbook_id: string;
  name: string;
  agent_id: string;
  agent_name: string;
  is_active: boolean;
  last_synced_at: string;
  contact_count: number;
  samespace_status: string;
  is_running: boolean;
  created_at: string;
}

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

interface ResultData {
  contactsCreated?: number;
  contactsFailed?: number;
  playbookUpdated?: boolean;
  contactsRemoved?: number;
  details?: Array<{
    leadId?: number;
    lead_id?: number;
    leadName?: string;
    phone_number?: string;
    phone?: string;
    status: string;
    error?: string;
  }>;
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse<ResultData> | null>(null);

  // Register new playbook form
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({
    samespacePlaybookId: "",
    name: "",
    agentId: "",
  });

  useEffect(() => {
    void loadPlaybooks();
    void loadAgents();
  }, []);

  const loadPlaybooks = async () => {
    try {
      const response = await fetch("/api/playbooks");
      const data = await response.json() as ApiResponse<Playbook[]>;
      if (data.success) {
        setPlaybooks(data.data ?? []);
      }
    } catch (error) {
      console.error("Error loading playbooks:", error);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await fetch("/api/agents");
      const data = await response.json() as ApiResponse<Agent[]>;
      if (data.success) {
        setAgents(data.data ?? []);
      }
    } catch (error) {
      console.error("Error loading agents:", error);
    }
  };

  const handleRegisterPlaybook = async () => {
    if (!newPlaybook.samespacePlaybookId || !newPlaybook.name || !newPlaybook.agentId) {
      alert("Please fill in all fields");
      return;
    }


    setIsLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/playbooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPlaybook),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        setNewPlaybook({ samespacePlaybookId: "", name: "", agentId: "" });
        setShowRegisterForm(false);
        loadPlaybooks();
      }
    } catch (error) {
      console.error("Error registering playbook:", JSON.stringify(error));
      setResult({
        success: false,
        message: "Failed to register playbook",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncPlaybook = async (playbookId: number) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/playbooks/${playbookId}/sync`, {
        method: "POST",
      });

      const data = await response.json() as ApiResponse<ResultData>;
      setResult(data);
      
      if (data.success) {
        void loadPlaybooks(); // Refresh the list
      }
    } catch (error) {
      console.error("Error syncing playbook:", error);
      setResult({
        success: false,
        message: "Failed to sync playbook",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupPlaybook = async (playbookId: number) => {
    if (!confirm("Are you sure you want to cleanup this playbook's contacts?")) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/playbooks/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playbookId }),
      });

      const data = await response.json();
      setResult(data);
      loadPlaybooks(); // Refresh the list
    } catch (error) {
      console.error("Error cleaning up playbook:", error);
      setResult({
        success: false,
        message: "Failed to cleanup playbook",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPlaybook = async (playbookId: number) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/playbooks/${playbookId}/start`, {
        method: "POST",
      });

      const data = await response.json() as ApiResponse<ResultData>;
      setResult(data);
      
      if (data.success) {
        void loadPlaybooks(); // Refresh the list
      }
    } catch (error) {
      console.error("Error starting playbook:", error);
      setResult({
        success: false,
        message: "Failed to start playbook",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopPlaybook = async (playbookId: number) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/playbooks/${playbookId}/stop`, {
        method: "POST",
      });

      const data = await response.json() as ApiResponse<ResultData>;
      setResult(data);
      
      if (data.success) {
        void loadPlaybooks(); // Refresh the list
      }
    } catch (error) {
      console.error("Error stopping playbook:", error);
      setResult({
        success: false,
        message: "Failed to stop playbook",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePlaybook = async (playbookId: number, playbookName: string) => {
    if (!confirm(`Are you sure you want to DELETE "${playbookName}"? This will stop the playbook and remove all contacts. This cannot be undone!`)) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/playbooks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playbookId }),
      });

      const data = await response.json() as ApiResponse<ResultData>;
      setResult(data);
      
      if (data.success) {
        void loadPlaybooks(); // Refresh the list
      }
    } catch (error) {
      console.error("Error deleting playbook:", error);
      setResult({
        success: false,
        message: "Failed to delete playbook",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllContacts = async () => {
    if (!confirm("Are you sure you want to DELETE ALL CONTACTS? This cannot be undone!")) {
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
      loadPlaybooks(); // Refresh the list
    } catch (error) {
      console.error("Error deleting all contacts:", error);
      setResult({
        success: false,
        message: "Failed to delete all contacts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Playbook Management</h1>
              <p className="text-gray-600 mt-1">Manage your Samespace playbooks and contacts</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowRegisterForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                + Register Playbook
              </button>
              <button
                onClick={handleDeleteAllContacts}
                disabled={isLoading}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                Delete All Contacts
              </button>
            </div>
          </div>
        </div>

      {/* Register Playbook Modal */}
      {showRegisterForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Register New Playbook</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Samespace Playbook ID
                </label>
                <input
                  type="text"
                  value={newPlaybook.samespacePlaybookId}
                  onChange={(e) => setNewPlaybook({
                    ...newPlaybook,
                    samespacePlaybookId: e.target.value
                  })}
                  placeholder="Enter Samespace playbook ID"
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Playbook Name
                </label>
                <input
                  type="text"
                  value={newPlaybook.name}
                  onChange={(e) => setNewPlaybook({
                    ...newPlaybook,
                    name: e.target.value
                  })}
                  placeholder="Enter playbook name"
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Agent
                </label>
                <select
                  value={newPlaybook.agentId}
                  onChange={(e) => setNewPlaybook({
                    ...newPlaybook,
                    agentId: e.target.value
                  })}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="">Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.first_name} {agent.last_name} ({agent.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowRegisterForm(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterPlaybook}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Registering..." : "Register"}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Playbooks List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Registered Playbooks</h2>
              <div className="text-sm text-gray-500">
                Total: {playbooks.length} playbook{playbooks.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

        {playbooks.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No playbooks registered yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Agent</th>
                  <th className="text-left p-4">Contacts</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Last Synced</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {playbooks.map((playbook) => (
                  <tr key={playbook.id} className="border-b">
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{playbook.name}</div>
                        <div className="text-sm text-gray-500">
                          ID: {playbook.samespace_playbook_id}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {playbook.agent_name || 'Unknown'}
                    </td>
                    <td className="p-4">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {playbook.contact_count}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2"> 
                          {/* <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            playbook.is_active 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {playbook.is_active ? 'Registered' : 'Inactive'}
                          </span> */}
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* <span className={`px-2 py-1 rounded text-xs font-medium ${
                            playbook.is_running 
                              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                              : 'bg-orange-100 text-orange-800 border border-orange-200'
                          }`}>
                            {playbook.is_running ? 'Running' : 'Stopped'}
                          </span> */}
                          {playbook.samespace_status !== 'unknown' && (
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                              {playbook.samespace_status}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {playbook.last_synced_at 
                          ? new Date(playbook.last_synced_at).toLocaleString()
                          : 'Never'
                        }
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {/* Start/Stop buttons - Based on live Samespace status */}
                        {playbook.is_active && (
                          <>
                            {playbook.is_running ? (
                              <button
                                onClick={() => handleStopPlaybook(playbook.id)}
                                disabled={isLoading}
                                className="bg-red-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center space-x-1"
                              >
                                <span className="w-2 h-2 bg-white rounded-full"></span>
                                <span>Stop</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartPlaybook(playbook.id)}
                                disabled={isLoading}
                                className="bg-green-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center space-x-1"
                              >
                                <span className="w-0 h-0 border-l-[6px] border-l-white border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5"></span>
                                <span>Start</span>
                              </button>
                            )}
                          </>
                        )}
                        
                        {/* Sync button */}
                        <button
                          onClick={() => handleSyncPlaybook(playbook.id)}
                          disabled={isLoading}
                          className="bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                          Sync
                        </button>
                        
                        {/* Cleanup button */}
                        <button
                          onClick={() => handleCleanupPlaybook(playbook.id)}
                          disabled={isLoading}
                          className="bg-orange-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                        >
                          Cleanup
                        </button>
                        
                        {/* Delete button */}
                        <button
                          onClick={() => handleDeletePlaybook(playbook.id, playbook.name)}
                          disabled={isLoading}
                          className="bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        {/* Results */}
        {result && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-900">
              Operation Result {result.success ? "✅" : "❌"}
            </h3>

          <div className="space-y-2">
            <p><strong>Status:</strong> {result.success ? "Success" : "Failed"}</p>
            <p><strong>Message:</strong> {result.message}</p>

            {result.data && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Details:</h4>
                
                {result.data.contactsCreated !== undefined && (
                  <ul className="space-y-1 text-sm">
                    <li>Contacts Created: {result.data.contactsCreated}</li>
                    <li>Contacts Failed: {result.data.contactsFailed}</li>
                    <li>Playbook Updated: {result.data.playbookUpdated ? "Yes" : "No"}</li>
                  </ul>
                )}

                {result.data.contactsRemoved !== undefined && (
                  <ul className="space-y-1 text-sm">
                    <li>Contacts Removed: {result.data.contactsRemoved}</li>
                  </ul>
                )}

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
                              <td className="p-2">{detail.leadId || detail.lead_id}</td>
                              <td className="p-2">{detail.leadName || detail.phone_number}</td>
                              <td className="p-2">{detail.phone || detail.phone_number}</td>
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
      
      </div>
    </div>
  );
} 