'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { assignLeadToAgent } from '~/app/_actions/agentActions';
import { fetchUsers } from '~/app/_actions/userActions';

interface AssignLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: number;
  leadName: string;
  onAssignComplete: () => void;
}

// Define user and role types based on the API response
interface UserRole {
  id: string;
  roleName: string;
}

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string | null;
  roles: UserRole[];
}

export default function AssignLeadModal({
  isOpen,
  onClose,
  leadId,
  leadName,
  onAssignComplete
}: AssignLeadModalProps) {
  const [agents, setAgents] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        // Fetch users with role 'agent'
        const result = await fetchUsers();
        if (result.success) {
          const agentUsers = result.users
            .filter(user => Array.isArray(user.roles) && user.roles.some((role: UserRole) => role.roleName === 'agent'))
            .map(user => ({
              id: user.id,
              name: (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()) || (user.email ?? 'Unknown'),
              role: 'agent'
            }));
            
          setAgents(agentUsers);
          
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
    if (!selectedAgent) {
      setError('Please select an agent');
      return;
    }
    
    if (!leadId) {
      setError('No lead selected');
      return;
    }

    try {
      setAssigning(true);
      setError(null);

      const result = await assignLeadToAgent(leadId, selectedAgent);
      
      if (result.success) {
        onAssignComplete();
        onClose();
      } else {
        setError(result.message || 'Failed to assign lead');
      }
    } catch (error) {
      console.error('Error assigning lead:', error);
      setError('An error occurred while assigning the lead');
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Assign Lead</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="mb-4">
          {leadId ? (
            <p className="text-gray-700">
              Assigning <span className="font-medium">{leadName}</span> to an agent
            </p>
          ) : (
            <p className="text-red-500">No lead selected</p>
          )}
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
            <p className="text-yellow-600">No agents available to assign leads</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-gray-700 mb-2">Select Agent</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={assigning}
              >
                <option value="" disabled>Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                disabled={assigning}
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
                disabled={assigning || !selectedAgent}
              >
                {assigning ? 'Assigning...' : 'Assign Lead'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 