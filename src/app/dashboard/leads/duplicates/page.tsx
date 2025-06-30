"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  PhoneIcon, 
  UserIcon, 
  CalendarIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { findDuplicatePhoneLeads } from '~/app/_actions/leadActions';

interface DuplicateLead {
  id: number;
  phone_number: string;
  phone_number_2: string | null;
  phone_number_3: string | null;
  full_name: string | null;
  email: string | null;
  status: string;
  source: string | null;
  created_at: Date;
  updated_at: Date | null;
  assigned_to: string | null;
  amount: string | null;
  eligibility_status: string | null;
  is_deleted: boolean;
  assigned_user_name: string | null;
}

interface DuplicateGroup {
  phoneNumber: string;
  leads: DuplicateLead[];
  count: number;
}

interface DuplicateData {
  success: boolean;
  duplicateGroups: DuplicateGroup[];
  totalGroups: number;
  totalDuplicateLeads: number;
  message?: string;
}

const getStatusColor = (status: string) => {
  const statusMap: Record<string, string> = {
    new: "bg-blue-100 text-blue-800",
    assigned: "bg-cyan-100 text-cyan-800",
    no_answer: "bg-gray-100 text-gray-800",
    follow_up: "bg-indigo-100 text-indigo-800",
    booked: "bg-green-100 text-green-800",
    done: "bg-emerald-100 text-emerald-800",
    "missed/RS": "bg-pink-100 text-pink-800",
    unqualified: "bg-orange-100 text-orange-800",
    give_up: "bg-red-100 text-red-800",
    blacklisted: "bg-black text-white",
  };
  return statusMap[status] ?? "bg-gray-100 text-gray-800";
};

export default function DuplicateLeadsPage() {
  const [duplicateData, setDuplicateData] = useState<DuplicateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    loadDuplicateLeads();
  }, []);

  const loadDuplicateLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await findDuplicatePhoneLeads();
      setDuplicateData(result);
      if (!result.success) {
        setError(result.message || 'Failed to load duplicate leads');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = duplicateData?.duplicateGroups.filter(group => {
    const matchesSearch = searchQuery === '' || 
      group.phoneNumber.includes(searchQuery) ||
      group.leads.some(lead => 
        lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    
    const matchesStatus = statusFilter === '' || 
      group.leads.some(lead => lead.status === statusFilter);
    
    return matchesSearch && matchesStatus;
  }) || [];

  const allStatuses = [...new Set(
    duplicateData?.duplicateGroups.flatMap(group => 
      group.leads.map(lead => lead.status)
    ) || []
  )];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error Loading Duplicates</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <button
                  onClick={loadDuplicateLeads}
                  className="mt-3 text-sm font-medium text-red-800 underline hover:text-red-900"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Duplicate Phone Numbers</h1>
              <p className="mt-2 text-gray-600">
                Find leads that share the same phone numbers across all phone fields
              </p>
            </div>
            <button
              onClick={loadDuplicateLeads}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <PhoneIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Phone Number Groups
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {duplicateData?.totalGroups || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Duplicate Leads
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {duplicateData?.totalDuplicateLeads || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FunnelIcon className="h-6 w-6 text-orange-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Filtered Results
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {filteredGroups.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by phone number, name, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              {allStatuses.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <PhoneIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No duplicate phone numbers found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {duplicateData?.totalGroups === 0 
                ? "All leads have unique phone numbers."
                : "Try adjusting your search filters."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredGroups.map((group, groupIndex) => (
              <div key={`${group.phoneNumber}-${groupIndex}`} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">{group.phoneNumber}</h3>
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {group.count} duplicates
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {group.leads.map((lead, leadIndex) => (
                    <div key={`${lead.id}-${leadIndex}`} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <Link
                                  href={`/dashboard/leads/${lead.id}`}
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
                                >
                                  {lead.full_name || 'Unnamed Lead'}
                                  <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
                                </Link>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                                  {lead.status}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center text-sm text-gray-500 space-x-4">
                                <span>ID: {lead.id}</span>
                                {lead.email && (
                                  <span>{lead.email}</span>
                                )}
                                {lead.source && (
                                  <span>Source: {lead.source}</span>
                                )}
                                {lead.amount && (
                                  <span>Amount: {lead.amount}</span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                Created: {new Date(lead.created_at).toLocaleDateString()} | 
                                {lead.assigned_user_name && (
                                  <span className="ml-1">Assigned to: {lead.assigned_user_name}</span>
                                )}
                              </div>
                              
                              {/* Show all phone numbers for this lead */}
                              <div className="mt-2 space-y-1">
                                <div className="text-xs text-gray-600">
                                  <span className="font-medium">Primary:</span> {lead.phone_number}
                                </div>
                                {lead.phone_number_2 && lead.phone_number_2 !== lead.phone_number && (
                                  <div className="text-xs text-gray-600">
                                    <span className="font-medium">Secondary:</span> {lead.phone_number_2}
                                  </div>
                                )}
                                {lead.phone_number_3 && lead.phone_number_3 !== lead.phone_number && lead.phone_number_3 !== lead.phone_number_2 && (
                                  <div className="text-xs text-gray-600">
                                    <span className="font-medium">Additional:</span> {lead.phone_number_3}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/dashboard/leads/${lead.id}`}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                          >
                            View Lead
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 