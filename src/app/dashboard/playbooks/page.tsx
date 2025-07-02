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
  const [activeTab, setActiveTab] = useState<'new' | 'reloan'>('new');

  // Register new lead playbook form
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({
    samespacePlaybookId: "",
    name: "",
    agentId: "",
  });

  // Register borrower playbook form with filters
  const [showBorrowerRegisterForm, setShowBorrowerRegisterForm] = useState(false);
  const [borrowerPlaybook, setBorrowerPlaybook] = useState({
    samespacePlaybookId: "",
    name: "",
    agentId: "",
    borrowerFilters: {
      status: "",
      aa_status: "",
      performance_bucket: "",
      assigned_filter: "assigned_to_me",
    },
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

  // Separate playbooks by type (simplified - we'll assume borrower playbooks have "Reloan" or "Borrower" in name)
  const leadPlaybooks = playbooks.filter(p => 
    !p.name.toLowerCase().includes('reloan') && !p.name.toLowerCase().includes('borrower')
  );
  const borrowerPlaybooks = playbooks.filter(p => 
    p.name.toLowerCase().includes('reloan') || p.name.toLowerCase().includes('borrower')
  );

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

  const handleRegisterBorrowerPlaybook = async () => {
    if (!borrowerPlaybook.samespacePlaybookId || !borrowerPlaybook.name || !borrowerPlaybook.agentId) {
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
        body: JSON.stringify({
          type: "borrower_register",
          samespacePlaybookId: borrowerPlaybook.samespacePlaybookId,
          name: borrowerPlaybook.name,
          agentId: borrowerPlaybook.agentId,
          borrowerFilters: borrowerPlaybook.borrowerFilters,
        }),
      });

      const data = await response.json() as ApiResponse<ResultData>;
      setResult(data);

      if (data.success) {
        setBorrowerPlaybook({
          samespacePlaybookId: "",
          name: "",
          agentId: "",
          borrowerFilters: {
            status: "",
            aa_status: "",
            performance_bucket: "",
            assigned_filter: "assigned_to_me",
          },
        });
        setShowBorrowerRegisterForm(false);
        void loadPlaybooks();
      }
    } catch (error) {
      console.error("Error registering borrower playbook:", error);
      setResult({
        success: false,
        message: "Failed to register borrower playbook",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncPlaybook = async (playbookId: number, type?: "lead" | "borrower") => {
    setIsLoading(true);
    setResult(null);

    try {
      const requestBody = type ? { type } : {};
      
      const response = await fetch(`/api/playbooks/${playbookId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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

  // Render playbook table for both lead and borrower playbooks
  const renderPlaybookTable = (playbooksToRender: Playbook[], type: "lead" | "borrower") => {
    if (playbooksToRender.length === 0) {
  return (
          <div className="p-4 text-center text-gray-500">
            No playbooks registered yet
          </div>
      );
    }

    return (
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
            {playbooksToRender.map((playbook) => (
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
                          onClick={() => handleSyncPlaybook(playbook.id, type)}
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
    );
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
                onClick={handleDeleteAllContacts}
                disabled={isLoading}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                Delete All Contacts
              </button>
            </div>
          </div>
      </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('new')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'new'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                New Leads
              </button>
              <button
                onClick={() => setActiveTab('reloan')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'reloan'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Reloan Borrowers
              </button>
            </nav>
          </div>

          {/* New Leads Tab */}
          {activeTab === 'new' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-blue-900">Lead Playbooks</h2>
                  <p className="text-sm text-gray-600">Register existing Samespace playbooks for lead management</p>
                </div>
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Register Playbook
                </button>
              </div>

              {renderPlaybookTable(leadPlaybooks, "lead")}
            </div>
          )}

          {/* Reloan Borrowers Tab */}
          {activeTab === 'reloan' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-purple-900">Borrower Playbooks</h2>
                  <p className="text-sm text-gray-600">Register existing Samespace playbooks for borrower reloan management</p>
                </div>
                <button
                  onClick={() => setShowBorrowerRegisterForm(true)}
                  className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors font-medium"
                >
                  Register Borrower Playbook
                </button>
              </div>

              {renderPlaybookTable(borrowerPlaybooks, "borrower")}
            </div>
          )}
        </div>

        {/* Register Lead Playbook Modal */}
        {showRegisterForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Register Lead Playbook</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Samespace Playbook ID
                  </label>
                  <input
                    type="text"
                    value={newPlaybook.samespacePlaybookId}
                    onChange={(e) =>
                      setNewPlaybook({ ...newPlaybook, samespacePlaybookId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter Samespace playbook ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Playbook Name
                  </label>
                  <input
                    type="text"
                    value={newPlaybook.name}
                    onChange={(e) =>
                      setNewPlaybook({ ...newPlaybook, name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter playbook name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agent
                  </label>
                  <select
                    value={newPlaybook.agentId}
                    onChange={(e) =>
                      setNewPlaybook({ ...newPlaybook, agentId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select an agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.first_name} {agent.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowRegisterForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterPlaybook}
                  disabled={isLoading}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? "Registering..." : "Register"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Register Borrower Playbook Modal */}
        {showBorrowerRegisterForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Register Borrower Playbook</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Samespace Playbook ID
                  </label>
                  <input
                    type="text"
                    value={borrowerPlaybook.samespacePlaybookId}
                    onChange={(e) =>
                      setBorrowerPlaybook({ ...borrowerPlaybook, samespacePlaybookId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter Samespace playbook ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Playbook Name
                  </label>
                  <input
                    type="text"
                    value={borrowerPlaybook.name}
                    onChange={(e) =>
                      setBorrowerPlaybook({ ...borrowerPlaybook, name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter playbook name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agent
                  </label>
                  <select
                    value={borrowerPlaybook.agentId}
                    onChange={(e) =>
                      setBorrowerPlaybook({ ...borrowerPlaybook, agentId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select an agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.first_name} {agent.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Borrower Filters Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Borrower Filters</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Borrower Status
                      </label>
                      <select
                        value={borrowerPlaybook.borrowerFilters.status}
                        onChange={(e) =>
                          setBorrowerPlaybook({ 
                            ...borrowerPlaybook, 
                            borrowerFilters: { 
                              ...borrowerPlaybook.borrowerFilters, 
                              status: e.target.value 
                            } 
                          })
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">All Statuses</option>
                        <option value="new">New</option>
                        <option value="assigned">Assigned</option>
                        <option value="no_answer">No Answer</option>
                        <option value="follow_up">Follow Up</option>
                        <option value="booked">Booked</option>
                        <option value="done">Done</option>
                        <option value="missed/RS">Missed/RS</option>
                        <option value="unqualified">Unqualified</option>
                        <option value="give_up">Give Up</option>
                        <option value="blacklisted">Blacklisted</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        AA Status
                      </label>
                      <select
                        value={borrowerPlaybook.borrowerFilters.aa_status}
                        onChange={(e) =>
                          setBorrowerPlaybook({ 
                            ...borrowerPlaybook, 
                            borrowerFilters: { 
                              ...borrowerPlaybook.borrowerFilters, 
                              aa_status: e.target.value 
                            } 
                          })
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">All AA Status</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Performance Bucket
                      </label>
                      <select
                        value={borrowerPlaybook.borrowerFilters.performance_bucket}
                        onChange={(e) =>
                          setBorrowerPlaybook({ 
                            ...borrowerPlaybook, 
                            borrowerFilters: { 
                              ...borrowerPlaybook.borrowerFilters, 
                              performance_bucket: e.target.value 
                            } 
                          })
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">All Performance Buckets</option>
                        <option value="closed_loan">Closed Loan</option>
                        <option value="2nd_reloan">2nd Reloan</option>
                        <option value="attrition">Attrition Risk</option>
                        <option value="last_payment">Last Payment Due</option>
                        <option value="bhv1">BHV1 Pattern</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assignment Filter
                      </label>
                      <select
                        value={borrowerPlaybook.borrowerFilters.assigned_filter}
                        onChange={(e) =>
                          setBorrowerPlaybook({ 
                            ...borrowerPlaybook, 
                            borrowerFilters: { 
                              ...borrowerPlaybook.borrowerFilters, 
                              assigned_filter: e.target.value 
                            } 
                          })
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="assigned_to_me">Assigned to Selected Agent</option>
                        <option value="unassigned">Unassigned</option>
                        <option value="">All Assignments</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowBorrowerRegisterForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterBorrowerPlaybook}
                  disabled={isLoading}
                  className="flex-1 bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 disabled:opacity-50"
                >
                  {isLoading ? "Registering..." : "Register"}
                </button>
              </div>
            </div>
              </div>
            )}

        {/* Result Display */}
        {result && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-4">Operation Result</h3>
            <div
              className={`p-4 rounded-md ${
                result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              <div className="font-medium">{result.message}</div>
            {result.error && (
                <div className="text-sm mt-1">Error: {result.error}</div>
              )}
              
              {/* Detailed Results */}
              {result.data && (
                <div className="mt-3 space-y-2">
                  {result.data.contactsCreated !== undefined && (
                    <div className="text-sm">Contacts Created: {result.data.contactsCreated}</div>
                  )}
                  {result.data.contactsFailed !== undefined && (
                    <div className="text-sm">Contacts Failed: {result.data.contactsFailed}</div>
                  )}
                  {result.data.contactsRemoved !== undefined && (
                    <div className="text-sm">Contacts Removed: {result.data.contactsRemoved}</div>
                  )}
                  {result.data.playbookUpdated !== undefined && (
                    <div className="text-sm">
                      Playbook Updated: {result.data.playbookUpdated ? "Yes" : "No"}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
} 