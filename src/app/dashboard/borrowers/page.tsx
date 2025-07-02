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
  XMarkIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import { getBorrowers, updateBorrower } from '~/app/_actions/borrowers';
import { fetchAgentReloan } from '~/app/_actions/userActions';
import { useUserRole } from '../leads/useUserRole';
import AssignBorrowerModal from '~/app/_components/AssignBorrowerModal';
import BorrowerWhatsAppModal from '~/app/_components/BorrowerWhatsAppModal';
import BorrowerCallModal from '~/app/_components/BorrowerCallModal';
import BorrowerQuestionnaireModal from '~/app/_components/BorrowerQuestionnaireModal';
import BorrowerStatusUpdateModal from '~/app/_components/BorrowerStatusUpdateModal';

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
  latest_completed_loan_date: string | null;
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
  const [sourceFilter, setSourceFilter] = useState(''); // Will be set based on role
  const [leadScoreFilter, setLeadScoreFilter] = useState('');
  const [performanceBucketFilter, setPerformanceBucketFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState(''); // Will be set based on role
  const [createdDateStart, setCreatedDateStart] = useState('');
  const [createdDateEnd, setCreatedDateEnd] = useState('');
  const [followUpDateStart, setFollowUpDateStart] = useState('');
  const [followUpDateEnd, setFollowUpDateEnd] = useState('');
  const [lastLoanDateStart, setLastLoanDateStart] = useState('');
  const [lastLoanDateEnd, setLastLoanDateEnd] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<{id: string; name: string}[]>([]);
  const [selectedBorrowerIds, setSelectedBorrowerIds] = useState<Set<number>>(new Set());
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [showIndividualWhatsAppModal, setShowIndividualWhatsAppModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [whatsappBorrowers, setWhatsappBorrowers] = useState<{id: number; full_name: string; phone_number: string}[]>([]);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callBorrower, setCallBorrower] = useState<{ id: number; full_name: string; phone_number: string } | null>(null);
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
  const [questionnaireBorrower, setQuestionnaireBorrower] = useState<BorrowerRecord | null>(null);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [statusUpdateBorrower, setStatusUpdateBorrower] = useState<{id: number; full_name: string; phone_number: string; status: string} | null>(null);
  const [preSelectedStatus, setPreSelectedStatus] = useState<'follow_up' | 'no_answer' | 'give_up' | 'blacklisted' | undefined>(undefined);
  
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
        created_date_start: createdDateStart || undefined,
        created_date_end: createdDateEnd || undefined,
        follow_up_date_start: followUpDateStart || undefined,
        follow_up_date_end: followUpDateEnd || undefined,
        last_loan_date_start: lastLoanDateStart || undefined,
        last_loan_date_end: lastLoanDateEnd || undefined,
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
        created_date_start: createdDateStart || undefined,
        created_date_end: createdDateEnd || undefined,
        follow_up_date_start: followUpDateStart || undefined,
        follow_up_date_end: followUpDateEnd || undefined,
        last_loan_date_start: lastLoanDateStart || undefined,
        last_loan_date_end: lastLoanDateEnd || undefined,
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

  // Set role-based default filters
  useEffect(() => {
    if (userRole) {
      if (userRole.includes('agent-reloan')) {
        // For agent-reloan: Default to Attrition Risk source and My Assignment
        setSourceFilter('Attrition Risk');
        setAssignedFilter('my_borrowers');
      } else {
        // For admin: Default to Attrition Risk source, no assignment filter
        setSourceFilter('Attrition Risk');
        setAssignedFilter('');
      }
    }
  }, [userRole]);

  // Load available agents
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const result = await fetchAgentReloan();
        if (result.success) {
          const agentOptions = result.users.map((user: { id: string; firstName: string | null; lastName: string | null; email: string | null }) => ({
            id: user.id,
            name: ((user.firstName ?? '') + ' ' + (user.lastName ?? '')).trim() || (user.email ?? 'Unknown')
          }));
          setAvailableAgents(agentOptions);
        }
      } catch (error) {
        console.error('Error loading agents:', error);
      }
    };

    void loadAgents();
  }, []);

  // Initial load and filter changes
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      setPage(1);
      setBorrowers([]);
      void fetchBorrowers(1);
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery, statusFilter, aaStatusFilter, sourceFilter, leadScoreFilter, performanceBucketFilter, assignedFilter, createdDateStart, createdDateEnd, followUpDateStart, followUpDateEnd, lastLoanDateStart, lastLoanDateEnd, userId]);

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
    setLeadScoreFilter('');
    setPerformanceBucketFilter('');
    setCreatedDateStart('');
    setCreatedDateEnd('');
    setFollowUpDateStart('');
    setFollowUpDateEnd('');
    setLastLoanDateStart('');
    setLastLoanDateEnd('');
    
    // Reset to role-based defaults
    if (userRole?.includes('agent-reloan')) {
      setSourceFilter('Attrition Risk');
      setAssignedFilter('my_borrowers');
    } else {
      setSourceFilter('Attrition Risk');
      setAssignedFilter('');
    }
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
          setCallBorrower({
            id: borrower.id,
            full_name: borrower.full_name,
            phone_number: borrower.phone_number
          });
          setShowCallModal(true);
          break;
        case 'questionnaire':
          setQuestionnaireBorrower(borrower);
          setShowQuestionnaireModal(true);
          break;
        case 'status_update':
          setStatusUpdateBorrower({
            id: borrower.id,
            full_name: borrower.full_name,
            phone_number: borrower.phone_number,
            status: borrower.status
          });
          setPreSelectedStatus(undefined);
          setShowStatusUpdateModal(true);
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
    console.log('=== ASSIGNMENT COMPLETE ===');
    console.log('Refreshing borrowers list to show updated status...');
    
    setSelectedBorrower(null);
    setIsAssignModalOpen(false);
    setShowBulkAssignModal(false);
    setSelectedBorrowerIds(new Set()); // Clear selections after bulk operation
    // Refresh data
    setPage(1);
    setBorrowers([]);
    void fetchBorrowers(1);
    showNotification('Borrower(s) assigned successfully', 'success');
    
    console.log('Borrowers list refresh initiated');
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

    setWhatsappBorrowers(selectedBorrowers);
    setShowBulkWhatsAppModal(true);
  };

  // Handle bulk assign
  const handleBulkAssign = () => {
    if (selectedBorrowerIds.size === 0) {
      showNotification('Please select borrowers first', 'error');
      return;
    }

    setShowBulkAssignModal(true);
  };

  // Handle WhatsApp success
  const handleWhatsAppSuccess = () => {
    showNotification('WhatsApp message(s) sent successfully', 'success');
    // Clear selection after bulk send
    if (showBulkWhatsAppModal) {
      setSelectedBorrowerIds(new Set());
    }
  };

  // Handle questionnaire update
  const handleQuestionnaireUpdate = () => {
    showNotification('Borrower information updated successfully', 'success');
    // Refresh data
    setPage(1);
    setBorrowers([]);
    void fetchBorrowers(1);
  };

  // Handle status update success
  const handleStatusUpdate = () => {
    showNotification('Borrower status updated successfully', 'success');
    // Refresh data
    setPage(1);
    setBorrowers([]);
    void fetchBorrowers(1);
  };

  // Utility function for quick status updates with pre-selected status
  const handleQuickStatusUpdate = (borrower: BorrowerRecord, status: 'follow_up' | 'no_answer' | 'give_up' | 'blacklisted') => {
    setStatusUpdateBorrower({
      id: borrower.id,
      full_name: borrower.full_name,
      phone_number: borrower.phone_number,
      status: borrower.status
    });
    setPreSelectedStatus(status);
    setShowStatusUpdateModal(true);
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
                  {hasAnyRole(['admin']) && (
                    <button
                      onClick={handleBulkAssign}
                      className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <UserGroupIcon className="h-5 w-5" />
                      <span>Manage Assignments ({selectedBorrowerIds.size})</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedBorrowerIds(new Set())}
                    className="flex items-center space-x-2 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    <span>Clear</span>
                  </button>
                </>
              )}
              
              {hasAnyRole(['admin']) && (
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
              )}
              
              {hasAnyRole(['admin']) && (
                <button
                  onClick={() => router.push('/dashboard/borrowers/new')}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="h-5 w-5" />
                  <span>Add Borrower</span>
                </button>
              )}
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
              {/* Main Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {allStatuses.map(status => (
                      <option key={status.id} value={status.id}>{status.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {sourceOptions.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignment</label>
                  <select
                    value={assignedFilter}
                    onChange={(e) => setAssignedFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    <option value="my_borrowers">My Assignment</option>
                    {availableAgents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
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
                    <option value="">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
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

              {/* Date Range Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={createdDateStart}
                      onChange={(e) => setCreatedDateStart(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="Start date"
                    />
                    <input
                      type="date"
                      value={createdDateEnd}
                      onChange={(e) => setCreatedDateEnd(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="End date"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={followUpDateStart}
                      onChange={(e) => setFollowUpDateStart(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="Start date"
                    />
                    <input
                      type="date"
                      value={followUpDateEnd}
                      onChange={(e) => setFollowUpDateEnd(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="End date"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Loan Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={lastLoanDateStart}
                      onChange={(e) => setLastLoanDateStart(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="Start date"
                    />
                    <input
                      type="date"
                      value={lastLoanDateEnd}
                      onChange={(e) => setLastLoanDateEnd(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="End date"
                    />
                  </div>
                </div>
              </div>

              {/* Active Filters Display */}
              {(statusFilter || aaStatusFilter || (sourceFilter && sourceFilter !== 'Attrition Risk') || leadScoreFilter || performanceBucketFilter || assignedFilter || createdDateStart || createdDateEnd || followUpDateStart || followUpDateEnd || lastLoanDateStart || lastLoanDateEnd) && (
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
                    {sourceFilter && sourceFilter !== 'Attrition Risk' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Source: {sourceFilter}
                        <button onClick={() => setSourceFilter('Attrition Risk')} className="ml-2 text-green-600 hover:text-green-800">×</button>
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
                    {assignedFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                        Assignment: {assignedFilter === 'my_borrowers' ? 'My Borrowers' : availableAgents.find(a => a.id === assignedFilter)?.name ?? assignedFilter}
                        <button onClick={() => setAssignedFilter('')} className="ml-2 text-pink-600 hover:text-pink-800">×</button>
                      </span>
                    )}
                    {(createdDateStart || createdDateEnd) && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Created: {createdDateStart ?? 'Any'} - {createdDateEnd ?? 'Any'}
                        <button onClick={() => { setCreatedDateStart(''); setCreatedDateEnd(''); }} className="ml-2 text-gray-600 hover:text-gray-800">×</button>
                      </span>
                    )}
                    {(followUpDateStart || followUpDateEnd) && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Follow-up: {followUpDateStart ?? 'Any'} - {followUpDateEnd ?? 'Any'}
                        <button onClick={() => { setFollowUpDateStart(''); setFollowUpDateEnd(''); }} className="ml-2 text-gray-600 hover:text-gray-800">×</button>
                      </span>
                    )}
                    {(lastLoanDateStart || lastLoanDateEnd) && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        Last Loan: {lastLoanDateStart ?? 'Any'} - {lastLoanDateEnd ?? 'Any'}
                        <button onClick={() => { setLastLoanDateStart(''); setLastLoanDateEnd(''); }} className="ml-2 text-orange-600 hover:text-orange-800">×</button>
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
                    Lead Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Information
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
                      {/* Checkbox */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedBorrowerIds.has(borrower.id)}
                          onChange={(e) => handleBorrowerSelect(borrower.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      
                      {/* Lead Contact */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {borrower.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {borrower.phone_number}
                          </div>
                          <div className="text-xs text-gray-400">
                            {borrower.email ?? 'No email'}
                          </div>
                        </div>
                      </td>

                      {/* Date Information */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">
                            Created: {new Date(borrower.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            Updated: {borrower.updated_at ? new Date(borrower.updated_at).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            Last Loan Completed: {borrower.latest_completed_loan_date ? new Date(borrower.latest_completed_loan_date).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            Follow-up: {borrower.follow_up_date ? new Date(borrower.follow_up_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {borrower.source ?? 'N/A'}
                        </div>
                        <div className="text-xs text-gray-400">
                          AA: {borrower.aa_status ?? 'Pending'}
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
                          <button
                            onClick={() => handleBorrowerAction('questionnaire', borrower)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Update Questionnaire & Profile"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleBorrowerAction('status_update', borrower)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Update Status"
                          >
                            <AdjustmentsHorizontalIcon className="h-4 w-4" />
                          </button>
                          {hasAnyRole(['admin']) && (
                            <button
                              onClick={() => handleBorrowerAction('assign', borrower)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Manage Assignment"
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

      {/* Assign Borrower Modal - Only for admins */}
      {hasAnyRole(['admin']) && (
        <AssignBorrowerModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          borrowerId={selectedBorrower?.id ?? 0}
          borrowerName={selectedBorrower?.full_name ?? ''}
          onAssignComplete={handleAssignComplete}
        />
      )}

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

      {/* Bulk Assign Modal - Only for admins */}
      {hasAnyRole(['admin']) && (
        <AssignBorrowerModal
          isOpen={showBulkAssignModal}
          onClose={() => setShowBulkAssignModal(false)}
          borrowerIds={Array.from(selectedBorrowerIds)}
          borrowerNames={borrowers.filter(b => selectedBorrowerIds.has(b.id)).map(b => b.full_name)}
          isBulkMode={true}
          onAssignComplete={handleAssignComplete}
        />
      )}

      {/* Call Modal */}
      <BorrowerCallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        borrower={callBorrower}
      />

      {/* Questionnaire Modal */}
      <BorrowerQuestionnaireModal
        isOpen={showQuestionnaireModal}
        onClose={() => setShowQuestionnaireModal(false)}
        borrower={questionnaireBorrower as any}
        onUpdate={handleQuestionnaireUpdate}
      />

      {/* Status Update Modal */}
      <BorrowerStatusUpdateModal
        isOpen={showStatusUpdateModal}
        onClose={() => setShowStatusUpdateModal(false)}
        borrower={statusUpdateBorrower}
        preSelectedStatus={preSelectedStatus}
        onUpdate={handleStatusUpdate}
        showNotification={showNotification}
      />
    </div>
  );
} 