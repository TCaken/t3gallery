"use client";

import { useState, useEffect, useRef } from 'react';
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
import { updateLead,updateLeadStatus, fetchFilteredLeads } from '~/app/_actions/leadActions';
import { type InferSelectModel } from 'drizzle-orm';
import { type leads, type leadStatusEnum } from "~/server/db/schema";
import { togglePinLead, getPinnedLeads } from '~/app/_actions/pinnedLeadActions';
import { sendWhatsAppMessage } from '~/app/_actions/whatsappActions';
import { fetchUserData } from '~/app/_actions/userActions';
import { checkInAgent, checkOutAgent, autoAssignLeads, checkAgentStatus, getAutoAssignmentSettings, updateAutoAssignmentSettings, getAssignmentPreviewWithRoundRobin, bulkAutoAssignLeads, updateAgentCapacity, resetRoundRobinIndex, getManualAssignmentPreview } from '~/app/_actions/agentActions';
import AssignLeadModal from '~/app/_components/AssignLeadModal';
import { exportAllLeadsToCSV } from '~/app/_actions/exportActions';
import { makeCall } from '~/app/_actions/callActions';
import LeadEditSlideOver from '~/app/_components/LeadEditSlideOver';


// Infer Lead type from the schema
type Lead = InferSelectModel<typeof leads> & {
  // Ensure phone_number is treated as a string
  phone_number: string;
};

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
  'done',
  'missed/RS',
  'unqualified',
  'give_up',
  'blacklisted'
] as const;

type LeadStatus = typeof LEAD_STATUSES[number];

// Define status info for styling
const allStatuses = [
  { id: 'new', name: 'New', color: 'bg-blue-100 text-blue-800' },
  { id: 'assigned', name: 'Assigned', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'no_answer', name: 'No Answer', color: 'bg-gray-100 text-gray-800' },
  { id: 'follow_up', name: 'Follow Up', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'booked', name: 'Booked', color: 'bg-green-100 text-green-800' },
  { id: 'done', name: 'Done', color: 'bg-green-100 text-green-800' },
  { id: 'missed/RS', name: 'Missed/RS', color: 'bg-red-100 text-red-800' },
  { id: 'unqualified', name: 'Unqualified', color: 'bg-orange-100 text-orange-800' },
  { id: 'give_up', name: 'Give Up', color: 'bg-red-100 text-red-800' },
  { id: 'blacklisted', name: 'Blacklisted', color: 'bg-black text-white' },
] as const;

