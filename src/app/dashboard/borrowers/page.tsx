"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { 
  PlusIcon, 
  FunnelIcon,
  MagnifyingGlassIcon as SearchIcon,
  UserGroupIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  UserPlusIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { getBorrowers, updateBorrower } from '~/app/_actions/borrowers';
import { useUserRole } from '../leads/useUserRole';
import AssignBorrowerModal from '~/app/_components/AssignBorrowerModal';

// Status info for styling
const allStatuses = [
  { id: 'new', name: 'New', color: 'bg-blue-100 text-blue-800' },
  { id: 'assigned', name: 'Assigned', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'no_answer', name: 'No Answer', color: 'bg-gray-100 text-gray-800' },
  { id: 'follow_up', name: 'Follow Up', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'booked', name: 'Booked', color: 'bg-green-100 text-green-800' },
  { id: 'done', name: 'Done', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'missed/RS', name: 'Missed/RS', color: 'bg-pink-100 text-pink-800' },
  { id: 'unqualified', name: 'Unqualified', color: 'bg-orange-100 text-orange-800' },
  { id: 'give_up', name: 'Give Up', color: 'bg-red-100 text-red-800' },
  { id: 'blacklisted', name: 'Blacklisted', color: 'bg-black text-white' },
] as const;

// Get status color
const getStatusColor = (status: string) => {
  const statusInfo = allStatuses.find(s => s.id === status);
  return statusInfo?.color ?? "bg-gray-100 text-gray-800";
};

