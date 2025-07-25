"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { 
  PlusIcon, 
  FunnelIcon,
  MagnifyingGlassIcon as SearchIcon,
  UserGroupIcon,
  BookmarkIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  ArrowUpTrayIcon,
  CalendarIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserPlusIcon,
  ArrowDownOnSquareIcon,
  DocumentArrowDownIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import LeadCard  from '~/app/_components/LeadCard';
import { hasPermission } from '~/server/rbac/queries';
import { updateLead,updateLeadStatus, fetchFilteredLeads, getLeadCountsByStatus, getAvailableAgents, getFilterOptions } from '~/app/_actions/leadActions';
import { type InferSelectModel } from 'drizzle-orm';
import { type leads, type leadStatusEnum } from "~/server/db/schema";
import { togglePinLead, getPinnedLeads } from '~/app/_actions/pinnedLeadActions';
import { sendWhatsAppMessage } from '~/app/_actions/whatsappActions';
import { checkInAgent, checkOutAgent, autoAssignLeads, checkAgentStatus, getAutoAssignmentSettings, updateAutoAssignmentSettings, getAssignmentPreviewWithRoundRobin, bulkAutoAssignLeads, updateAgentCapacity, resetRoundRobinIndex, getManualAssignmentPreview } from '~/app/_actions/agentActions';
import { useUserRole } from './useUserRole';
import type { UserRole } from './useUserRole';
import AssignLeadModal from '~/app/_components/AssignLeadModal';
import { exportAllLeadsToCSV } from '~/app/_actions/exportActions';
import { makeCall } from '~/app/_actions/callActions';
import LeadEditSlideOver from '~/app/_components/LeadEditSlideOver';
import CustomWhatsAppModal from '~/app/_components/CustomWhatsAppModal';
import LeadStatusReasonModal from '~/app/_components/LeadStatusReasonModal';
import LeadsFilterComponent, { type FilterOptions, type SortOptions } from '~/app/_components/LeadsFilterComponent';
import { type Lead } from '~/app/types';
import { getTodaySGT } from '~/lib/timezone';

// Update the StatusInfo type to use the schema's lead status enum
type StatusInfo = {
  id: typeof leadStatusEnum.enumValues[number];
  name: string;
  color: string;
};

// Define valid lead statuses
const LEAD_STATUSES = [
  'new',
  'assigned',
  'no_answer',
  'follow_up',
  'booked',
  'give_up',
  'done',
  'missed/RS',
  'unqualified',
  'blacklisted'
] as const;

type LeadStatus = typeof LEAD_STATUSES[number];

// Define status info for styling
const allStatuses = [
  { id: 'new', name: 'New', color: 'bg-blue-100 text-blue-800' },
  { id: 'assigned', name: 'Assigned', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'no_answer', name: 'No Answer', color: 'bg-gray-100 text-gray-800' },
  { id: 'follow_up', name: 'Follow Up', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'missed/RS', name: 'Missed/RS', color: 'bg-red-100 text-red-800' },
  { id: 'booked', name: 'Booked', color: 'bg-green-100 text-green-800' },
  { id: 'give_up', name: 'Give Up', color: 'bg-red-100 text-red-800' },
  { id: 'done', name: 'Done', color: 'bg-green-100 text-green-800' },
  { id: 'unqualified', name: 'Duplicate/Reloan', color: 'bg-orange-100 text-orange-800' },
  { id: 'blacklisted', name: 'Blacklisted', color: 'bg-black text-white' },
] as const;

// Tab options
const TABS = [
  { id: 'kanban', name: 'Kanban Board', icon: <FunnelIcon className="h-5 w-5" /> }
  // { id: 'all', name: 'All Leads', icon: <UserGroupIcon className="h-5 w-5" /> },
  // { id: 'pinned', name: 'Pinned Leads', icon: <BookmarkIcon className="h-5 w-5" /> },
];

// Get status color
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

// Enhanced filter interface
interface LeadFilters {
  status?: LeadStatus;
  search?: string;
  sortBy?: 'id' | 'created_at' | 'updated_at' | 'full_name' | 'amount' | 'phone_number' | 'employment_salary' | 'lead_score' | 'follow_up_date';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  // Backend filters - these will be sent to fetchFilteredLeads
  amountMin?: number;
  amountMax?: number;
  source?: string[];
  employmentStatus?: string[];
  loanPurpose?: string[];
  residentialStatus?: string[];
  assignedTo?: string[];
  dateFrom?: string;
  dateTo?: string;
  leadType?: string[];
  eligibilityStatus?: string[];
}

// Interface for fetchFilteredLeads parameters
interface FetchLeadsParams {
  searchQuery?: string;
  searchOptions?: {
    status?: LeadStatus[];
    assignedTo?: string[];
    includeUnassigned?: boolean;
    bookedBy?: string[];
    sources?: string[];
    employmentStatuses?: string[];
    loanPurposes?: string[];
    residentialStatuses?: string[];
    leadTypes?: string[];
    eligibilityStatuses?: string[];
    amountMin?: number;
    amountMax?: number;
    dateFrom?: string;
    dateTo?: string;
    followUpDateFrom?: string;
    followUpDateTo?: string;
    assignedInLastDays?: number;
  };
  sortOptions?: {
    sortBy?: 'id' | 'created_at' | 'updated_at' | 'full_name' | 'amount' | 'phone_number' | 'employment_salary' | 'lead_score' | 'follow_up_date';
    sortOrder?: 'asc' | 'desc';
  };
  page?: number;
  limit?: number;
}

// Sorting options type
type SortingOption = {
  value: string;
  label: string;
  sortBy: 'id' | 'created_at' | 'updated_at' | 'full_name' | 'amount' | 'phone_number' | 'employment_salary' | 'lead_score' | 'follow_up_date';
  sortOrder: 'asc' | 'desc';
};

// Sorting options
const SORTING_OPTIONS: SortingOption[] = [
  { value: 'updated_at_desc', label: 'Recently Updated', sortBy: 'updated_at', sortOrder: 'desc' },
  { value: 'updated_at_asc', label: 'Oldest Updated', sortBy: 'updated_at', sortOrder: 'asc' },
  { value: 'created_at_desc', label: 'Recently Created', sortBy: 'created_at', sortOrder: 'desc' },
  { value: 'created_at_asc', label: 'Oldest Created', sortBy: 'created_at', sortOrder: 'asc' },
  { value: 'full_name_asc', label: 'Name A-Z', sortBy: 'full_name', sortOrder: 'asc' },
  { value: 'full_name_desc', label: 'Name Z-A', sortBy: 'full_name', sortOrder: 'desc' },
  { value: 'amount_desc', label: 'Amount High-Low', sortBy: 'amount', sortOrder: 'desc' },
  { value: 'amount_asc', label: 'Amount Low-High', sortBy: 'amount', sortOrder: 'asc' },
  { value: 'follow_up_date_asc', label: 'Follow Up Date (Soonest)', sortBy: 'follow_up_date', sortOrder: 'asc' },
  { value: 'follow_up_date_desc', label: 'Follow Up Date (Latest)', sortBy: 'follow_up_date', sortOrder: 'desc' },
  { value: 'lead_score_desc', label: 'Lead Score High-Low', sortBy: 'lead_score', sortOrder: 'desc' },
  { value: 'lead_score_asc', label: 'Lead Score Low-High', sortBy: 'lead_score', sortOrder: 'asc' },
  { value: 'id_desc', label: 'ID High-Low', sortBy: 'id', sortOrder: 'desc' },
  { value: 'id_asc', label: 'ID Low-High', sortBy: 'id', sortOrder: 'asc' }
];