// Tab options
const TABS = [
  { id: 'kanban', name: 'Kanban Board', icon: <FunnelIcon className="h-5 w-5" /> },
  { id: 'all', name: 'All Leads', icon: <UserGroupIcon className="h-5 w-5" /> },
  { id: 'pinned', name: 'Pinned Leads', icon: <BookmarkIcon className="h-5 w-5" /> },
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

// Define user role type
type UserRole = 'admin' | 'agent' | 'retail' | 'user';

// Helper component to safely display dates
const SafeDate = ({ date }: { date: Date | string | null }) => {
  if (!date) return <span>Unknown date</span>;
  try {
    return <span>{new Date(date).toLocaleDateString()}</span>;
  } catch (e) {
    return <span>Invalid date</span>;
  }
};

// Enhanced filter interface
interface LeadFilters {
  status?: LeadStatus;
  search?: string;
  sortBy?: 'id' | 'created_at' | 'updated_at' | 'full_name' | 'amount' | 'phone_number' | 'employment_salary' | 'lead_score';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  // Frontend filters
  amountRange?: [number, number];
  source?: string[];
  employmentStatus?: string[];
  loanPurpose?: string[];
  residentialStatus?: string[];
  dateRange?: [Date, Date];
  assignedTo?: string[];
}

// Helper interface for dynamic filter options
interface FilterOptions {
  sources: string[];
  employmentStatuses: string[];
  loanPurposes: string[];
  residentialStatuses: string[];
  assignedUsers: string[];
  amountRange: [number, number];
  dateRange: [Date, Date];
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
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
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
  const [userRole, setUserRole] = useState<UserRole>('user');
  const { userId } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAssignConfirmation, setShowAssignConfirmation] = useState(false);
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
    limit: 50
  });
  const [statusFilter, setStatusFilter] = useState<LeadStatus>('new');
  const validStatuses = LEAD_STATUSES;

  // Define statuses that agents can move leads to
  const agentAllowedStatuses = [
    'assigned', 
    'no_answer', 
    'follow_up',
    'booked',
    'done',
    'missed/RS',
    'unqualified',
    'give_up', 
    'blacklisted'
  ];

  // Add new state for tracking pagination
  const [page, setPage] = useState(1);


  // Add state for all loaded leads
  const [allLoadedLeads, setAllLoadedLeads] = useState<Lead[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    sources: [],
    employmentStatuses: [],
    loanPurposes: [],
    residentialStatuses: [],
    assignedUsers: [],
    amountRange: [0, 0],
    dateRange: [new Date(), new Date()]
  });
  const [activeFilters, setActiveFilters] = useState<LeadFilters>({});

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

  // Enhanced function to apply frontend filters
  const applyFrontendFilters = (leads: Lead[]) => {
    let filteredLeads = [...leads];

    // Apply search filter
    if (filters.search) {
      filteredLeads = filterLeads(filteredLeads, filters.search);
    }

    // Apply amount range filter
    if (activeFilters.amountRange) {
      const [min, max] = activeFilters.amountRange;
      filteredLeads = filteredLeads.filter(lead => {
        const amount = parseFloat(lead.amount ?? '0');
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
    if (activeFilters.dateRange) {
      const [startDate, endDate] = activeFilters.dateRange;
      filteredLeads = filteredLeads.filter(lead => {
        const createdDate = new Date(lead.created_at);
        return createdDate >= startDate && createdDate <= endDate;
      });
    }

    return filteredLeads;
  };

  // Function to extract filter options from loaded leads
  const updateFilterOptions = (leads: Lead[]) => {
    const sources: string[] = [...new Set(leads.map(lead => lead.source).filter((s): s is string => Boolean(s)))];
    const employmentStatuses: string[] = [...new Set(leads.map(lead => lead.employment_status).filter((s): s is string => Boolean(s)))];
    const loanPurposes: string[] = [...new Set(leads.map(lead => lead.loan_purpose).filter((s): s is string => Boolean(s)))];
    const residentialStatuses: string[] = [...new Set(leads.map(lead => lead.residential_status).filter((s): s is string => Boolean(s)))];
    const assignedUsers: string[] = [...new Set(leads.map(lead => lead.assigned_to).filter((s): s is string => Boolean(s)))];
    
    const amounts = leads.map(lead => parseFloat(lead.amount ?? '0')).filter(amount => amount > 0);
    const amountRange: [number, number] = amounts.length > 0 
      ? [Math.min(...amounts), Math.max(...amounts)]
      : [0, 0];
    
    const dates = leads.map(lead => new Date(lead.created_at));
    const dateRange: [Date, Date] = dates.length > 0
      ? [new Date(Math.min(...dates.map(d => d.getTime()))), new Date(Math.max(...dates.map(d => d.getTime())))]
      : [new Date(), new Date()];

    setFilterOptions({
      sources,
      employmentStatuses,
      loanPurposes,
      residentialStatuses,
      assignedUsers,
      amountRange,
      dateRange
    });
  };

  // Enhanced sorting options
  const sortOptions = [
    { value: 'created_at', label: 'Created Date' },
    { value: 'updated_at', label: 'Updated Date' },
    { value: 'full_name', label: 'Name' },
    { value: 'amount', label: 'Amount' },
    { value: 'phone_number', label: 'Phone Number' },
    { value: 'employment_salary', label: 'Employment Salary' },
    { value: 'lead_score', label: 'Lead Score' },
    { value: 'id', label: 'ID' }
  ];

  // Function to refresh data with new sort/filter parameters
  const refreshDataWithFilters = async () => {
    setAllLoadedLeads([]);
    setPage(1);
    await fetchLeadsWithFilters(1);
  };

  // Modify fetchLeadsWithFilters to load more leads when needed
  const fetchLeadsWithFilters = async (pageNum = 1) => {
    try {
      setIsLoadingMore(true);
      
      const result = await fetchFilteredLeads({
        search: '', // Don't send search to server, handle it frontend
        sortBy: filters.sortBy ?? "created_at",
        sortOrder: filters.sortOrder ?? "desc",
        page: pageNum,
        limit: 50
      });
      
      if (result.success && result.leads) {
        const newLeads = [...(pageNum === 1 ? [] : allLoadedLeads), ...result.leads.map(lead => ({
          ...lead,
          follow_up_date: null // Add missing property to match Lead type
        }))];
        setAllLoadedLeads(newLeads);
        setHasMore(result.hasMore ?? false);
        
        // Update filter options based on all loaded leads
        updateFilterOptions(newLeads);
      } else {
        throw new Error(result.error ?? 'Failed to fetch leads');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingMore(false);
    }
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

  // Load auto-assignment settings
  const loadAutoAssignmentSettings = async () => {
    try {
      setIsLoadingAutoSettings(true);
      const result = await getAutoAssignmentSettings();
      if (result.success && result.settings) {
        setAutoAssignmentSettings({
          is_enabled: result.settings.is_enabled ?? false,
          assignment_method: result.settings.assignment_method ?? 'round_robin',
          max_leads_per_agent_per_day: result.settings.max_leads_per_agent_per_day ?? 20,
          current_round_robin_index: result.settings.current_round_robin_index ?? 0
        });
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
      const result = await updateAutoAssignmentSettings({ is_enabled: enabled });
      if (result.success) {
        setAutoAssignmentSettings(prev => prev ? { ...prev, is_enabled: enabled } : null);
        showNotification(
          enabled ? 'Auto-assignment enabled' : 'Auto-assignment disabled', 
          'success'
        );
      } else {
        showNotification('Failed to update auto-assignment settings', 'error');
      }
    } catch (error) {
      console.error('Error toggling auto-assignment:', error);
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

  // Initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load first page of leads
        await fetchLeadsWithFilters(1);
        
        // Load pinned leads
        const pinnedResult = await getPinnedLeads();
        if (pinnedResult.success && pinnedResult.pinnedLeads) {
          const pinnedLeadIds = pinnedResult.pinnedLeads.map(p => p.lead_id);
          // Get pinned leads from all columns
          const allLeads = Object.values(leads).flat();
          const pinnedLeadsData = allLeads.filter(lead => pinnedLeadIds.includes(lead.id));
          setPinnedLeads(pinnedLeadsData);
        }
        
        // Load user role
        const { roles } = await fetchUserData();
        if (roles && roles.length > 0) {
          const roleName = roles[0]?.roleName ?? 'user';
          setUserRole(roleName as UserRole);
          
          // If user is an agent, check their check-in status
          if (roleName === 'agent') {
            const statusResult = await checkAgentStatus();
            if (statusResult.success) {
              setIsCheckedIn(statusResult.isCheckedIn);
            }
          }
        }
      } catch (err) {
        console.error('Error in loadInitialData:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    void loadInitialData();
  }, []);

  // Modify handleScroll to load more leads when scrolling in any column
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      void fetchLeadsWithFilters(nextPage);
    }
  };

  // Update the visibleStatuses definition to include pinned leads first
  const visibleStatuses = [
    // Add pinned leads column first
    { id: 'pinned', name: 'Pinned Leads', color: 'bg-blue-100 text-blue-800' },
    // Then add other statuses
    ...(userRole === 'agent'
      ? allStatuses.filter(col => agentAllowedStatuses.includes(col.id))
      : allStatuses)
  ];

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
      console.log('lead', JSON.stringify(lead), action);

      switch (action) {
        case 'edit':
          setSelectedLead(lead);
          setIsEditOpen(true);
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
        case 'move_to_give_up':
        case 'move_to_blacklisted':
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
            newLeads[oldStatus] = newLeads[oldStatus]?.filter(l => l.id !== leadId) ?? [];
            // Add to new status
            newLeads[newStatus] = [...(newLeads[newStatus] ?? []), { ...lead, status: newStatus }];
            return newLeads;
          });
          
          showNotification('Status updated successfully', 'success');
          needsRefresh = true;
          break;

        case 'whatsapp':
          await sendWhatsAppMessage(
            lead.phone_number,
            'example_template',
            {},
            'whatsapp',
            lead.id
          );
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
          // console.log('Unknown action:', action);
      }

      // Refresh all leads if needed
      if (needsRefresh) {
        setAllLoadedLeads([]);
        setPage(1);
        await fetchLeadsWithFilters(1);
      }
    } catch (error) {
      console.error('Error in handleLeadAction:', error);
      showNotification('Failed to perform action', 'error');
    }
  };

  const handleSaveLead = async (updatedLead: Partial<Lead>) => {
    try {
      if (!selectedLead?.id) return;
      
      const result = await updateLead(selectedLead.id, updatedLead);
      if (result.success) {
        // Update the lead in allLoadedLeads
        setAllLoadedLeads(prevLeads => 
          prevLeads.map(lead => 
            lead.id === selectedLead.id ? { ...lead, ...updatedLead } : lead
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

  // Function to handle CSV export
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
      
      if (!result.success || !result.csvDataByStatus) {
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
                const agentName = result.agentNames?.[agentId] || 'Unknown';
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
                onClick={() => {
                  // Load fresh preview data when opening the modal
                  setIsLoadingPreview(true);
                  setShowAssignConfirmation(true);
                  void loadAssignmentPreview().then(() => {
                    setIsLoadingPreview(false);
                  });
                }}
                disabled={isAssigning}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  isAssigning
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                <ArrowDownOnSquareIcon className="h-5 w-5 mr-2" />
                {isAssigning ? 'Assigning...' : 'Auto Assign Leads'}
              </button>
              {/* Auto-Assignment Management Button */}
              {/*<button
                onClick={() => {
                  setIsAutoAssignModalOpen(true);
                  void loadAutoAssignmentSettings();
                  void loadAssignmentPreview();
                }}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center"
              >
                <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
                Auto-Assignment
                {autoAssignmentSettings?.is_enabled && (
                  <span className="ml-2 w-2 h-2 bg-green-400 rounded-full"></span>
                )}
              </button> */}
              {/* Add Export to CSV button */}
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center"
              >
                <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                Export to CSV
              </button>
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

      {/* Enhanced Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by phone, ID, or name..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:border-blue-500 focus:outline-none"
              value={filters.search ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setFilters(prev => ({
                  ...prev,
                  search: value,
                  page: 1
                }));
                
                setTimeout(() => scrollToResults(value), 100);
              }}
            />
            <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          
          {/* Toggle Advanced Filters */}
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
            <ChevronDownIcon className={`h-4 w-4 transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Search Results Count */}
          {filters.search && (
            <div className="text-sm text-gray-500">
              {getFilteredLeadsForDisplay().length} results
              {isLoadingMore && ' (loading more...)'}
            </div>
          )}
        </div>

        {/* Basic Filters Row */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Status Filter */}
          <select
            value={filters.status ?? 'new'}
            onChange={(e) => {
              setFilters(prev => ({
                ...prev,
                status: e.target.value as LeadStatus
              }));
              void refreshDataWithFilters();
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Enhanced Sort Options */}
          <select
            value={filters.sortBy ?? 'created_at'}
            onChange={(e) => {
              setFilters(prev => ({
                ...prev,
                sortBy: e.target.value as LeadFilters['sortBy']
              }));
              void refreshDataWithFilters();
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Sort by {option.label}
              </option>
            ))}
          </select>

          {/* Sort Order */}
          <button
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none hover:bg-gray-50"
            onClick={() => {
              setFilters(prev => ({
                ...prev,
                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
              }));
              void refreshDataWithFilters();
            }}
          >
            {filters.sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </button>

          {/* Clear Filters Button */}
          {Object.keys(activeFilters).length > 0 && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              Clear Filters ({Object.keys(activeFilters).length})
            </button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-medium text-gray-900 mb-3">Advanced Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Amount Range Filter */}
              {filterOptions.amountRange[1] > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Range (${filterOptions.amountRange[0]} - ${filterOptions.amountRange[1]})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      className="flex-1 rounded border border-gray-300 px-3 py-1 text-sm"
                      onChange={(e) => {
                        const min = parseFloat(e.target.value) || filterOptions.amountRange[0];
                        setActiveFilters(prev => ({
                          ...prev,
                          amountRange: [min, activeFilters.amountRange?.[1] || filterOptions.amountRange[1]]
                        }));
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="flex-1 rounded border border-gray-300 px-3 py-1 text-sm"
                      onChange={(e) => {
                        const max = parseFloat(e.target.value) || filterOptions.amountRange[1];
                        setActiveFilters(prev => ({
                          ...prev,
                          amountRange: [activeFilters.amountRange?.[0] || filterOptions.amountRange[0], max]
                        }));
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Source Filter */}
              {filterOptions.sources.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                  <select
                    multiple
                    className="w-full rounded border border-gray-300 px-3 py-1 text-sm h-20"
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setActiveFilters(prev => ({ ...prev, source: selected }));
                    }}
                  >
                    {filterOptions.sources.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Employment Status Filter */}
              {filterOptions.employmentStatuses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
                  <select
                    multiple
                    className="w-full rounded border border-gray-300 px-3 py-1 text-sm h-20"
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setActiveFilters(prev => ({ ...prev, employmentStatus: selected }));
                    }}
                  >
                    {filterOptions.employmentStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Loan Purpose Filter */}
              {filterOptions.loanPurposes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Loan Purpose</label>
                  <select
                    multiple
                    className="w-full rounded border border-gray-300 px-3 py-1 text-sm h-20"
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setActiveFilters(prev => ({ ...prev, loanPurpose: selected }));
                    }}
                  >
                    {filterOptions.loanPurposes.map(purpose => (
                      <option key={purpose} value={purpose}>{purpose}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Residential Status Filter */}
              {filterOptions.residentialStatuses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Residential Status</label>
                  <select
                    multiple
                    className="w-full rounded border border-gray-300 px-3 py-1 text-sm h-20"
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setActiveFilters(prev => ({ ...prev, residentialStatus: selected }));
                    }}
                  >
                    {filterOptions.residentialStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assigned User Filter */}
              {filterOptions.assignedUsers.length > 0 && userRole === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
                  <select
                    multiple
                    className="w-full rounded border border-gray-300 px-3 py-1 text-sm h-20"
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setActiveFilters(prev => ({ ...prev, assignedTo: selected }));
                    }}
                  >
                    {filterOptions.assignedUsers.map(user => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Active Filters Summary */}
            {Object.keys(activeFilters).length > 0 && (
              <div className="border-t pt-3 mt-4">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-700">Active filters:</span>
                  {Object.entries(activeFilters).map(([key, value]) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) return null;
                    
                    let displayValue = '';
                    if (Array.isArray(value)) {
                      displayValue = value.join(', ');
                    } else if (key === 'amountRange') {
                      const range = value as [number, number];
                      displayValue = `$${range[0]} - $${range[1]}`;
                    } else {
                      displayValue = String(value);
                    }
                    
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {key}: {displayValue}
                        <button
                          onClick={() => {
                            setActiveFilters(prev => {
                              const newFilters = { ...prev };
                              delete newFilters[key as keyof LeadFilters];
                              return newFilters;
                            });
                          }}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content - Updated to use filtered leads */}
      {activeTab === 'kanban' ? (
        // Kanban board view with filtered leads
        <div className="overflow-x-auto pb-4">
          <div className="flex space-x-4" style={{ minWidth: visibleStatuses.length * 320 + 'px' }}>
            {visibleStatuses.map((status) => {
              const statusLeads = getLeadsForStatus(status.id);
              
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
                    <span className="px-2 py-1 bg-white bg-opacity-80 rounded-full text-sm">
                      {statusLeads.length}
                    </span>
                  </div>
                  <div 
                    className="bg-gray-50 rounded-b-lg p-2 h-[calc(100vh-420px)] overflow-y-auto"
                    onScroll={handleScroll}
                  >
                    {statusLeads.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 italic text-sm">
                        {isLoadingMore ? 'Loading more...' : 'No leads'}
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
                        {isLoadingMore && (
                          <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // List view for All or Pinned tabs with filtered leads
        <div className="space-y-4">
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
                  const nextPage = page + 1;
                  setPage(nextPage);
                  void fetchLeadsWithFilters(nextPage);
                }}
                disabled={isLoadingMore}
                className="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
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

      {/* Add LeadEditSlideOver at the end of the component */}
      {selectedLead && <LeadEditSlideOver
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
        onSave={handleSaveLead}
      />}

      {/* Auto-Assignment Management Modal */}
      {isAutoAssignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Auto-Assignment Management</h2>
              <button 
                onClick={() => setIsAutoAssignModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            {/* Auto-Assignment Toggle */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900">Auto-Assignment Status</h3>
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

            {/* Assignment Preview */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Assignment Preview</h3>
                <button
                  onClick={loadAssignmentPreview}
                  disabled={isLoadingPreview}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {isLoadingPreview ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              
              {isLoadingPreview ? (
                <div className="py-8 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : autoAssignStats.totalAgents === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-yellow-600 mb-2">No agents are checked in today.</p>
                  <p className="text-gray-600">Ask agents to check in before assigning leads.</p>
                </div>
              ) : autoAssignStats.totalLeads === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-yellow-600 mb-2">No unassigned leads available.</p>
                  <p className="text-gray-600">New leads will be automatically assigned as they come in.</p>
                </div>
              ) : (
                <div>
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <p className="text-green-700 font-medium">
                      {autoAssignStats.leadsToAssign} leads ready for assignment
                    </p>
                    <p className="text-green-600 text-sm">
                      Distribution among {autoAssignStats.totalAgents} available agents using round-robin
                    </p>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="min-w-full bg-white">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="py-2 px-4 text-left border-b">Agent</th>
                          <th className="py-2 px-4 text-center border-b">Current</th>
                          <th className="py-2 px-4 text-center border-b">Will Receive</th>
                          <th className="py-2 px-4 text-center border-b">New Total</th>
                          <th className="py-2 px-4 text-center border-b">Capacity</th>
                          <th className="py-2 px-4 text-center border-b">Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {autoAssignPreview.map((agent) => (
                          <tr key={agent.agentId} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-4">{agent.agentName}</td>
                            <td className="py-2 px-4 text-center">{agent.currentCount}</td>
                            <td className="py-2 px-4 text-center font-medium text-blue-600">
                              +{agent.leadCount}
                            </td>
                            <td className="py-2 px-4 text-center">
                              {agent.currentCount + agent.leadCount}
                            </td>
                            <td className="py-2 px-4 text-center">{agent.capacity}</td>
                            <td className="py-2 px-4 text-center">{agent.weight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="mb-6 border-t pt-4">
              <h3 className="text-lg font-medium mb-4">Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assignment Method
                  </label>
                  <select
                    value={autoAssignmentSettings?.assignment_method ?? 'round_robin'}
                    onChange={(e) => updateAutoAssignmentSettings({ assignment_method: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="round_robin">Round Robin</option>
                    <option value="weighted">Weighted Distribution</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Leads per Agent per Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={autoAssignmentSettings?.max_leads_per_agent_per_day ?? 20}
                    onChange={(e) => updateAutoAssignmentSettings({ 
                      max_leads_per_agent_per_day: parseInt(e.target.value) 
                    })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-4 justify-end border-t pt-4">
              <button
                onClick={() => resetRoundRobinIndex()}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Reset Round-Robin
              </button>
              <button
                onClick={() => setIsAutoAssignModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Close
              </button>
              {autoAssignStats.totalLeads > 0 && autoAssignStats.totalAgents > 0 && (
                <button
                  onClick={handleBulkAutoAssign}
                  disabled={isAssigning}
                  className={`px-4 py-2 rounded ${
                    isAssigning
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {isAssigning ? 'Assigning...' : `Assign ${autoAssignStats.leadsToAssign} Leads`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}