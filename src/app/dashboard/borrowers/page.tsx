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
  ChevronDownIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { getBorrowers, updateBorrower } from '~/app/_actions/borrowers';
import { useUserRole } from '../leads/useUserRole';
import AssignBorrowerModal from '~/app/_components/AssignBorrowerModal';
import BorrowerWhatsAppModal from '~/app/_components/BorrowerWhatsAppModal';

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

// Enhanced filter options
const sourceOptions = [
  'Closed Loan', 'Attrition Risk', '2nd Reloan', 'Last Payment Due', 'BHV1', 'Not Eligible'
];

const leadScoreRanges = [
  { value: 'high', label: 'High (75-100)', min: 75, max: 100 },
  { value: 'medium', label: 'Medium (50-74)', min: 50, max: 74 },
  { value: 'low', label: 'Low (0-49)', min: 0, max: 49 }
];

const performanceBuckets = [
  { value: 'closed_loan', label: 'Closed Loan', field: 'is_in_closed_loan' },
  { value: '2nd_reloan', label: '2nd Reloan', field: 'is_in_2nd_reloan' },
  { value: 'attrition', label: 'Attrition Risk', field: 'is_in_attrition' },
  { value: 'last_payment', label: 'Last Payment Due', field: 'is_in_last_payment_due' },
  { value: 'bhv1', label: 'BHV1 Pattern', field: 'is_in_bhv1' }
];

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
  updated_at: Date | null;
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
  const [sourceFilter, setSourceFilter] = useState('');
  const [leadScoreFilter, setLeadScoreFilter] = useState('');
  const [performanceBucketFilter, setPerformanceBucketFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('attrition'); // Default to attrition
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [selectedBorrowerIds, setSelectedBorrowerIds] = useState<Set<number>>(new Set());
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [showIndividualWhatsAppModal, setShowIndividualWhatsAppModal] = useState(false);
  const [whatsappBorrowers, setWhatsappBorrowers] = useState<{id: number; full_name: string; phone_number: string}[]>([]);
  
  const router = useRouter();
  const { userRole, hasAnyRole } = useUserRole();
  const { userId } = useAuth();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Enhanced CSV export functionality
  const generateEmail = (phoneNumber: string): string => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const randomDigits = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `ac${cleanPhone}${randomDigits}@gmail.com`;
  };

  const formatPhoneForCsv = (phoneNumber: string): string => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    return `65${cleanPhone}`;
  };

  const exportToCSV = async () => {
    setExportingCsv(true);
    try {
      // Fetch all borrowers with current filters using backend filtering
      const result = await getBorrowers({
        search: searchQuery,
        status: statusFilter || undefined,
        aa_status: aaStatusFilter || undefined,
        source: sourceFilter || undefined,
        lead_score_range: leadScoreFilter || undefined,
        performance_bucket: performanceBucketFilter || undefined,
        assigned_filter: assignedFilter || undefined,
        date_range: dateRangeFilter || undefined,
        offset: 0,
        limit: 10000 // Large limit to get all filtered results
      });

      if (result.success && result.data) {
        const csvData = result.data.map((borrower) => ({
          leadSource: borrower.source ?? 'System',
          fullName: borrower.full_name,
          email: borrower.email ?? generateEmail(borrower.phone_number),
          personalPhone: formatPhoneForCsv(borrower.phone_number),
          workPhone: '6583992504'
        }));

        // Convert to CSV
        const headers = ['leadSource', 'fullName', 'email', 'personalPhone', 'workPhone'];
        const csvContent = [
          headers.join(','),
          ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `borrowers_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification(`Successfully exported ${csvData.length} borrowers to CSV`, 'success');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      showNotification('Failed to export CSV', 'error');
    } finally {
      setExportingCsv(false);
    }
  };

  // Load borrowers with backend filtering
  const fetchBorrowers = async (pageNum = 1, isLoadMore = false) => {
    if (!userId) return;

    try {
      setLoading(!isLoadMore);
      if (isLoadMore) setLoadingMore(true);
      
      // Clear selections when filters change (not on load more)
      if (!isLoadMore) {
        setSelectedBorrowerIds(new Set());
      }

      const result = await getBorrowers({
        search: searchQuery,
        status: statusFilter || undefined,
        aa_status: aaStatusFilter || undefined,
        source: sourceFilter || undefined,
        lead_score_range: leadScoreFilter || undefined,
        performance_bucket: performanceBucketFilter || undefined,
        assigned_filter: assignedFilter || undefined,
        date_range: dateRangeFilter || undefined,
        offset: (pageNum - 1) * 50,
        limit: 50
      });

      if (result.success && result.data) {
        const borrowersData = result.data as BorrowerRecord[];

        if (isLoadMore) {
          setBorrowers(prev => [...prev, ...borrowersData]);
        } else {
          setBorrowers(borrowersData);
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
  }, [searchQuery, statusFilter, aaStatusFilter, sourceFilter, leadScoreFilter, performanceBucketFilter, assignedFilter, dateRangeFilter, userId]);

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

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setAaStatusFilter('');
    setSourceFilter('');
    setLeadScoreFilter('');
    setPerformanceBucketFilter('');
    setAssignedFilter('attrition'); // Reset to default attrition filter
    setDateRangeFilter('');
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
          handleIndividualWhatsApp(borrower);
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

  // Handle checkbox selection
  const handleBorrowerSelect = (borrowerId: number, isSelected: boolean) => {
    const newSelection = new Set(selectedBorrowerIds);
    if (isSelected) {
      newSelection.add(borrowerId);
    } else {
      newSelection.delete(borrowerId);
    }
    setSelectedBorrowerIds(newSelection);
  };

  // Handle select all
  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const allIds = new Set(borrowers.map(b => b.id));
      setSelectedBorrowerIds(allIds);
    } else {
      setSelectedBorrowerIds(new Set());
    }
  };

  // Handle individual WhatsApp
  const handleIndividualWhatsApp = (borrower: BorrowerRecord) => {
    setWhatsappBorrowers([{
      id: borrower.id,
      full_name: borrower.full_name,
      phone_number: borrower.phone_number
    }]);
    setShowIndividualWhatsAppModal(true);
  };

  // Handle bulk WhatsApp
  const handleBulkWhatsApp = () => {
    const selectedBorrowers = borrowers
      .filter(b => selectedBorrowerIds.has(b.id))
      .map(b => ({
        id: b.id,
        full_name: b.full_name,
        phone_number: b.phone_number
      }));
    
    if (selectedBorrowers.length === 0) {
      showNotification('Please select borrowers first', 'error');
      return;
    }

    // Confirmation for bulk actions
    const confirmed = confirm(
      `Send WhatsApp messages to ${selectedBorrowers.length} selected borrower${selectedBorrowers.length > 1 ? 's' : ''}?\n\nThis will use reloan customer templates only.`
    );
    
    if (!confirmed) return;

    setWhatsappBorrowers(selectedBorrowers);
    setShowBulkWhatsAppModal(true);
  };

  // Handle WhatsApp success
  const handleWhatsAppSuccess = () => {
    showNotification('WhatsApp message(s) sent successfully', 'success');
    // Clear selection after bulk send
    if (showBulkWhatsAppModal) {
      setSelectedBorrowerIds(new Set());
    }
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
              {selectedBorrowerIds.size > 0 && (
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  {selectedBorrowerIds.size} selected
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {selectedBorrowerIds.size > 0 && (
                <>
                  <button
                    onClick={handleBulkWhatsApp}
                    className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ChatBubbleLeftRightIcon className="h-5 w-5" />
                    <span>Send WhatsApp ({selectedBorrowerIds.size})</span>
                  </button>
                  <button
                    onClick={() => setSelectedBorrowerIds(new Set())}
                    className="flex items-center space-x-2 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    <span>Clear</span>
                  </button>
                </>
              )}
              
              <button
                onClick={exportToCSV}
                disabled={exportingCsv || borrowers.length === 0}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  exportingCsv || borrowers.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
              </button>
              
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

      {/* Enhanced Search and Filter Bar */}
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

          {/* Enhanced Advanced Filters */}
          {showAdvancedFilters && (
            <div className="border-t pt-4 space-y-4">
              {/* First Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All Sources</option>
                    {sourceOptions.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>

                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Score</label>
                  <select
                    value={leadScoreFilter}
                    onChange={(e) => setLeadScoreFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All Scores</option>
                    {leadScoreRanges.map(range => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                    ))}
                  </select>
                </div> */}
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Performance Bucket</label>
                  <select
                    value={performanceBucketFilter}
                    onChange={(e) => setPerformanceBucketFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All Buckets</option>
                    {performanceBuckets.map(bucket => (
                      <option key={bucket.value} value={bucket.value}>{bucket.label}</option>
                    ))}
                  </select>
                </div> */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignment</label>
                  <select
                    value={assignedFilter}
                    onChange={(e) => setAssignedFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    <option value="attrition">Attrition Risk</option>
                    <option value="assigned">Assigned</option>
                    <option value="unassigned">Unassigned</option>
                    <option value="my_borrowers">My Borrowers</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <select
                    value={dateRangeFilter}
                    onChange={(e) => setDateRangeFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="this_year">This Year</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearAllFilters}
                    className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>

              {/* Active Filters Display */}
              {(statusFilter || aaStatusFilter || sourceFilter || leadScoreFilter || performanceBucketFilter || (assignedFilter && assignedFilter !== 'attrition') || dateRangeFilter) && (
                <div className="border-t pt-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-gray-600">Active Filters:</span>
                    {statusFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Status: {allStatuses.find(s => s.id === statusFilter)?.name}
                        <button onClick={() => setStatusFilter('')} className="ml-2 text-blue-600 hover:text-blue-800">×</button>
                      </span>
                    )}
                    {aaStatusFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        AA: {aaStatusFilter}
                        <button onClick={() => setAaStatusFilter('')} className="ml-2 text-purple-600 hover:text-purple-800">×</button>
                      </span>
                    )}
                    {sourceFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Source: {sourceFilter}
                        <button onClick={() => setSourceFilter('')} className="ml-2 text-green-600 hover:text-green-800">×</button>
                      </span>
                    )}
                    {leadScoreFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Score: {leadScoreRanges.find(r => r.value === leadScoreFilter)?.label}
                        <button onClick={() => setLeadScoreFilter('')} className="ml-2 text-yellow-600 hover:text-yellow-800">×</button>
                      </span>
                    )}
                    {performanceBucketFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Bucket: {performanceBuckets.find(b => b.value === performanceBucketFilter)?.label}
                        <button onClick={() => setPerformanceBucketFilter('')} className="ml-2 text-indigo-600 hover:text-indigo-800">×</button>
                      </span>
                    )}
                    {assignedFilter && assignedFilter !== 'attrition' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                        Assignment: {assignedFilter === 'my_borrowers' ? 'My Borrowers' : assignedFilter === 'attrition' ? 'Attrition Risk' : assignedFilter.charAt(0).toUpperCase() + assignedFilter.slice(1)}
                        <button onClick={() => setAssignedFilter('attrition')} className="ml-2 text-pink-600 hover:text-pink-800">×</button>
                      </span>
                    )}
                    {dateRangeFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Date: {dateRangeFilter.replace('_', ' ')}
                        <button onClick={() => setDateRangeFilter('')} className="ml-2 text-gray-600 hover:text-gray-800">×</button>
                      </span>
                    )}
                  </div>
                </div>
              )}
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
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={borrowers.length > 0 && selectedBorrowerIds.size === borrowers.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
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
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600">Loading borrowers...</p>
                    </td>
                  </tr>
                ) : borrowers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No borrowers found
                    </td>
                  </tr>
                ) : (
                  borrowers.map((borrower) => (
                    <tr key={borrower.id} className="hover:bg-gray-50">
                      {/* Checkbox */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedBorrowerIds.has(borrower.id)}
                          onChange={(e) => handleBorrowerSelect(borrower.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      
                      {/* Borrower Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {borrower.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {borrower.id_type}: {borrower.id_number ?? 'N/A'}
                          </div>
                          <div className="text-xs text-gray-400">
                            Score: {borrower.lead_score ?? 0}
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
                            {borrower.email ?? 'No email'}
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
                          {borrower.source ?? 'N/A'}
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
                          {borrower.assigned_agent_name ?? 'Unassigned'}
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
                            title="Send WhatsApp (Reloan Templates)"
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

      {/* Individual WhatsApp Modal */}
      <BorrowerWhatsAppModal
        isOpen={showIndividualWhatsAppModal}
        onClose={() => setShowIndividualWhatsAppModal(false)}
        borrowers={whatsappBorrowers}
        isBulkMode={false}
        onSuccess={handleWhatsAppSuccess}
      />

      {/* Bulk WhatsApp Modal */}
      <BorrowerWhatsAppModal
        isOpen={showBulkWhatsAppModal}
        onClose={() => setShowBulkWhatsAppModal(false)}
        borrowers={whatsappBorrowers}
        isBulkMode={true}
        onSuccess={handleWhatsAppSuccess}
      />
    </div>
  );
} 