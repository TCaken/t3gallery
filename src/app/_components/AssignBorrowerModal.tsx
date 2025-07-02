'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { updateBorrower } from '~/app/_actions/borrowers';
import { fetchAgentReloan } from '~/app/_actions/userActions';

interface AssignBorrowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrowerId?: number;
  borrowerName?: string;
  borrowerIds?: number[];
  borrowerNames?: string[];
  isBulkMode?: boolean;
  onAssignComplete: () => void;
}

// Define user and role types based on the API response
interface UserRole {
  id: number;
  roleName: string;
}

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl?: string | null;
  roles: UserRole[];
}

export default function AssignBorrowerModal({
  isOpen,
  onClose,
  borrowerId,
  borrowerName,
  borrowerIds = [],
  borrowerNames = [],
  isBulkMode = false,
  onAssignComplete
}: AssignBorrowerModalProps) {
  const [agents, setAgents] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [operationType, setOperationType] = useState<'assign' | 'unassign'>('assign');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    details: Array<{ borrower: string; success: boolean; error?: string }>
  } | null>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        // Fetch users with role 'agent' only
        const result = await fetchAgentReloan();
        console.log('fetchAgentReloan inside loadAgents result:', result);
        if (result.success) {
          const agentUsers = result.users
            .map((user: User) => ({
              id: user.id,
              name: (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()) || (user.email ?? 'Unknown'),
              role: 'agent-reloan'
            }));
            
          setAgents(agentUsers);
          console.log('agentUsers:', agentUsers);
          
          // Auto-select the first agent if available
          if (agentUsers && agentUsers.length > 0 && agentUsers[0]?.id) {
            setSelectedAgent(agentUsers[0].id);
          }
        } else {
          setError('Failed to load agents');
        }
      } catch (error) {
        console.error('Error loading agents:', error);
        setError('An error occurred while loading agents');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      void loadAgents();
    }
  }, [isOpen]);

  const handleAssign = async () => {
    // Only require agent selection for assign operation
    if (operationType === 'assign' && !selectedAgent) {
      setError('Please select an agent');
      return;
    }
    
    if (!isBulkMode && !borrowerId) {
      setError('No borrower selected');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setResults(null);

      if (isBulkMode) {
        // Bulk operation
        const targetIds = borrowerIds;
        const targetNames = borrowerNames;
        
        console.log('=== BULK OPERATION DEBUG ===');
        console.log('Operation Type:', operationType);
        console.log('Borrower IDs:', targetIds);
        console.log('Selected Agent:', selectedAgent);
        
        const results: Array<{ borrower: string; success: boolean; error?: string }> = [];
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < targetIds.length; i++) {
          const id = targetIds[i];
          const name = targetNames[i] ?? `Borrower ${id}`;
          
          if (!id) continue; // Skip undefined IDs
          
          try {
            const updateData = operationType === 'assign' 
              ? { id, status: 'assigned', assigned_to: selectedAgent }
              : { id, status: 'new', assigned_to: null };
              
            const result = await updateBorrower(updateData);
            
            if (result.success) {
              results.push({ borrower: name, success: true });
              successCount++;
            } else {
              results.push({ borrower: name, success: false, error: 'Update failed' });
              failedCount++;
            }
          } catch (error) {
            results.push({ borrower: name, success: false, error: 'Network error' });
            failedCount++;
          }
        }

        setResults({ success: successCount, failed: failedCount, details: results });
        
        if (successCount > 0) {
          onAssignComplete();
        }
      } else {
        // Single operation
        const targetId = borrowerId;
        const targetName = borrowerName;
        
        console.log('=== SINGLE OPERATION DEBUG ===');
        console.log('Operation Type:', operationType);
        console.log('Borrower ID:', targetId);
        console.log('Selected Agent:', selectedAgent);
        
        if (!targetId) {
          setError('No borrower selected');
          return;
        }
        
        const updateData = operationType === 'assign' 
          ? { id: targetId, status: 'assigned', assigned_to: selectedAgent }
          : { id: targetId, status: 'new', assigned_to: null };
        
        console.log('Update data being sent:', JSON.stringify(updateData));

        const result = await updateBorrower(updateData);
        
        console.log('updateBorrower result:', JSON.stringify(result, null, 2));
        
        if (result.success) {
          console.log(`✅ ${operationType === 'assign' ? 'Assignment' : 'Unassignment'} successful!`);
          console.log('Updated borrower data:', JSON.stringify(result.data, null, 2));
          onAssignComplete();
          onClose();
        } else {
          console.error(`❌ ${operationType === 'assign' ? 'Assignment' : 'Unassignment'} failed:`, result);
          setError(`Failed to ${operationType} borrower`);
        }
      }
    } catch (error) {
      console.error(`❌ Error ${operationType === 'assign' ? 'assigning' : 'unassigning'} borrower:`, error);
      setError(`An error occurred while ${operationType === 'assign' ? 'assigning' : 'unassigning'} the borrower`);
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {isBulkMode ? 'Bulk Manage Borrowers' : 'Manage Borrower'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="mb-4">
          {isBulkMode ? (
            <p className="text-gray-700">
              Managing <span className="font-medium">{borrowerIds.length} borrowers</span>
            </p>
          ) : borrowerId ? (
            <p className="text-gray-700">
              Managing <span className="font-medium">{borrowerName}</span>
            </p>
          ) : (
            <p className="text-red-500">No borrower selected</p>
          )}
        </div>

        {/* Operation Type Selection */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Action</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="assign"
                checked={operationType === 'assign'}
                onChange={(e) => setOperationType(e.target.value as 'assign' | 'unassign')}
                className="mr-2"
                disabled={processing}
              />
              Assign to Agent
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="unassign"
                checked={operationType === 'unassign'}
                onChange={(e) => setOperationType(e.target.value as 'assign' | 'unassign')}
                className="mr-2"
                disabled={processing}
              />
              Unassign (Set to New)
            </label>
          </div>
        </div>

        {loading ? (
          <div className="py-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading agents...</p>
          </div>
        ) : error ? (
          <div className="py-4 text-center">
            <p className="text-red-500">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Reload
            </button>
          </div>
        ) : agents.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-yellow-600">No agents available to assign borrowers</p>
          </div>
        ) : (
          <>
            {/* Agent Selection - Only show for assign operation */}
            {operationType === 'assign' && (
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">Select Agent</label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={processing}
                >
                  <option value="" disabled>Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Results Display for Bulk Operations */}
            {results && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Operation Results</h3>
                <div className="flex space-x-4 mb-3">
                  <span className="text-green-600">Success: {results.success}</span>
                  <span className="text-red-600">Failed: {results.failed}</span>
                </div>
                
                {results.details.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {results.details.map((detail, index) => (
                      <div key={index} className={`text-sm ${detail.success ? 'text-green-600' : 'text-red-600'}`}>
                        <span className="font-medium">{detail.borrower}</span>: {detail.success ? '✓' : `✗ ${detail.error}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                className={`px-4 py-2 text-white rounded disabled:opacity-50 ${
                  operationType === 'assign' 
                    ? 'bg-blue-500 hover:bg-blue-600' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
                disabled={processing || (operationType === 'assign' && !selectedAgent)}
              >
                {processing 
                  ? 'Processing...' 
                  : operationType === 'assign' 
                    ? (isBulkMode ? 'Assign Borrowers' : 'Assign Borrower')
                    : (isBulkMode ? 'Unassign Borrowers' : 'Unassign Borrower')
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 