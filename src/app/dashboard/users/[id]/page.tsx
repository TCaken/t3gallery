"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getUserById, updateUserWeight } from '~/app/_actions/userManagementActions';
import { UserButton } from '@clerk/nextjs';

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  weight: number | null;
  role: string | null;
  team: string | null;
  status: string;
  created_at: Date;
  updated_at: Date | null;
}

export default function UserProfilePage() {
  const { userId } = useAuth();
  const params = useParams();
  const router = useRouter();
  const targetUserId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [weight, setWeight] = useState<number>(1);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const result = await getUserById(targetUserId);
        if (result.success && result.user) {
          setUser(result.user);
          setWeight(result.user.weight ?? 1);
        } else {
          setError(result.error || 'Failed to load user');
        }
      } catch (err) {
        setError('An error occurred while loading user data');
      } finally {
        setLoading(false);
      }
    };

    if (targetUserId) {
      void loadUser();
    }
  }, [targetUserId]);

  const handleWeightUpdate = async () => {
    // Validate weight
    if (weight < 0) {
      setWeightError('Weight cannot be negative');
      return;
    }

    if (!Number.isInteger(weight)) {
      setWeightError('Weight must be a whole number');
      return;
    }

    setWeightError(null);
    setUpdating(true);

    try {
      const result = await updateUserWeight(targetUserId, weight);
      if (result.success) {
        setUser(prev => prev ? { ...prev, weight } : null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000); // Hide after 3 seconds
      } else {
        setError(result.error || 'Failed to update weight');
      }
    } catch (err) {
      setError('An error occurred while updating weight');
    } finally {
      setUpdating(false);
    }
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setWeight(value);
    setWeightError(null);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error || !user) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-red-600">Error</h2>
        <p className="mt-2">{error || 'User not found'}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/users')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Users
          </button>
          <h1 className="text-2xl font-bold">User Profile</h1>
        </div>
      </div>

      {/* Success Notification */}
      {showSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Weight updated successfully!
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* User Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
              {user.first_name?.[0] || user.email?.[0] || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {user.first_name && user.last_name 
                  ? `${user.first_name} ${user.last_name}` 
                  : user.first_name || user.last_name || 'Unknown User'
                }
              </h2>
              <p className="text-blue-100">{user.email}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                  {user.role}
                </span>
                {user.team && (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                    {user.team}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-sm ${
                  user.status === 'active' 
                    ? 'bg-green-500/20 text-green-100' 
                    : 'bg-red-500/20 text-red-100'
                }`}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* User Details */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <p className="text-gray-900">{user.first_name || 'Not provided'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <p className="text-gray-900">{user.last_name || 'Not provided'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{user.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                <p className="text-gray-900">{user.team || 'Not assigned'}</p>
              </div>
            </div>

            {/* Lead Distribution Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Lead Distribution Settings</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Weight</label>
                <p className="text-gray-900 text-lg font-semibold">{user.weight ?? 1}</p>
                <p className="text-sm text-gray-500 mt-1">
                  This agent will receive {(user.weight ?? 1)}x more leads than agents with weight 1
                </p>
              </div>

              {/* Weight Update Section */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Update Weight</h4>
                
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={weight}
                    onChange={handleWeightChange}
                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      weightError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter weight (0 or higher)"
                  />
                                      <button
                      onClick={handleWeightUpdate}
                      disabled={updating || weight === (user.weight ?? 1)}
                      className={`px-4 py-2 rounded-md text-white font-medium ${
                        updating || weight === (user.weight ?? 1)
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {updating ? 'Updating...' : 'Update'}
                    </button>
                </div>
                
                {weightError && (
                  <p className="text-red-600 text-sm mt-2">{weightError}</p>
                )}
                
                <div className="mt-3 text-sm text-gray-600">
                  <p><strong>Weight 0:</strong> Agent won't receive any leads</p>
                  <p><strong>Weight 1:</strong> Standard lead distribution</p>
                  <p><strong>Weight 2+:</strong> Agent receives 2x, 3x, etc. more leads</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">System Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <p className="text-gray-900 font-mono text-sm">{user.id}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                <p className="text-gray-900">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              
              {user.updated_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                  <p className="text-gray-900">
                    {new Date(user.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
