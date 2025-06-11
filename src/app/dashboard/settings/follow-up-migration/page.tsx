"use client";

import { useState, useEffect } from 'react';
import { 
  ClockIcon, 
  UserIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowLeftIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { fetchFilteredLeads, updateLeadStatus } from '~/app/_actions/leadActions';

interface Lead {
  id: number;
  phone_number: string;
  full_name: string;
  email: string;
  status: string;
  assigned_to: string | null;
  created_at: Date;
  updated_at: Date | null;
}

interface MigrationResult {
  success: boolean;
  message: string;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  errors: string[];
}

export default function FollowUpMigrationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  
  const targetUserId = 'user_2y2V1dGLmNQZ6JqpNqLz8YKQN2k';
  const [statusFilter, setStatusFilter] = useState<string>('assigned');
  const [onlyAssignedToTarget, setOnlyAssignedToTarget] = useState(true);

  const loadLeads = async () => {
    setLoadingLeads(true);
    try {
      const result = await fetchFilteredLeads({
        status: statusFilter as any,
        limit: 500,
        sortBy: 'updated_at',
        sortOrder: 'desc'
      });
      
      if (result.success && result.leads) {
        let filteredLeads = result.leads;
        
        if (onlyAssignedToTarget) {
          filteredLeads = result.leads.filter(lead => lead.assigned_to === targetUserId);
        }
        
        setLeads(filteredLeads as Lead[]);
      } else {
        setLeads([]);
      }
    } catch (error) {
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, [statusFilter, onlyAssignedToTarget]);

  const toggleLeadSelection = (leadId: number) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    setSelectedLeads(newSelection);
  };

  const selectAllLeads = () => {
    setSelectedLeads(new Set(leads.map(lead => lead.id)));
  };

  const clearSelection = () => {
    setSelectedLeads(new Set());
  };

  const migrateToFollowUp = async () => {
    if (selectedLeads.size === 0) {
      alert('Please select at least one lead to migrate');
      return;
    }

    setIsLoading(true);
    setMigrationResult(null);

    const selectedLeadIds = Array.from(selectedLeads);
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      for (const leadId of selectedLeadIds) {
        try {
          const result = await updateLeadStatus(leadId, 'follow_up');
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
            errors.push(`Lead ${leadId}: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          failedCount++;
          errors.push(`Lead ${leadId}: ${(error as Error).message}`);
        }
      }

      setMigrationResult({
        success: true,
        message: `Migration completed: ${successCount} successful, ${failedCount} failed`,
        totalProcessed: selectedLeadIds.length,
        successCount,
        failedCount,
        errors
      });

      await loadLeads();
      setSelectedLeads(new Set());

    } catch (error) {
      setMigrationResult({
        success: false,
        message: `Migration failed: ${(error as Error).message}`,
        totalProcessed: selectedLeadIds.length,
        successCount: 0,
        failedCount: selectedLeadIds.length,
        errors: [(error as Error).message]
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span>Back to Settings</span>
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Follow-Up Migration</h1>
        <p className="text-gray-600 mt-2">
          Migrate leads assigned to {targetUserId} to follow-up status
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex items-center mb-4">
          <UsersIcon className="h-6 w-6 text-gray-600 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">Lead Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="no_answer">No Answer</option>
              <option value="booked">Booked</option>
              <option value="done">Done</option>
              <option value="missed/RS">Missed/RS</option>
              <option value="unqualified">Unqualified</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="onlyAssignedToTarget"
                checked={onlyAssignedToTarget}
                onChange={(e) => setOnlyAssignedToTarget(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="onlyAssignedToTarget" className="ml-2 text-sm text-gray-700">
                Only show leads assigned to target user
              </label>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadLeads}
              disabled={loadingLeads}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {loadingLeads ? 'Loading...' : 'Refresh Leads'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <UserIcon className="h-5 w-5 text-blue-600 mr-3" />
          <div>
            <p className="text-blue-800 font-medium">Target User ID:</p>
            <p className="text-blue-900 font-mono text-sm">{targetUserId}</p>
          </div>
        </div>
      </div>

      {leads.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Leads Found: {leads.length}
              </h3>
              <span className="text-sm text-gray-600">
                Selected: {selectedLeads.size}
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={selectAllLeads}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <h4 className="font-medium text-gray-900">Migrate to Follow-Up Status</h4>
              <p className="text-sm text-gray-600">
                Change status of selected leads from "{statusFilter}" to "follow_up"
              </p>
            </div>
            <button
              onClick={migrateToFollowUp}
              disabled={isLoading || selectedLeads.size === 0}
              className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                isLoading || selectedLeads.size === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Migrating...
                </>
              ) : (
                <>
                  <ClockIcon className="h-5 w-5 mr-2" />
                  Migrate {selectedLeads.size} Leads
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {leads.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedLeads.size === leads.length && leads.length > 0}
                      onChange={() => {
                        if (selectedLeads.size === leads.length) {
                          clearSelection();
                        } else {
                          selectAllLeads();
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lead.full_name}</div>
                        <div className="text-sm text-gray-500">{lead.phone_number}</div>
                        {lead.email && (
                          <div className="text-sm text-gray-500">{lead.email}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        lead.status === 'new' ? 'bg-blue-100 text-blue-800' :
                        lead.status === 'assigned' ? 'bg-cyan-100 text-cyan-800' :
                        lead.status === 'follow_up' ? 'bg-indigo-100 text-indigo-800' :
                        lead.status === 'booked' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lead.assigned_to ? (
                        <span className={`font-mono text-xs ${
                          lead.assigned_to === targetUserId ? 'text-green-600 font-semibold' : 'text-gray-600'
                        }`}>
                          {lead.assigned_to === targetUserId ? '✓ Target User' : lead.assigned_to}
                        </span>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
          <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Leads Found</h3>
          <p className="text-gray-600">
            {loadingLeads ? 'Loading leads...' : 
             onlyAssignedToTarget ? 
             `No leads with status "${statusFilter}" assigned to ${targetUserId}` :
             `No leads with status "${statusFilter}" found`
            }
          </p>
        </div>
      )}

      {migrationResult && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mt-6">
          <div className="flex items-center mb-4">
            {migrationResult.success ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600 mr-3" />
            ) : (
              <XMarkIcon className="h-6 w-6 text-red-600 mr-3" />
            )}
            <h3 className="text-lg font-semibold">Migration Results</h3>
          </div>

          <div className={`rounded-lg p-4 mb-4 ${
            migrationResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-medium ${
              migrationResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {migrationResult.message}
            </p>
            
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-700">Total Processed</p>
                <p className="font-bold text-lg">{migrationResult.totalProcessed}</p>
              </div>
              <div>
                <p className="text-green-700">Successful</p>
                <p className="text-green-900 font-bold text-lg">{migrationResult.successCount}</p>
              </div>
              <div>
                <p className="text-red-700">Failed</p>
                <p className="text-red-900 font-bold text-lg">{migrationResult.failedCount}</p>
              </div>
            </div>
          </div>

          {migrationResult.errors.length > 0 && (
            <div>
              <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
              <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                {migrationResult.errors.map((error, index) => (
                  <p key={index} className="text-sm text-red-700 mb-1">{error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 