type BorrowerRecord = {
  id: number;
  full_name: string;
  phone_number: string;
  phone_number_2: string | null;
  phone_number_3: string | null;
  email: string | null;
  residential_status: string | null;
  status: string;
  source: string | null;
  aa_status: string | null;
  id_type: string;
  id_number: string | null;
  current_employer: string | null;
  average_monthly_income: string | null;
  loan_id: string | null;
  is_in_closed_loan: string | null;
  is_in_2nd_reloan: string | null;
  is_in_attrition: string | null;
  is_in_last_payment_due: string | null;
  is_in_bhv1: string | null;
  credit_score: string | null;
  loan_status: string | null;
  lead_score: number | null;
  financial_commitment_change: string | null;
  contact_preference: string | null;
  assigned_to: string | null;
  follow_up_date: Date | null;
  created_at: Date;
  updated_at: Date;
  assigned_agent_name: string | null;
  assigned_agent_email: string | null;
};

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<BorrowerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<BorrowerRecord | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [aaStatusFilter, setAaStatusFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const router = useRouter();
  const { userRole, hasAnyRole } = useUserRole();
  const { userId } = useAuth();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Load borrowers
  const fetchBorrowers = async (pageNum = 1, isLoadMore = false) => {
    if (!userId) return;

    try {
      setLoading(!isLoadMore);
      if (isLoadMore) setLoadingMore(true);

      const result = await getBorrowers({
        search: searchQuery,
        status: statusFilter || undefined,
        aa_status: aaStatusFilter || undefined,
        offset: (pageNum - 1) * 50,
        limit: 50
      });

             if (result.success && result.data) {
         if (isLoadMore) {
           setBorrowers(prev => [...prev, ...result.data as BorrowerRecord[]]);
         } else {
           setBorrowers(result.data as BorrowerRecord[]);
         }

        setHasMore(result.pagination?.hasMore ?? false);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error loading borrowers:', error);
      setError('Failed to load borrowers');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial load and filter changes
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      setPage(1);
      setBorrowers([]);
      void fetchBorrowers(1);
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery, statusFilter, aaStatusFilter, userId]);

  // Handle scroll for infinite loading
  const handleScroll = () => {
    if (!tableContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    const threshold = 100;

    if (scrollHeight - (scrollTop + clientHeight) < threshold && hasMore && !loadingMore) {
      void handleLoadMore();
    }
  };

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    await fetchBorrowers(page + 1, true);
  };

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Handle borrower actions
  const handleBorrowerAction = async (action: string, borrower: BorrowerRecord) => {
    try {
      switch (action) {
        case 'view':
          router.push(`/dashboard/borrowers/${borrower.id}`);
          break;
        case 'assign':
          setSelectedBorrower(borrower);
          setIsAssignModalOpen(true);
          break;
        case 'call':
          showNotification(`Calling ${borrower.full_name}...`, 'info');
          break;
        case 'whatsapp':
          const whatsappUrl = `https://wa.me/${borrower.phone_number.replace(/[^0-9]/g, '')}`;
          window.open(whatsappUrl, '_blank');
          break;
        default:
          showNotification(`Action ${action} for borrower ${borrower.full_name}`, 'info');
      }
    } catch (error) {
      console.error('Error handling borrower action:', error);
      showNotification('Failed to perform action', 'error');
    }
  };

  // Handle assign complete
  const handleAssignComplete = () => {
    setSelectedBorrower(null);
    setIsAssignModalOpen(false);
    // Refresh data
    setPage(1);
    setBorrowers([]);
    void fetchBorrowers(1);
    showNotification('Borrower assigned successfully', 'success');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
          notification.type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' :
          notification.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' :
          'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Borrowers</h1>
              <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                {borrowers.length} borrowers
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/borrowers/new')}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
                <span>Add Borrower</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name, phone, email, or loan ID..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:border-blue-500 focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
                showAdvancedFilters 
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              Filters
              <ChevronDownIcon className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  {allStatuses.map(status => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AA Status</label>
                <select
                  value={aaStatusFilter}
                  onChange={(e) => setAaStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All AA Status</option>
                  <option value="pending">Pending</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('');
                    setAaStatusFilter('');
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-100 text-red-700">
            {error}
          </div>
        )}

        {/* Table View */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div 
            ref={tableContainerRef}
            onScroll={handleScroll}
            className="overflow-auto max-h-[calc(100vh-300px)]"
          >
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Borrower Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading && borrowers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600">Loading borrowers...</p>
                    </td>
                  </tr>
                ) : borrowers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No borrowers found
                    </td>
                  </tr>
                ) : (
                  borrowers.map((borrower) => (
                    <tr key={borrower.id} className="hover:bg-gray-50">
                      {/* Borrower Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {borrower.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {borrower.id_type}: {borrower.id_number || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-400">
                            Score: {borrower.lead_score || 0}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            {borrower.phone_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {borrower.email || 'No email'}
                          </div>
                        </div>
                      </td>

                      {/* Loan Details */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            Amount: N/A
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {borrower.loan_id ?? 'N/A'}
                          </div>
                          <div className="text-xs text-gray-400">
                            AA: {borrower.aa_status ?? 'Pending'}
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {borrower.source || 'N/A'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(borrower.status)}`}>
                          {borrower.status}
                        </span>
                      </td>

                      {/* Assigned To */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {borrower.assigned_agent_name || 'Unassigned'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleBorrowerAction('view', borrower)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleBorrowerAction('call', borrower)}
                            className="text-green-600 hover:text-green-900"
                            title="Call"
                          >
                            <PhoneIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleBorrowerAction('whatsapp', borrower)}
                            className="text-green-600 hover:text-green-900"
                            title="WhatsApp"
                          >
                            <ChatBubbleLeftRightIcon className="h-4 w-4" />
                          </button>
                          {hasAnyRole(['admin', 'agent']) && (
                            <button
                              onClick={() => handleBorrowerAction('assign', borrower)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Assign"
                            >
                              <UserPlusIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Loading More Indicator */}
            {loadingMore && (
              <div className="py-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading more borrowers...</p>
              </div>
            )}

            {/* No more data indicator */}
            {!hasMore && borrowers.length > 0 && (
              <div className="py-4 text-center text-sm text-gray-500">
                All borrowers loaded ({borrowers.length} total)
              </div>
            )}
          </div>

          {/* Load More Button */}
          {hasMore && !loadingMore && (
            <div className="p-4 border-t">
              <button
                onClick={handleLoadMore}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Load More Borrowers
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Assign Borrower Modal */}
      <AssignBorrowerModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        borrowerId={selectedBorrower?.id ?? 0}
        borrowerName={selectedBorrower?.full_name ?? ''}
        onAssignComplete={handleAssignComplete}
      />
    </div>
  );
} 