// Default filter configuration for agents and admins
interface DefaultFilters {
  showAllStatuses: boolean;
  showAssignedToMe: boolean;
  showUnassigned: boolean;
  showDateRange: boolean;
  showAmountRange: boolean;
  showSources: boolean;
  showEmploymentStatus: boolean;
  showLoanPurpose: boolean;
  showResidentialStatus: boolean;
  showLeadType: boolean;
  showEligibilityStatus: boolean;
  // Fine-grained status control
  visibleStatuses: Record<LeadStatus, boolean>;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Record<string, Lead[]>>({});
  const [pinnedLeads, setPinnedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  // const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkingInOut, setCheckingInOut] = useState(false);
  const [assignmentPreview, setAssignmentPreview] = useState<{
    agentId: string;
    agentName: string;
    leadCount: number;
  }[]>([]);
  const [assignmentStats, setAssignmentStats] = useState({
    totalAgents: 0,
    totalLeads: 0
  });
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const router = useRouter();
  const { userRole, hasRole, hasAnyRole } = useUserRole();
  const { userId } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAssignConfirmation, setShowAssignConfirmation] = useState(false);
  const [showDisableConfirmation, setShowDisableConfirmation] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ leadId: number, newStatus: string } | null>(null);
  const [leadTags, setLeadTags] = useState<Record<number, { id: number, name: string }>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<LeadFilters>({
    status: 'new',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    page: 1,
    limit: 100
  });
  const [statusFilter, setStatusFilter] = useState<LeadStatus>('new');
  const validStatuses = LEAD_STATUSES;

  // Define statuses that agents can access - priority order: assigned, follow_up, missed/RS, done
  const agentAllowedStatuses = [
    'assigned',
    'follow_up',
    'missed/RS',
    'give_up',
    'done'
  ];

  // Add new state for tracking pagination
  const [page, setPage] = useState(1);


  // Add state for all loaded leads
  const [allLoadedLeads, setAllLoadedLeads] = useState<Lead[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add refs for each column
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Add new state for export modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ loading: boolean; error?: string; success?: string }>({ 
    loading: false 
  });

  // Add selected statuses state
  const [selectedExportStatuses, setSelectedExportStatuses] = useState<Record<string, boolean>>({
    assigned: true,
    no_answer: true,
    follow_up: true,
    'missed/RS': true,
    booked: false,
    done: false,
    new: false,
    unqualified: false,
    give_up: false,
    blacklisted: false
  });

  const [isEditOpen, setIsEditOpen] = useState(false);

  // Auto-assignment states
  const [autoAssignmentSettings, setAutoAssignmentSettings] = useState<{
    is_enabled: boolean;
    assignment_method: string;
    max_leads_per_agent_per_day: number;
    current_round_robin_index: number;
  } | null>(null);
  const [isAutoAssignModalOpen, setIsAutoAssignModalOpen] = useState(false);
  const [isLoadingAutoSettings, setIsLoadingAutoSettings] = useState(false);
  const [autoAssignPreview, setAutoAssignPreview] = useState<{
    agentId: string;
    agentName: string;
    leadCount: number;
    currentCount: number;
    capacity: number;
    weight: number;
    canReceiveMore: boolean;
  }[]>([]);
  const [autoAssignStats, setAutoAssignStats] = useState({
    totalAgents: 0,
    totalLeads: 0,
    leadsToAssign: 0
  });

  // New state for advanced filtering
  const [activeFilters, setActiveFilters] = useState<LeadFilters>({});
  
  // New filter component state
  const [componentFilterOptions, setComponentFilterOptions] = useState<FilterOptions>({});
  const [componentSortOptions, setComponentSortOptions] = useState<SortOptions>({
    sortBy: 'updated_at',
    sortOrder: 'desc'
  });
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [showAdvancedFiltersPanel, setShowAdvancedFiltersPanel] = useState(false);

  // Add WhatsApp modal state at page level
  const [isPageWhatsAppModalOpen, setIsPageWhatsAppModalOpen] = useState(false);
  const [whatsAppLeadData, setWhatsAppLeadData] = useState<{
    phoneNumber: string;
    leadId: number;
  } | null>(null);

  // Add status reason modal state
  const [isStatusReasonModalOpen, setIsStatusReasonModalOpen] = useState(false);
  const [statusReasonLeadData, setStatusReasonLeadData] = useState<{
    leadId: number;
    leadName: string;
  } | null>(null);

  // Add state for total lead counts by status
  const [totalLeadCounts, setTotalLeadCounts] = useState<Record<string, number>>({});

  // Add state for smart auto-loading for agents
  const [loadingAttempts, setLoadingAttempts] = useState<Record<string, number>>({});
  const [statusHasMoreData, setStatusHasMoreData] = useState<Record<string, boolean>>({});

  // Add state to prevent multiple auto-loading attempts
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [autoLoadingAttempts, setAutoLoadingAttempts] = useState(0);

  // Add state for search-based auto-loading
  const [isSearchAutoLoading, setIsSearchAutoLoading] = useState(false);
  const [searchAutoLoadingAttempts, setSearchAutoLoadingAttempts] = useState(0);

  // Add state for available agents and filter options
  const [availableAgents, setAvailableAgents] = useState<{id: string, name: string, email: string}[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    sources: string[];
    employmentStatuses: string[];
    loanPurposes: string[];
    residentialStatuses: string[];
    leadTypes: string[];
    eligibilityStatuses: string[];
  }>({
    sources: [],
    employmentStatuses: [],
    loanPurposes: [],
    residentialStatuses: [],
    leadTypes: [],
    eligibilityStatuses: []
  });

  // Add state for selected sorting option
  const [selectedSortingOption, setSelectedSortingOption] = useState('updated_at_desc');

  // Function to filter leads based on search query
  const filterLeads = (leads: Lead[], query: string) => {
    if (!query) return leads;
    
    const searchLower = query.toLowerCase();
    return leads.filter(lead => {
      // Search by phone number (exact match)
      if (/^\d{8,}$/.test(query.replace(/\D/g, ''))) {
        return lead.phone_number.includes(query.replace(/\D/g, ''));
      }
      // Search by ID (exact match)
      if (/^\d+$/.test(query)) {
        return lead.id.toString() === query;
      }
      // Search by name (partial match)
      return lead.full_name?.toLowerCase().includes(searchLower) ?? false;
    });
  };

  // Function to show notifications
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    // Auto-dismiss after 3 seconds
    setTimeout(() => setNotification(null), 3000);
  };

  // Enhanced function to apply frontend filters - sorting now handled in backend
  const applyFrontendFilters = (leads: Lead[]) => {
    let filteredLeads = [...leads];

    // Skip search filter since it's now handled in backend when in search mode
    // Apply search filter only for advanced filters, not the main search
    // if (filters.search) {
    //   filteredLeads = filterLeads(filteredLeads, filters.search);
    // }

    // Apply amount range filter
    if (activeFilters.amountMin !== undefined || activeFilters.amountMax !== undefined) {
      filteredLeads = filteredLeads.filter(lead => {
        const amount = parseFloat(lead.amount ?? '0');
        const min = activeFilters.amountMin ?? 0;
        const max = activeFilters.amountMax ?? Infinity;
        return amount >= min && amount <= max;
      });
    }

    // Apply source filter
    if (activeFilters.source && activeFilters.source.length > 0) {
      filteredLeads = filteredLeads.filter(lead => 
        lead.source && activeFilters.source!.includes(lead.source)
      );
    }

    // Apply employment status filter
    if (activeFilters.employmentStatus && activeFilters.employmentStatus.length > 0) {
      filteredLeads = filteredLeads.filter(lead => 
        lead.employment_status && activeFilters.employmentStatus!.includes(lead.employment_status)
      );
    }

    // Apply loan purpose filter
    if (activeFilters.loanPurpose && activeFilters.loanPurpose.length > 0) {
      filteredLeads = filteredLeads.filter(lead => 
        lead.loan_purpose && activeFilters.loanPurpose!.includes(lead.loan_purpose)
      );
    }

    // Apply residential status filter
    if (activeFilters.residentialStatus && activeFilters.residentialStatus.length > 0) {
      filteredLeads = filteredLeads.filter(lead => 
        lead.residential_status && activeFilters.residentialStatus!.includes(lead.residential_status)
      );
    }

    // Apply assigned user filter
    if (activeFilters.assignedTo && activeFilters.assignedTo.length > 0) {
      filteredLeads = filteredLeads.filter(lead => 
        lead.assigned_to && activeFilters.assignedTo!.includes(lead.assigned_to)
      );
    }

    // Apply date range filter
    if (activeFilters.dateFrom || activeFilters.dateTo) {
      filteredLeads = filteredLeads.filter(lead => {
        const createdDate = new Date(lead.created_at);
        const startDate = activeFilters.dateFrom ? new Date(activeFilters.dateFrom) : new Date('1900-01-01');
        const endDate = activeFilters.dateTo ? new Date(activeFilters.dateTo) : new Date('2100-12-31');
        return createdDate >= startDate && createdDate <= endDate;
      });
    }

    // Sorting is now handled in the backend - no need to sort here
    return filteredLeads;
  };

  // This function was removed - filter options are now managed differently

  // Function to refresh data with new filter parameters - simplified without sort params
  const refreshDataWithFilters = async () => {
    setAllLoadedLeads([]);
    setPage(1);
    await fetchLeadsWithFilters(1);
  };

  // Function to handle search-based loading
  const handleSearchLoad = async (searchQuery: string) => {
    if (!searchQuery.trim() || isSearchAutoLoading) {
      return;
    }

    console.log(`🔍 [Search Load] Starting search for: "${searchQuery}"`, {
      isSearchAutoLoading,
      searchAutoLoadingAttempts,
      currentPage: page
    });
    setIsSearchAutoLoading(true);
    setSearchAutoLoadingAttempts(1);
    
    // Clear existing leads and reset page when starting a new search
    setAllLoadedLeads([]);
    setPage(1);
    
    try {
      await fetchLeadsWithFilters(1);
    } finally {
      setIsSearchAutoLoading(false);
    }
  };

  // Function to handle search-based auto-loading (for pagination)
  const handleSearchAutoLoad = async () => {
    if (!filters.search?.trim() || isSearchAutoLoading || !hasMore || searchAutoLoadingAttempts >= 5) {
      console.log(`🔍 [Search Auto Load] Skipping - Conditions not met:`, {
        hasSearchQuery: Boolean(filters.search?.trim()),
        isSearchAutoLoading,
        hasMore,
        attempts: searchAutoLoadingAttempts
      });
      return;
    }

    console.log(`🔍 [Search Auto Load] Attempt ${searchAutoLoadingAttempts + 1} for: "${filters.search}"`, {
      currentPage: page,
      hasMore,
      isSearchAutoLoading
    });
    setIsSearchAutoLoading(true);
    setSearchAutoLoadingAttempts(prev => prev + 1);
    
    const nextPage = page + 1;
    setPage(nextPage);
    
    setTimeout(() => {
      void fetchLeadsWithFilters(nextPage).finally(() => {
        setIsSearchAutoLoading(false);
      });
    }, 500);
  };

    // Quick action filter functions
  const handleMyLeadsAll = () => {
    if (!userId) return;
    const newFilters = {
      status: ['assigned', 'no_answer', 'follow_up', 'booked', 'give_up', 'done', 'missed/RS', 'blacklisted'] as FilterOptions['status'],
      dateFrom: undefined,
      dateTo: undefined,
      followUpDateFrom: undefined,
      followUpDateTo: undefined,
      assignedTo: [userId],
      includeUnassigned: false,
      bookedBy: []
    };
    const newSortOptions = {
      sortBy: 'updated_at' as const,  
      sortOrder: 'desc' as const
    };
    setComponentFilterOptions(newFilters);
    setComponentSortOptions(newSortOptions);
    setComponentSearchQuery('');
    setAllLoadedLeads([]);
    setPage(1);
    void fetchLeadsWithFilters(1, newFilters, '', newSortOptions);
  };

  const handleMyLeadsAssigned = () => {
    if (!userId) return;
    const newFilters = {
      status: ['assigned'] as FilterOptions['status'],
      dateFrom: undefined,
      dateTo: undefined,
      followUpDateFrom: undefined,
      followUpDateTo: undefined,
      includeUnassigned: false,
      bookedBy: [],
      assignedTo: [userId],
    };
    const newSortOptions = {
      sortBy: 'updated_at' as const,
      sortOrder: 'desc' as const
    };
    setComponentFilterOptions(newFilters);
    setComponentSortOptions(newSortOptions);
    setComponentSearchQuery('');
    setAllLoadedLeads([]);
    setPage(1);
    void fetchLeadsWithFilters(1, newFilters, '', newSortOptions);
  };

  const handleTodaysBookings = () => {
    if (!userId) return;
    // Use Singapore timezone for "today"
    const today = getTodaySGT();
    const newFilters = {
      status: ['missed/RS', 'booked', 'done'] as FilterOptions['status'],
      bookedBy: [userId],
      dateFrom: undefined,
      dateTo: undefined,
      followUpDateFrom: undefined,
      followUpDateTo: undefined,
      includeUnassigned: false,
      assignedTo: []
    };
    const newSortOptions = {
      sortBy: 'updated_at' as const,
      sortOrder: 'desc' as const
    };
    setComponentFilterOptions(newFilters);
    setComponentSortOptions(newSortOptions);
    setComponentSearchQuery('');
    setAllLoadedLeads([]);
    setPage(1);
    void fetchLeadsWithFilters(1, newFilters, '', newSortOptions);
  };

  const handleGiveUpPool = () => {
    const newFilters = {
      status: ['give_up'] as FilterOptions['status'],
      includeUnassigned: true,
      assignedTo: availableAgents.map(a => a.id), // Show all assigned give up leads
      bookedBy: [], // Don't filter by bookedBy for give up pool
      dateFrom: undefined,
      dateTo: undefined,
      followUpDateFrom: undefined,
      followUpDateTo: undefined,
    };
    const newSortOptions = {
      sortBy: 'updated_at' as const,
      sortOrder: 'desc' as const
    };
    setComponentFilterOptions(newFilters);
    setComponentSortOptions(newSortOptions);
    setComponentSearchQuery('');
    setAllLoadedLeads([]);
    setPage(1);
    void fetchLeadsWithFilters(1, newFilters, '', newSortOptions);
  };

  const handleMyFollowUpToday = () => {
    if (!userId) return;
    // Use Singapore timezone for "today"
    const today = getTodaySGT();
    const newFilters = {
      status: ['follow_up'] as FilterOptions['status'],
      assignedTo: [userId],
      dateFrom: undefined,
      dateTo: undefined,
      followUpDateFrom: today,
      followUpDateTo: today,
      includeUnassigned: false,
      bookedBy: []
    };
    const newSortOptions = {
      sortBy: 'follow_up_date' as const,
      sortOrder: 'asc' as const
    };
    setComponentFilterOptions(newFilters);
    setComponentSortOptions(newSortOptions);
    setComponentSearchQuery('');
    setAllLoadedLeads([]);
    setPage(1);
    void fetchLeadsWithFilters(1, newFilters, '', newSortOptions);
  };

  const handleAllLeads = () => {
    const newFilters = {
      status: ['new', 'assigned', 'no_answer', 'follow_up', 'booked', 'give_up', 'done', 'missed/RS', 'unqualified', 'blacklisted'] as FilterOptions['status'],
      includeUnassigned: true,
      assignedTo: availableAgents.map(a => a.id), // All agents
      bookedBy: [], // Don't filter by bookedBy for "All Leads"
      dateFrom: undefined,
      dateTo: undefined,
      followUpDateFrom: undefined,
      followUpDateTo: undefined,
    };
    const newSortOptions = {
      sortBy: 'updated_at' as const,
      sortOrder: 'desc' as const
    };
    setComponentFilterOptions(newFilters);
    setComponentSortOptions(newSortOptions);
    setComponentSearchQuery('');
    setAllLoadedLeads([]);
    setPage(1);
    void fetchLeadsWithFilters(1, newFilters, '', newSortOptions);
  };

  // Enhanced fetchLeadsWithFilters with new component integration
  const fetchLeadsWithFilters = async (pageNum = 1, customFilters?: FilterOptions, customSearchQuery?: string, customSortOptions?: SortOptions) => {
    console.log(`📥 [Fetch Leads] Starting fetch:`, {
      pageNum,
      isLoadingMore,
      isSearchAutoLoading,
      hasMore,
      componentSearchQuery,
      componentFilterOptions
    });

    try {
      setIsLoadingMore(true);
      
      // Use custom filters if provided, otherwise use component state
      const filtersToUse = customFilters ?? componentFilterOptions;
      const searchToUse = customSearchQuery ?? componentSearchQuery;
      const sortToUse = customSortOptions ?? componentSortOptions;
      
      // Build filter parameters from filters
      const filterParams: FetchLeadsParams = {
        searchQuery: searchToUse,
        searchOptions: {
          status: filtersToUse.status,
          assignedTo: filtersToUse.assignedTo,
          includeUnassigned: filtersToUse.includeUnassigned,
          bookedBy: filtersToUse.bookedBy,
          sources: filtersToUse.sources,
          employmentStatuses: filtersToUse.employmentStatuses,
          loanPurposes: filtersToUse.loanPurposes,
          residentialStatuses: filtersToUse.residentialStatuses,
          leadTypes: filtersToUse.leadTypes,
          eligibilityStatuses: filtersToUse.eligibilityStatuses,
          amountMin: filtersToUse.amountMin,
          amountMax: filtersToUse.amountMax,
          dateFrom: filtersToUse.dateFrom,
          dateTo: filtersToUse.dateTo,
          followUpDateFrom: filtersToUse.followUpDateFrom,
          followUpDateTo: filtersToUse.followUpDateTo,
          assignedInLastDays: filtersToUse.assignedInLastDays
        },
        sortOptions: sortToUse,
        page: pageNum,
        limit: 100
      };

      const result = await fetchFilteredLeads(filterParams);
      
      console.log(`📥 [Fetch Leads] Result:`, {
        success: result.success,
        leadCount: result.leads?.length,
        hasMore: result.hasMore,
        page: pageNum
      });
      
      if (result.success && result.leads) {
        const newLeads = [...(pageNum === 1 ? [] : allLoadedLeads), ...result.leads] as Lead[];
        setAllLoadedLeads(newLeads);
        setHasMore(result.hasMore ?? false);
        
        // Reset auto-loading state when starting fresh  
        if (pageNum === 1) {
          setAutoLoadingAttempts(0);
          setIsAutoLoading(false);
          setSearchAutoLoadingAttempts(0);
          setIsSearchAutoLoading(false);
        }
      } else {
        throw new Error(result.error ?? 'Failed to fetch leads');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsAutoLoading(false);
      setIsSearchAutoLoading(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Function to refresh all data from page 1 to current page
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setAllLoadedLeads([]); // Clear existing leads
      
      const currentPageNum = page;
      let allRefreshedLeads: Lead[] = [];
      
      // Fetch all pages from 1 to current page
      for (let pageNum = 1; pageNum <= currentPageNum; pageNum++) {
        const result = await fetchFilteredLeads({
          searchQuery: '',
          sortOptions: {
          sortBy: "updated_at",
            sortOrder: "desc"
          },
          page: pageNum,
          limit: 50
        });
        
        if (result.success && result.leads) {
          allRefreshedLeads = [...allRefreshedLeads, ...result.leads] as Lead[];
          setHasMore(result.hasMore ?? false);
        } else {
          throw new Error(result.error ?? 'Failed to refresh leads');
        }
      }
      
      setAllLoadedLeads(allRefreshedLeads);
      // Filter options are now managed by backend
      
      // Reset auto-loading state
      setAutoLoadingAttempts(0);
      setIsAutoLoading(false);
      setSearchAutoLoadingAttempts(0);
      setIsSearchAutoLoading(false);
      
      showNotification(`Refreshed ${allRefreshedLeads.length} leads (${currentPageNum} pages)`, 'success');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during refresh');
      showNotification('Failed to refresh leads', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to load more leads (increment page and fetch)
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchLeadsWithFilters(nextPage);
  };

  // Function to check if an agent is checked in
  const checkIfAgentCheckedIn = async (agentId?: string) => {
    try {
      const statusResult = await checkAgentStatus(agentId);
      if (statusResult.success) {
        return {
          isCheckedIn: statusResult.isCheckedIn,
          checkInData: statusResult.checkInData
        };
      }
      return { isCheckedIn: false, checkInData: null };
    } catch (error) {
      console.error('Error checking agent status:', error);
      return { isCheckedIn: false, checkInData: null };
    }
  };

  // Handle status reason modal confirmation
  const handleStatusReasonConfirm = async (reason: string, finalStatus: 'give_up' | 'blacklisted') => {
    if (!statusReasonLeadData) return;

    try {
      // Find the lead
      const lead = allLoadedLeads.find(l => l.id === statusReasonLeadData.leadId);
      if (!lead) {
        showNotification('Lead not found', 'error');
        return;
      }

      // Update the lead status and eligibility notes
      const updatedLead: Partial<Lead> = {
        id: lead.id,
        status: finalStatus,
        eligibility_notes: `${finalStatus.toUpperCase()} - ${reason}`,
        updated_at: new Date(),
        updated_by: userId ?? 'system'
      };

      await handleSaveLead(updatedLead);

      // Update the lead in allLoadedLeads
      setAllLoadedLeads(prevLeads => 
        prevLeads.map(l => l.id === lead.id ? { ...l, ...updatedLead } : l)
      );

      // Move lead to new status column
      setLeads(prevLeads => {
        const newLeads = { ...prevLeads };
        const oldStatus = lead.status as LeadStatus;
        // Remove from old status
        newLeads[oldStatus] = newLeads[oldStatus]?.filter(l => l.id !== lead.id) ?? [];
        // Add to new status
        newLeads[finalStatus] = [...(newLeads[finalStatus] ?? []), { ...lead, ...updatedLead }];
        return newLeads;
      });

      // Close the status reason modal
      setIsStatusReasonModalOpen(false);
      setStatusReasonLeadData(null);

      // Show success notification
      showNotification(`Lead status updated to ${finalStatus}`, 'success');

      // Refresh the data
      await refreshDataWithFilters();
    } catch (error) {
      console.error('Error updating lead status:', error);
      showNotification('Failed to update lead status', 'error');
    }
  };

  // Load total lead counts by status
  const loadTotalLeadCounts = async () => {
    try {
      const result = await getLeadCountsByStatus();
      if (result.success) {
        setTotalLeadCounts(result.statusCounts);
      }
    } catch (error) {
      console.error('Error loading total lead counts:', error);
    }
  };

  // Load auto-assignment settings
  const loadAutoAssignmentSettings = async () => {
    try {
      console.log('Starting to load auto assignment settings...'); // Debug log
      setIsLoadingAutoSettings(true);
      const result = await getAutoAssignmentSettings();
      console.log('Auto assignment settings result:', result); // Debug log
      if (result.success && result.settings) {
        const settings = {
          is_enabled: result.settings.is_enabled ?? false,
          assignment_method: result.settings.assignment_method ?? 'round_robin',
          max_leads_per_agent_per_day: result.settings.max_leads_per_agent_per_day ?? 20,
          current_round_robin_index: result.settings.current_round_robin_index ?? 0
        };
        console.log('Setting auto assignment settings to:', settings); // Debug log
        setAutoAssignmentSettings(settings);
      } else {
        console.log('Failed to load auto assignment settings:', result); // Debug log
      }
    } catch (error) {
      console.error('Error loading auto-assignment settings:', error);
    } finally {
      setIsLoadingAutoSettings(false);
    }
  };

  // Toggle auto-assignment
  const toggleAutoAssignment = async (enabled: boolean) => {
    try {
      console.log("🔄 toggleAutoAssignment: Starting with enabled =", enabled);
      console.log("📋 toggleAutoAssignment: Current settings before update:", autoAssignmentSettings);
      
      const result = await updateAutoAssignmentSettings({ is_enabled: enabled });
      console.log("📤 toggleAutoAssignment: Update result:", result);
      
      if (result.success) {
        console.log("✅ toggleAutoAssignment: Update successful, updating local state");
        setAutoAssignmentSettings(prev => {
          const newSettings = prev ? { ...prev, is_enabled: enabled } : null;
          console.log("🔄 toggleAutoAssignment: New local settings:", newSettings);
          return newSettings;
        });
        showNotification(
          enabled ? 'Auto-assignment enabled' : 'Auto-assignment disabled', 
          'success'
        );
        
        // Reload settings to verify the change
        console.log("🔄 toggleAutoAssignment: Reloading settings to verify...");
        await loadAutoAssignmentSettings();
      } else {
        console.log("❌ toggleAutoAssignment: Update failed:", result.message);
        showNotification('Failed to update auto-assignment settings', 'error');
      }
    } catch (error) {
      console.error('❌ Error toggling auto-assignment:', error);
      showNotification('Error updating settings', 'error');
    }
  };

  
  // Load assignment preview for manual assignment
  const loadAssignmentPreview = async () => {
    try {
      setIsLoadingPreview(true);
      const result = await getManualAssignmentPreview();
      if (result.success) {
        setAssignmentPreview(result.preview);
        setAssignmentStats({
          totalAgents: result.totalAgents,
          totalLeads: result.totalLeads
        });
      } else {
        showNotification(result.message ?? 'Failed to load preview', 'error');
      }
    } catch (error) {
      console.error('Error loading assignment preview:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Handle bulk assignment
  const handleBulkAutoAssign = async () => {
    try {
      setIsAssigning(true);
      const result = await bulkAutoAssignLeads();
      if (result.success) {
        showNotification(result.message ?? 'Leads assigned successfully', 'success');
        
        // Refresh data
        setAllLoadedLeads([]);
        setPage(1);
        await fetchLeadsWithFilters(1);
        await loadAssignmentPreview();
      } else {
        showNotification(result.message ?? 'Failed to assign leads', 'error');
      }
    } catch (error) {
      console.error('Error in bulk assignment:', error);
      showNotification('Error assigning leads', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle auto assign button click - check if auto-assignment is enabled
  const handleAutoAssignButtonClick = async () => {
    try {
      // Load current settings if not loaded
      if (!autoAssignmentSettings) {
        console.log('Loading settings first...');
        await loadAutoAssignmentSettings();
      }

      // Recheck after loading
      const currentSettings = autoAssignmentSettings;
      console.log('Current settings after load:', currentSettings);

      if (currentSettings?.is_enabled) {
        // Auto-assignment is enabled, show disable confirmation
        console.log('Auto-assignment is enabled, showing disable confirmation');
        setShowDisableConfirmation(true);
      } else {
        // Auto-assignment is disabled, proceed with manual assignment
        console.log('Auto-assignment is disabled, proceeding with manual assignment');
        setIsLoadingPreview(true);
        setShowAssignConfirmation(true);
        void loadAssignmentPreview().then(() => {
          setIsLoadingPreview(false);
        });
      }
    } catch (error) {
      console.error('Error handling auto assign button click:', error);
      showNotification('Error loading assignment settings', 'error');
    }
  };

  // Handle disabling auto-assignment
  const handleDisableAutoAssignment = async () => {
    try {
      const result = await updateAutoAssignmentSettings({ is_enabled: false });
      if (result.success) {
        setAutoAssignmentSettings(prev => prev ? { ...prev, is_enabled: false } : null);
        showNotification('Auto-assignment has been disabled', 'success');
        setShowDisableConfirmation(false);
      } else {
        showNotification('Failed to disable auto-assignment', 'error');
      }
    } catch (error) {
      console.error('Error disabling auto-assignment:', error);
      showNotification('Error disabling auto-assignment', 'error');
    }
  };

  // Initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // FIRST: Load available agents and filter options before anything else
        const [agentsResult, filterOptionsResult] = await Promise.all([
          getAvailableAgents(),
          getFilterOptions()
        ]);

        let validAgents: {id: string, name: string, email: string}[] = [];
        if (agentsResult.success && agentsResult.agents) {
          // Filter out agents with null email
          validAgents = agentsResult.agents.filter(agent => agent.email !== null) as {id: string, name: string, email: string}[];
          setAvailableAgents(validAgents);
        }

        if (filterOptionsResult.success && filterOptionsResult.options) {
          // Filter out null values from filter options
          const cleanedOptions = {
            sources: filterOptionsResult.options.sources.filter(Boolean) as string[],
            employmentStatuses: filterOptionsResult.options.employmentStatuses.filter(Boolean) as string[],
            loanPurposes: filterOptionsResult.options.loanPurposes.filter(Boolean) as string[],
            residentialStatuses: filterOptionsResult.options.residentialStatuses.filter(Boolean) as string[],
            leadTypes: filterOptionsResult.options.leadTypes.filter(Boolean) as string[],
            eligibilityStatuses: filterOptionsResult.options.eligibilityStatuses.filter(Boolean) as string[]
          };
          setFilterOptions(cleanedOptions);
        }
        
        // SECOND: Load user role and initialize default filters with loaded agents
        if (userRole && userRole.length > 0) {
          console.log('Setting userRole to:', userRole); // Debug log

          // Initialize filter component based on user role and auto-apply
          let initialFilters: FilterOptions = {};
          
          if (userRole === 'admin') {
            // Admin sees ALL leads by default (all statuses, all assigned, no bookedBy filter)
            initialFilters = {
              status: ['new', 'assigned', 'no_answer', 'follow_up', 'booked', 'give_up', 'done', 'missed/RS', 'unqualified', 'blacklisted'] as FilterOptions['status'],
              includeUnassigned: true,
              assignedTo: validAgents.map(a => a.id), // Use loaded agents
              bookedBy: [] // Don't filter by bookedBy for admin default
            };
          } else if (userRole === 'agent' && userId) {
            // Agent sees "My Leads" by default (same as handleMyLeadsAll)
            initialFilters = {
              status: ['assigned', 'no_answer', 'follow_up', 'booked', 'give_up', 'done', 'missed/RS', 'blacklisted'] as FilterOptions['status'],
              assignedTo: [userId],
              includeUnassigned: false,
              bookedBy: []
            };
          }
          
          // Set the filters in state
          setComponentFilterOptions(initialFilters);
          setComponentSearchQuery('');
          
          // THIRD: Now fetch leads with the properly configured filters
          console.log('Fetching leads with initial filters:', initialFilters);
          await fetchLeadsWithFilters(1, initialFilters, '');

          // If user is an agent, check their check-in status
          if (userRole === 'agent') {
            const statusResult = await checkAgentStatus();
            if (statusResult.success) {
              setIsCheckedIn(statusResult.isCheckedIn);
            }
          }
          
          // If user is an admin, load auto assignment settings
          if (userRole === 'admin') {
            console.log('Loading auto assignment settings for admin...'); // Debug log
            await loadAutoAssignmentSettings();
          }
        } else {
          console.log('No roles found, defaulting to user'); // Debug log
        }
        
        // FOURTH: Load total lead counts and pinned leads
        await loadTotalLeadCounts();
        
        // Load pinned leads
        const pinnedResult = await getPinnedLeads();
        if (pinnedResult.success && pinnedResult.pinnedLeads) {
          const pinnedLeadIds = pinnedResult.pinnedLeads.map(p => p.lead_id);
          // Get pinned leads from all columns
          const allLeads = Object.values(leads).flat();
          const pinnedLeadsData = allLeads.filter(lead => pinnedLeadIds.includes(lead.id));
          setPinnedLeads(pinnedLeadsData);
        }
      } catch (err) {
        console.error('Error in loadInitialData:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    void loadInitialData();
  }, []);

  // Effect to handle search-based loading
  useEffect(() => {
    const searchQuery = filters.search;
    if (searchQuery && searchQuery.trim() !== '') {
      // Small delay to avoid triggering on every keystroke
      const timeoutId = setTimeout(() => {
        void handleSearchLoad(searchQuery);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    } else {
      // Reset search auto-loading when search is cleared
      setSearchAutoLoadingAttempts(0);
      setIsSearchAutoLoading(false);
      
      // Always reload normal data when search is cleared (regardless of current leads)
      if (!searchQuery) {
        console.log('🔄 Search cleared, reloading original leads with visible statuses only...');
        setAllLoadedLeads([]);
        setPage(1);
        void fetchLeadsWithFilters(1);
      }
    }
  }, [filters.search]);

  // Enhanced column scroll handler with per-column loading
  const handleColumnScroll = (statusId: string) => {
    return (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const isNearBottom = scrollHeight - scrollTop <= clientHeight * 1.2;
      
      console.log(`📜 [Column Scroll] Status: ${statusId}`, {
        scrollTop,
        scrollHeight,
        clientHeight,
        isNearBottom,
        hasMore,
        isLoadingMore,
        isSearchAutoLoading,
        currentPage: page
      });
      
      // Prevent auto-scroll during search loading or if already loading
      if (isNearBottom && hasMore && !isLoadingMore && !isSearchAutoLoading) {
        console.log(`📜 [Column Scroll] Loading more data for column "${statusId}"...`);
        
        if (filters.search && filters.search.trim() !== '') {
          // In search mode, continue searching
          void handleSearchAutoLoad();
        } else {
          // Normal pagination
          const nextPage = page + 1;
          setPage(nextPage);
          void fetchLeadsWithFilters(nextPage);
        }
      }
    };
  };

  // Function to check if a status column needs a "Load More" indicator
  const getColumnLoadingState = (statusId: string) => {
    const columnLeads = getLeadsForStatus(statusId);
    const hasLeads = columnLeads.length > 0;
    const couldHaveMore = hasMore || statusHasMoreData[statusId];
    
    return {
      hasLeads,
      couldHaveMore,
      showLoadMore: hasLeads && couldHaveMore,
      isEmpty: !hasLeads && !isLoadingMore
    };
  };

  // Debug logging - remove this after fixing
  console.log('Current userRole:', userRole);
  console.log('Current autoAssignmentSettings:', autoAssignmentSettings);
  console.log('isLoadingAutoSettings:', isLoadingAutoSettings);

  // This will be defined later after getLeadsForStatus is available

  // Filter leads for agent
  const visibleLeads = userRole === 'agent'
    ? (leads[filters.status ?? 'new'] ?? []).filter(lead => lead.assigned_to === userId)
    : (leads[filters.status ?? 'new'] ?? []);

  // Get current leads based on active tab
  const getCurrentLeads = () => {
    if (activeTab === 'pinned') return pinnedLeads;
    return visibleLeads;
  };

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleAgentCheckIn = async () => {
    if (!userId) return;
    
    try {
      setCheckingInOut(true);
      const result = await checkInAgent();
      if (result.success) {
        setIsCheckedIn(true);
        alert(result.message);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("Error checking in:", error);
      alert("Failed to check in");
    } finally {
      setCheckingInOut(false);
    }
  };

  const handleAgentCheckOut = async () => {
    if (!userId) return;
    
    try {
      setCheckingInOut(true);
      const result = await checkOutAgent();
      if (result.success) {
        setIsCheckedIn(false);
        alert(result.message);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("Error checking out:", error);
      alert("Failed to check out");
    } finally {
      setCheckingInOut(false);
    }
  };

  const handleAutoAssignLeads = async () => {
    if (!userId || userRole !== 'admin') return;
    
    try {
      setIsAssigning(true);
      setAssignmentMessage(null);
      
      const result = await autoAssignLeads();
      if (result.success) {
        setAssignmentMessage(result.message);
        
        // Refresh all leads data
        setAllLoadedLeads([]);
        setPage(1);
        await fetchLeadsWithFilters(1);
        await loadTotalLeadCounts(); // Refresh total counts
        
        // Also update pinnedLeads with fresh data
        const pinnedResult = await getPinnedLeads();
        if (pinnedResult.success && pinnedResult.pinnedLeads) {
          const pinnedLeadIds = pinnedResult.pinnedLeads.map(p => p.lead_id);
          const allLeads = allLoadedLeads;
          const pinnedLeadsData = allLeads.filter(lead => pinnedLeadIds.includes(lead.id));
          setPinnedLeads(pinnedLeadsData);
        }
        
        // Load fresh assignment preview after auto-assignment
        await loadAssignmentPreview();
        
        // Keep the modal open to show the results
      } else {
        setAssignmentMessage(result.message);
      }
    } catch (error) {
      console.error("Error auto-assigning leads:", error);
      setAssignmentMessage("Failed to auto-assign leads");
    } finally {
      setIsAssigning(false);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const confirmAutoAssign = () => {
    // Don't close the modal, just start the assignment process
    void handleAutoAssignLeads();
  };

  // Modify handleLeadAction to refresh leads after actions
  const handleLeadAction = async (action: string, leadId: number) => {
    try {
      // Find the lead in any column
      const allLeads = Object.values(allLoadedLeads).flat();
      const lead = allLeads.find(l => l.id === leadId);
      
      if (!lead) {
        console.error('Lead not found:', leadId);
        showNotification('Lead not found', 'error');
        return;
      }

      let needsRefresh = false;
      // console.log('lead', JSON.stringify(lead), action);

      switch (action) {
        case 'edit':
          setSelectedLead(lead);
          setIsEditOpen(true);
          console.log("edit")
          // needsRefresh = true;
          break;

        case 'pin':
          const pinResult = await togglePinLead(leadId);
          if (pinResult.success && pinResult.action === 'pinned') {
            if (!pinnedLeads.some(p => p.id === leadId)) {
              setPinnedLeads([...pinnedLeads, lead]);
            }
          }
          break;

        case 'unpin':
          const unpinResult = await togglePinLead(leadId);
          if (unpinResult.success && unpinResult.action === 'unpinned') {
            setPinnedLeads(pinnedLeads.filter(p => p.id !== leadId));
          }
          break;

        case 'move_to_new':
        case 'move_to_assigned':
        case 'move_to_no_answer':
        case 'move_to_follow_up':
        case 'move_to_done':
        case 'move_to_miss/RS':
        case 'move_to_booked':
        case 'move_to_unqualified':
          const newStatus = action.replace('move_to_', '') as LeadStatus;
          
          if (userRole === 'agent' && !agentAllowedStatuses.includes(newStatus)) {
            showNotification('Agents cannot set this status: ' + newStatus, 'error');
            return;
          }
          
          const statusResult = await updateLeadStatus(leadId, newStatus);
          if (!statusResult.success) {
            throw new Error('Failed to update status');
          }
          
          // Update the lead in allLoadedLeads
          setAllLoadedLeads(prevLeads => 
            prevLeads.map(l => l.id === leadId ? { ...l, status: newStatus } : l)
          );
          
          // Move lead to new status column
          setLeads(prevLeads => {
            const newLeads = { ...prevLeads };
            const oldStatus = lead.status as LeadStatus;
            // Remove from old status
            newLeads[oldStatus] = newLeads[oldStatus]?.filter(l => l.id !== lead.id) ?? [];
            // Add to new status
            newLeads[newStatus] = [...(newLeads[newStatus] ?? []), { ...lead, status: newStatus }];
            return newLeads;
          });
          
          showNotification('Status updated successfully', 'success');
          needsRefresh = true;
          break;

        case 'status_reason_modal':
          // Show the status reason modal
          setStatusReasonLeadData({
            leadId: lead.id,
            leadName: lead.full_name ?? `Lead ${lead.id}`
          });
          setIsStatusReasonModalOpen(true);
          // Close the edit modal if it's open
          setIsEditOpen(false);
          break;

        case 'whatsapp':
          // Open the page-level WhatsApp modal
          setWhatsAppLeadData({
            phoneNumber: lead.phone_number,
            leadId: lead.id
          });
          setIsPageWhatsAppModalOpen(true);
          break;
          
        case 'call':
          try {
            const callResult = await makeCall({
              phoneNumber: lead.phone_number,
              leadId: lead.id
            });
            
            if (callResult.success) {
              showNotification('Call initiated successfully', 'success');
            } else {
              showNotification(callResult.message || 'Failed to initiate call', 'error');
            }
          } catch (error) {
            console.error('Error making call:', error);
            showNotification('Failed to initiate call', 'error');
          }
          break;

        case 'schedule':
          break;

        case 'assign':
          setSelectedLead(lead);
          setIsAssignModalOpen(true);
          needsRefresh = true;
          break;

        default:
          console.log('Unknown action:', action);
      }

      // Refresh all leads if needed
      if (needsRefresh) {
        setAllLoadedLeads([]);
        setPage(1);
        await fetchLeadsWithFilters(1);
        await loadTotalLeadCounts(); // Refresh total counts
      }
    } catch (error) {
      console.error('Error in handleLeadAction:', error);
      showNotification('Failed to perform action', 'error');
    }
  };

  const handleSaveLead = async (updatedLead: Partial<Lead>, leadNotes?: string) => {
    try {
      if (!selectedLead?.id) return;

      console.log('updatedLead', updatedLead);
      console.log('leadNotes', leadNotes);

      // Handle special logic for give_up and blacklisted statuses
      const finalUpdatedLead = { ...updatedLead };
      
      
      const result = await updateLead(selectedLead.id, finalUpdatedLead);
      if (result.success) {
        // Create lead note if leadNotes is provided
        if (leadNotes?.trim()) {
          try {
            const { addLeadNote } = await import('~/app/_actions/leadActions');
            const noteResult = await addLeadNote(selectedLead.id, leadNotes.trim());
            if (noteResult.success) {
              console.log('Lead note created successfully');
              showNotification('Lead note added successfully', 'success');
            } else {
              console.error('Failed to create lead note:', noteResult.message);
              showNotification('Failed to save lead note', 'error');
            }
          } catch (error) {
            console.error('Error creating lead note:', error);
            showNotification('Failed to save lead note', 'error');
          }
        }

        // Update the lead in allLoadedLeads
        setAllLoadedLeads(prevLeads => 
          prevLeads.map(lead => 
            lead.id === selectedLead.id ? { ...lead, ...finalUpdatedLead } : lead
          )
        );
        
        setIsEditOpen(false);
        showNotification('Lead updated successfully', 'success');
        
        // Refresh leads to get latest data
        setAllLoadedLeads([]);
        setPage(1);
        await fetchLeadsWithFilters(1);
      } else {
        showNotification(result.message || 'Failed to update lead', 'error');
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      showNotification('An error occurred while saving the lead', 'error');
    }
  };

  // Function to scroll to column with results
  const scrollToResults = (searchQuery: string) => {
    if (!searchQuery) return;
    
    const filteredLeads = filterLeads(allLoadedLeads, searchQuery);
    if (filteredLeads.length === 0) return;
    
    // Find the first column that has results
    const firstResult = filteredLeads[0];
    if (!firstResult) return;
    
    const columnId = firstResult.status;
    const columnElement = columnRefs.current[columnId];
    
    if (columnElement) {
      // Get the container and ensure it exists
      const container = columnElement.parentElement?.parentElement;
      if (!container) return;

      // Calculate the scroll position
      const containerRect = container.getBoundingClientRect();
      const columnRect = columnElement.getBoundingClientRect();
      const scrollLeft = columnRect.left - containerRect.left + container.scrollLeft - 20;

      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      });
    }
  };

  // Function to handle CSV export - fix linter errors
  const handleExportLeads = async () => {
    try {
      setExportStatus({ loading: true });
      
      // Get selected statuses
      const statusesToExport = Object.entries(selectedExportStatuses)
        .filter(([_, isSelected]) => isSelected)
        .map(([status]) => status);
      
      if (statusesToExport.length === 0) {
        setExportStatus({ 
          loading: false, 
          error: 'Please select at least one status to export.' 
        });
        return;
      }
      
      const result = await exportAllLeadsToCSV(statusesToExport);
      
      if (!result.success) {
        setExportStatus({ 
          loading: false, 
          error: result.error ?? 'Failed to export leads. Please try again.' 
        });
        return;
      }
      
      // Create and download each CSV file
      const date = new Date().toISOString().slice(0, 10);
      let totalFiles = 0;
      
      // Process each status and agent combination
      if (result.csvDataByStatusAndAgent) {
        Object.entries(result.csvDataByStatusAndAgent).forEach(([status, agentGroups]) => {
          Object.entries(agentGroups).forEach(([agentId, data]) => {
            // Skip if no data
            if (!data.csvData) return;
            
        // Create a Blob from the CSV data
            const blob = new Blob([data.csvData], { type: 'text/csv;charset=utf-8' });
        
        // Create a download link element
        const downloadLink = document.createElement('a');
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
            
            // Format agent name for filename (remove spaces and special characters)
            const safeAgentName = data.agentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Set attributes for the download link
        downloadLink.href = url;
            downloadLink.download = `${safeAgentName}_${status}_${date}.csv`;
        
        // Append to the document, click it to trigger download, then remove it
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Release the URL object
        URL.revokeObjectURL(url);
            
            totalFiles++;
      });
        });
      }
      
      // Prepare the success message with counts by agent and status
      let countsByAgent = '';
      if (result.statusAgentCounts && result.agentNames) {
        countsByAgent = Object.entries(result.statusAgentCounts)
          .map(([status, agentCounts]) => {
            const agentDetails = Object.entries(agentCounts)
              .map(([agentId, count]) => {
                const agentName = result.agentNames?.[agentId] ?? 'Unknown';
                return `${agentName}: ${count}`;
              })
        .join(', ');
            return `${status} (${agentDetails})`;
          })
          .join('\n');
      }
      
      setExportStatus({ 
        loading: false, 
        success: `Successfully exported ${result.totalExported ?? 0} leads in ${totalFiles} files:\n\n${countsByAgent}` 
      });
    } catch (error) {
      console.error("Error in handleExportLeads:", error);
      setExportStatus({ 
        loading: false, 
        error: 'An unexpected error occurred. Please try again.' 
      });
    }
  };

  // Removed censored export functionality per user request

  // Toggle a status selection
  const toggleStatusSelection = (status: string) => {
    setSelectedExportStatuses(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  // Select all statuses
  const selectAllStatuses = () => {
    const allSelected = Object.fromEntries(
      LEAD_STATUSES.map(status => [status, true])
    );
    setSelectedExportStatuses(allSelected);
  };

  // Deselect all statuses
  const deselectAllStatuses = () => {
    const allDeselected = Object.fromEntries(
      LEAD_STATUSES.map(status => [status, false])
    );
    setSelectedExportStatuses(allDeselected);
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    setActiveFilters({});
    setFilters(prev => ({
      ...prev,
      search: '',
      status: 'new'
    }));
  };

  // Function to get filtered leads for display
  const getFilteredLeadsForDisplay = () => {
    let leadsToFilter = allLoadedLeads;
    
    // Apply status filter first
    if (filters.status && activeTab === 'kanban') {
      leadsToFilter = allLoadedLeads; // In kanban, we show all statuses
    } else if (filters.status) {
      leadsToFilter = allLoadedLeads.filter(lead => lead.status === filters.status);
    }
    
    // Apply frontend filters
    return applyFrontendFilters(leadsToFilter);
  };

  // Update the visibleStatuses to work with filtered leads
  const getLeadsForStatus = (statusId: string) => {
    if (statusId === 'pinned') {
      return applyFrontendFilters(pinnedLeads);
    }
    
    const statusLeads = allLoadedLeads.filter(lead => lead.status === statusId);
    return applyFrontendFilters(statusLeads);
  };

  // Function to get total leads count for a status from database
  const getTotalLeadsForStatus = (statusId: string) => {
    if (statusId === 'pinned') {
      return pinnedLeads.length;
    }
    
    return totalLeadCounts[statusId] ?? 0;
  };

  // State to track stable column visibility during search
  const [stableVisibleStatuses, setStableVisibleStatuses] = useState<(typeof allStatuses[number])[]>([]);

  // Update the visibleStatuses definition based on component filter status configuration
  const getVisibleStatuses = () => {
    // Get statuses based on component filter configuration
    let statuses = allStatuses.filter(status => 
      componentFilterOptions.status?.includes(status.id) ?? false
    );
    
    // During search loading: use stable statuses, don't change columns until search is done
    if (componentSearchQuery && componentSearchQuery.trim() !== '' && (isSearchAutoLoading || isLoadingMore)) {
      return stableVisibleStatuses.length > 0 ? stableVisibleStatuses : statuses;
    }
    
    // In search mode, only show columns that have leads (only when search is completely finished)
    if (componentSearchQuery && componentSearchQuery.trim() !== '' && !isSearchAutoLoading && !isLoadingMore) {
      statuses = statuses.filter(status => {
        const statusLeads = getLeadsForStatus(status.id);
        return statusLeads.length > 0;
      });
    }
    
    return statuses;
  };

  const visibleStatuses = useMemo(() => getVisibleStatuses(), [
    userRole, 
    filters.search, 
    isSearchAutoLoading, 
    isLoadingMore, 
    stableVisibleStatuses.length,
    leads
  ]);

  // Update stable statuses when not searching or when search is complete
  useEffect(() => {
    if (!filters.search || (!isSearchAutoLoading && !isLoadingMore)) {
      setStableVisibleStatuses([...visibleStatuses]); // Convert readonly array to mutable
    }
  }, [filters.search, isSearchAutoLoading, isLoadingMore, visibleStatuses]);

  // Modify the Kanban board view
  return (
    <div className="container mx-auto px-4 py-8">
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
          notification.type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' :
          notification.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' :
          'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
        }`}>
          {notification.message}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex space-x-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg flex items-center ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
          {userRole === 'agent' && (
            <button
              onClick={isCheckedIn ? handleAgentCheckOut : handleAgentCheckIn}
              disabled={checkingInOut}
              className={`px-4 py-2 rounded-lg flex items-center ${
                isCheckedIn
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              <UserPlusIcon className="h-5 w-5 mr-2" />
              {checkingInOut 
                ? 'Processing...' 
                : isCheckedIn 
                  ? 'Check Out' 
                  : 'Check In'}
            </button>
          )}
          {userRole === 'admin' && (
            <>
              <button
                onClick={handleAutoAssignButtonClick}
                disabled={isAssigning || isLoadingAutoSettings}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  isAssigning || isLoadingAutoSettings
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : autoAssignmentSettings?.is_enabled
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                <ArrowDownOnSquareIcon className="h-5 w-5 mr-2" />
                {isAssigning 
                  ? 'Processing...' 
                  : isLoadingAutoSettings 
                    ? 'Loading...'
                    : autoAssignmentSettings?.is_enabled
                      ? 'Disable Auto-Assignment'
                      : 'Auto Assign Leads'
                }
              </button>

                              {/* Add Export to CSV button */}
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center"
                >
                  <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                  Export to CSV
                </button>
                {/* Test Webhook Button */}
                {/* <button
                  onClick={async () => {
                    try {
                      const { testWebhookConnection } = await import('~/app/_actions/appointmentWebhookActions');
                      const result = await testWebhookConnection();
                      if (result.success) {
                        showNotification('Webhook test successful! (Only sends on same-day appointments)', 'success');
                      } else {
                        showNotification(`Webhook test failed: ${result.error}`, 'error');
                      }
                    } catch (error) {
                      showNotification('Webhook test error', 'error');
                      console.error('Webhook test error:', error);
                    }
                  }}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center"
                >
                  🔗 Test Webhook
                </button> */}
            </>
          )}
          <div className="relative">
            <button 
              onClick={toggleDropdown}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-1" />
              Add Lead
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <button
                  onClick={() => {
                    router.push('/dashboard/leads/new');
                    setIsDropdownOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Manually
                </button>
                <button
                  onClick={() => {
                    router.push('/dashboard/leads/import');
                    setIsDropdownOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                >
                  <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                  Import from Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

            {/* Quick Search and Action Buttons */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by phone, ID, or name..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:border-blue-500 focus:outline-none"
              value={componentSearchQuery}
              onChange={(e) => {
                const newSearchQuery = e.target.value;
                setComponentSearchQuery(newSearchQuery);
                
                // Apply search behavior
                let searchFilters: FilterOptions | undefined = undefined;
                
                if (newSearchQuery.trim() !== '') {
                  // Use "All Leads" behavior when searching
                  searchFilters = {
                    status: ['new', 'assigned', 'no_answer', 'follow_up', 'booked', 'give_up', 'done', 'missed/RS', 'unqualified', 'blacklisted'] as FilterOptions['status'],
                    assignedTo: availableAgents.map(a => a.id), // All agents
                    includeUnassigned: true,
                    bookedBy: [] // Don't filter by bookedBy when searching
                  };
                } else {
                  // Restore role-based defaults when search is cleared
                  if (userRole === 'admin') {
                    searchFilters = {
                      status: ['new', 'assigned', 'no_answer', 'follow_up', 'booked', 'give_up', 'done', 'missed/RS', 'unqualified', 'blacklisted'] as FilterOptions['status'],
                      includeUnassigned: true,
                      assignedTo: availableAgents.map(a => a.id), // All agents
                      bookedBy: [] // Don't filter by bookedBy for admin default
                    };
                  } else if (userRole === 'agent' && userId) {
                    searchFilters = {
                      status: ['assigned', 'no_answer', 'follow_up', 'booked', 'give_up', 'done', 'missed/RS', 'blacklisted'] as FilterOptions['status'],
                      assignedTo: [userId],
                      includeUnassigned: false,
                      bookedBy: []
                    };
                  }
                }
                
                if (searchFilters) {
                  setComponentFilterOptions(searchFilters);
                }
                
                setTimeout(() => {
                  setAllLoadedLeads([]);
                  setPage(1);
                  void fetchLeadsWithFilters(1, searchFilters, newSearchQuery);
                }, 500);
              }}
            />
            <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          
          {/* Toggle Advanced Filters */}
          <button
            onClick={() => setShowAdvancedFiltersPanel(!showAdvancedFiltersPanel)}
            className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
              showAdvancedFiltersPanel 
                ? 'bg-blue-500 text-white border-blue-500' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
            Advanced
            <ChevronDownIcon className={`h-4 w-4 transform transition-transform ${showAdvancedFiltersPanel ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleMyLeadsAll}
            className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 flex items-center gap-2"
          >
            <UserGroupIcon className="h-4 w-4" />
            My Leads (All)
          </button>
          
            <button
            onClick={handleMyLeadsAssigned}
            className="px-4 py-2 bg-cyan-100 text-cyan-800 rounded-lg hover:bg-cyan-200 flex items-center gap-2"
            >
            <UserGroupIcon className="h-4 w-4" />
            My Leads (Assigned)
            </button>
          
          <button
            onClick={handleMyFollowUpToday}
            className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 flex items-center gap-2"
          >
            <ClockIcon className="h-4 w-4" />
            My Follow Up Today
          </button>
          
          <button
            onClick={handleTodaysBookings}
            className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 flex items-center gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            My Bookings
          </button>
          
          <button
            onClick={handleGiveUpPool}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 flex items-center gap-2"
          >
            <XMarkIcon className="h-4 w-4" />
            Give Up Pool
          </button>
          
          <button
            onClick={handleAllLeads}
            className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg hover:bg-indigo-200 flex items-center gap-2"
          >
            <BookmarkIcon className="h-4 w-4" />
            All Leads
          </button>
                </div>

        {/* Advanced Filter Panel (Hidden by Default) */}
        {showAdvancedFiltersPanel && (
          <div className="bg-gray-50 rounded-lg p-4">
            <LeadsFilterComponent
              filterOptions={componentFilterOptions}
              sortOptions={componentSortOptions}
              searchQuery={componentSearchQuery}
              onFilterChange={setComponentFilterOptions}
              onSortChange={setComponentSortOptions}
              onSearchChange={setComponentSearchQuery}
              onApplyFilters={(customFilters?: FilterOptions, customSortOptions?: SortOptions) => {
                setAllLoadedLeads([]);
                setPage(1);
                // Use custom values if provided, otherwise use current state
                const filtersToUse = customFilters ?? componentFilterOptions;
                const sortToUse = customSortOptions ?? componentSortOptions;
                void fetchLeadsWithFilters(1, filtersToUse, componentSearchQuery, sortToUse);
              }}
              userRole={userRole}
              userId={userId ?? undefined}
            />
          </div>
        )}
      </div>

      {/* Main Content - Updated to use filtered leads */}
      {activeTab === 'kanban' ? (
        // Kanban board view with filtered leads
        <div className="overflow-x-auto pb-4">
          {/* Loading State for User Role or Search */}
          {(filters.search && filters.search.trim() !== '' && isSearchAutoLoading) ? (
            <div className="relative">
              {/* Blur overlay */}
              <div className="absolute inset-0 bg-white bg-opacity-60 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">
                    {'Searching leads...'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {`Looking for "${filters.search}"`}
                  </p>
                </div>
              </div>
              {/* Placeholder content (blurred) */}
              <div className="filter blur-sm pointer-events-none">
                <div className="flex space-x-4" style={{ minWidth: '1280px' }}>
                  {allStatuses.slice(0, 4).map((status) => (
                    <div key={status.id} className="flex-none w-80">
                      <div className={`p-3 rounded-t-lg ${status.color} flex justify-between items-center`}>
                        <h3 className="font-medium">{status.name}</h3>
                        <span className="px-2 py-1 rounded-full text-sm bg-white bg-opacity-80">0</span>
                      </div>
                      <div className="bg-gray-50 rounded-b-lg p-2 h-96">
                        <div className="text-center py-8 text-gray-500">
                          <p className="text-sm italic">Loading...</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filters.search && filters.search.trim() !== '' && visibleStatuses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-500">
                No leads found for &ldquo;{filters.search}&rdquo;
              </p>
              {hasMore && (
                <p className="text-sm text-blue-600 mt-2">
                  {isSearchAutoLoading ? 'Searching more data...' : 'Try loading more data or adjust your search'}
                </p>
              )}
            </div>
          ) : (
            <div className="flex space-x-4" style={{ minWidth: visibleStatuses.length * 320 + 'px' }}>
              {visibleStatuses.map((status) => {
              const statusLeads = getLeadsForStatus(status.id);
              // const totalLeads = getTotalLeadsForStatus(status.id);
              // const isFiltered = statusLeads.length !== totalLeads;
              
              return (
                <div 
                  key={`${status.id}-${status.name}`} 
                  className="flex-none w-80"
                  ref={(el) => {
                    if (el) {
                      columnRefs.current[status.id] = el;
                    }
                  }}
                >
                  <div className={`p-3 rounded-t-lg ${status.color} flex justify-between items-center`}>
                    <h3 className="font-medium">{status.name}</h3>
                    <span 
                      className={`px-2 py-1 rounded-full text-sm font-mono bg-white bg-opacity-80`}
                      title={`${statusLeads.length} total leads`}
                    >
                      {statusLeads.length}
                    </span>
                  </div>
                  <div 
                    className="bg-gray-50 rounded-b-lg p-2 h-[calc(100vh-420px)] overflow-y-auto"
                    onScroll={handleColumnScroll(status.id)}
                  >
                    {statusLeads.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {(isLoadingMore || isSearchAutoLoading) ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                            <span className="text-sm">
                              {isSearchAutoLoading ? `Searching...` : 'Loading leads...'}
                            </span>
                          </div>
                        ) : hasMore ? (
                          <div className="space-y-2">
                            <p className="text-sm italic">No {status.name.toLowerCase()} leads yet</p>
                            <button
                              onClick={() => {
                                if (!isSearchAutoLoading && !isLoadingMore) {
                                  if (filters.search && filters.search.trim() !== '') {
                                    void handleSearchAutoLoad();
                                  } else {
                                    const nextPage = page + 1;
                                    setPage(nextPage);
                                    void fetchLeadsWithFilters(nextPage);
                                  }
                                }
                              }}
                              disabled={isSearchAutoLoading || isLoadingMore}
                              className="text-xs text-blue-600 hover:text-blue-800 underline disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              Load more data to find leads
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm italic">No {status.name.toLowerCase()} leads</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {statusLeads.map((lead) => (
                          <LeadCard
                            key={`kanban-${lead.id}`}
                            lead={lead}
                            statusInfo={allStatuses.find(s => s.id === lead.status) ?? {
                              id: 'new',
                              name: 'New',
                              color: 'bg-blue-100 text-blue-800'
                            }}
                            onAction={handleLeadAction}
                            isPinned={pinnedLeads.some(p => p.id === lead.id)}
                            onView={handleViewLead}
                          />
                        ))}
                        {(isLoadingMore || isSearchAutoLoading) && (
                          <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                          </div>
                        )}
                        {/* Scroll indicator for more data */}
                        {!isLoadingMore && hasMore && statusLeads.length > 0 && (
                          <div className="text-center py-3 border-t border-gray-200 mt-2">
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-xs text-gray-400 flex items-center gap-1">
                                <svg className="w-3 h-3 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                Scroll for more
                              </div>
                              <button
                                onClick={() => {
                                  if (!isSearchAutoLoading && !isLoadingMore) {
                                    if (filters.search && filters.search.trim() !== '') {
                                      void handleSearchAutoLoad();
                                    } else {
                                      const nextPage = page + 1;
                                      setPage(nextPage);
                                      void fetchLeadsWithFilters(nextPage);
                                    }
                                  }
                                }}
                                disabled={isSearchAutoLoading || isLoadingMore}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                              >
                                Load More ({totalLeadCounts[status.id] ? `${statusLeads.length}/${totalLeadCounts[status.id]}` : '+'})
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      ) : (
        // List view for All or Pinned tabs with filtered leads
        <div className="space-y-4">
          {/* Loading State for User Role or Search in List View */}
          {(filters.search && filters.search.trim() !== '' && isSearchAutoLoading) ? (
            <div className="relative">
              {/* Blur overlay */}
              <div className="absolute inset-0 bg-white bg-opacity-60 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">
                    {'Searching leads...'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {`Looking for "${filters.search}"`}
                  </p>
                </div>
              </div>
              {/* Placeholder content (blurred) */}
              <div className="filter blur-sm pointer-events-none space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 h-32">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {getFilteredLeadsForDisplay().map((lead) => {
            const statusInfo = allStatuses.find(s => s.id === lead.status) ?? {
              id: 'new',
              name: 'New',
              color: 'bg-blue-100 text-blue-800'
            };
            return (
              <LeadCard 
                key={`filtered-${lead.id}`} 
                lead={lead} 
                statusInfo={statusInfo}
                onAction={handleLeadAction}
                isPinned={pinnedLeads.some(p => p.id === lead.id)}
                onView={handleViewLead}
              />
            );
                        })}
              
              {/* Load More Button */}
              {hasMore && activeTab !== 'pinned' && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      if (!isSearchAutoLoading && !isLoadingMore) {
                        if (filters.search && filters.search.trim() !== '') {
                          void handleSearchAutoLoad();
                        } else {
                          const nextPage = page + 1;
                          setPage(nextPage);
                          void fetchLeadsWithFilters(nextPage);
                        }
                      }
                    }}
                    disabled={isLoadingMore || isSearchAutoLoading}
                    className="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    {(isLoadingMore || isSearchAutoLoading) ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-100 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Add the AssignLeadModal */}
      <AssignLeadModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        leadId={selectedLead?.id ?? 0}
        leadName={selectedLead?.full_name ?? ''}
        onAssignComplete={() => {
          setSelectedLead(null);
          setIsAssignModalOpen(false);
          // Refresh leads
          setAllLoadedLeads([]);
          setPage(1);
          void fetchLeadsWithFilters(1);
        }}
      />

      {/* Auto-assign modal with preview and confirmation */}
      {showAssignConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Auto-Assign Leads</h2>
              <button 
                onClick={() => setShowAssignConfirmation(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
               <div className="flex items-center justify-between">
                 <div>
                   <h3 className="font-medium text-blue-900">Auto-Assignment</h3>
                   <p className="text-sm text-blue-700">
                     {autoAssignmentSettings?.is_enabled 
                       ? 'New leads are automatically assigned to checked-in agents'
                       : 'Auto-assignment is disabled. New leads will remain unassigned'
                     }
                   </p>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                   <input
                     type="checkbox"
                     checked={autoAssignmentSettings?.is_enabled ?? false}
                     onChange={(e) => toggleAutoAssignment(e.target.checked)}
                     className="sr-only peer"
                     disabled={isLoadingAutoSettings}
                   />
                   <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                 </label>
               </div>
             </div>
            
            <div className="mb-4">
              {isLoadingPreview ? (
                <div className="py-8 flex justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                </div>
              ) : assignmentStats.totalAgents === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-yellow-600 mb-4">No agents are checked in today.</p>
                  <p className="text-gray-600">Ask agents to check in before assigning leads.</p>
                </div>
              ) : assignmentStats.totalLeads === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-yellow-600 mb-4">No unassigned leads available to distribute.</p>
                  <p className="text-gray-600">Add new leads or wait for new leads to come in.</p>
                </div>
              ) : (
                <div>
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-blue-700 font-medium">Assignment Preview</p>
                    <p className="text-blue-600 text-sm">
                      {assignmentStats.totalLeads} unassigned leads will be distributed among {assignmentStats.totalAgents} checked-in agents
                    </p>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto border rounded-lg">
                    <table className="min-w-full bg-white">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="py-2 px-4 text-left border-b">Agent</th>
                          <th className="py-2 px-4 text-center border-b">Leads to Assign</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignmentPreview.map((item) => (
                          <tr key={item.agentId} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-4">{item.agentName}</td>
                            <td className="py-2 px-4 text-center">{item.leadCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {assignmentMessage && (
                    <div className={`mt-4 p-3 rounded-lg ${assignmentMessage.includes('Success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {assignmentMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex space-x-4 justify-end border-t pt-4">
              <button
                onClick={() => setShowAssignConfirmation(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Close
              </button>
              {assignmentStats.totalAgents > 0 && assignmentStats.totalLeads > 0 && !isAssigning && (
                <button
                  onClick={confirmAutoAssign}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                >
                  Confirm Assignment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Leads Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Export Leads to CSV</h2>
              <button 
                onClick={() => {
                  setIsExportModalOpen(false);
                  setExportStatus({ loading: false });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Select the lead statuses you want to export. Separate CSV files will be created for each status.
              </p>
              
              <div className="flex justify-between mb-2">
                <button 
                  onClick={selectAllStatuses}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button 
                  onClick={deselectAllStatuses}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Deselect All
                </button>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg mb-3">
                <div className="grid grid-cols-2 gap-2">
                  {LEAD_STATUSES.map(status => (
                    <div key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`status-${status}`}
                        checked={selectedExportStatuses[status] ?? false}
                        onChange={() => toggleStatusSelection(status)}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`status-${status}`} className="text-sm text-gray-700">
                        {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 max-h-40 overflow-y-auto">
                <p className="font-semibold mb-1">Exported columns:</p>
                <p className="font-mono">
                  id, firstName, lastName, email, city, company, country, industry, jobTitle, personalPhone, revenue, timezone, twitter, website, work, status, created_at, updated_at
                </p>
              </div>
              
              {exportStatus.error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg">
                  {exportStatus.error}
                </div>
              )}
              
              {exportStatus.success && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg">
                  {exportStatus.success}
                </div>
              )}
            </div>
            
            <div className="flex space-x-4 justify-end">
              <button
                onClick={() => {
                  setIsExportModalOpen(false);
                  setExportStatus({ loading: false });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                disabled={exportStatus.loading}
              >
                Cancel
              </button>
              <button
                onClick={handleExportLeads}
                disabled={exportStatus.loading || Object.values(selectedExportStatuses).every(v => !v)}
                className={`px-4 py-2 ${
                  exportStatus.loading 
                    ? 'bg-teal-300 cursor-not-allowed' 
                    : Object.values(selectedExportStatuses).every(v => !v)
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-teal-500 hover:bg-teal-600'
                } text-white rounded flex items-center`}
              >
                {exportStatus.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    Export CSV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Removed censored export modal per user request */}

      {/* Add LeadEditSlideOver at the end of the component */}
      {selectedLead && <LeadEditSlideOver
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
        onSave={handleSaveLead}
        onAction={handleLeadAction}
      />}

      {/* Add page-level WhatsApp modal */}
      {whatsAppLeadData && (
        <CustomWhatsAppModal
          isOpen={isPageWhatsAppModalOpen}
          onClose={() => {
            setIsPageWhatsAppModalOpen(false);
            setWhatsAppLeadData(null);
          }}
          phoneNumber={whatsAppLeadData.phoneNumber}
          leadId={whatsAppLeadData.leadId}
        />
      )}


      {/* Status Reason Modal */}
      {statusReasonLeadData && (
        <LeadStatusReasonModal
          isOpen={isStatusReasonModalOpen}
          onClose={() => {
            setIsStatusReasonModalOpen(false);
            setStatusReasonLeadData(null);
          }}
          onConfirm={handleStatusReasonConfirm}
          leadName={statusReasonLeadData.leadName}
        />
      )}

      {/* Disable Auto-Assignment Confirmation Modal */}
      {showDisableConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Disable Auto-Assignment</h2>
              <button 
                onClick={() => setShowDisableConfirmation(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Auto-Assignment is Currently Enabled
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Auto-assignment is currently enabled, which means new leads are automatically assigned to checked-in agents.
                      </p>
                      <p className="mt-2">
                        Do you want to disable auto-assignment? This will stop automatic assignment of new leads.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-4 justify-end">
              <button
                onClick={() => setShowDisableConfirmation(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDisableAutoAssignment}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Disable Auto-Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Loading Notification for Agents with Stop Button */}
      {userRole === 'agent' && (isLoadingMore || isAutoLoading) && page > 1 && !isSearchAutoLoading && (
                 <div className="fixed bottom-4 right-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-lg border-l-4 border-blue-500 z-40 max-w-sm">
           <div className="flex items-center justify-between gap-3">
             <div className="flex items-center gap-2">
               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
               <div>
                 <div className="text-sm font-medium">Finding your assigned leads...</div>
                 <div className="text-xs text-blue-600">
                   Loaded {allLoadedLeads.length} leads, attempt {autoLoadingAttempts}/3
                 </div>
               </div>
             </div>
             {isAutoLoading && (
               <button
                 onClick={() => {
                   setIsAutoLoading(false);
                   setAutoLoadingAttempts(3); // Set to max to prevent further auto-loading
                   showNotification('Auto-loading stopped', 'info');
                 }}
                 className="text-xs bg-blue-200 hover:bg-blue-300 text-blue-900 px-2 py-1 rounded"
               >
                 Stop
               </button>
             )}
           </div>
         </div>
       )}

      {/* Search Auto-Loading Notification */}
      {isSearchAutoLoading && filters.search && (
        <div className="fixed bottom-4 right-4 bg-green-100 text-green-800 px-4 py-2 rounded-lg shadow-lg border-l-4 border-green-500 z-40 max-w-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              <div>
                <div className="text-sm font-medium">Searching for &ldquo;{filters.search}&rdquo;...</div>
                <div className="text-xs text-green-600">
                  Loaded {allLoadedLeads.length} leads, attempt {searchAutoLoadingAttempts}/5
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setIsSearchAutoLoading(false);
                setSearchAutoLoadingAttempts(5); // Set to max to prevent further auto-loading
                showNotification('Search auto-loading stopped', 'info');
              }}
              className="text-xs bg-green-200 hover:bg-green-300 text-green-900 px-2 py-1 rounded"
            >
              Stop
            </button>
          </div>
        </div>
      )}

    </div>
  );
}