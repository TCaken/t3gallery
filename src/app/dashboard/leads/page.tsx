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
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import LeadCard  from '~/app/_components/LeadCard';
import { hasPermission } from '~/server/rbac/queries';
import { updateLeadStatus, fetchFilteredLeads } from '~/app/_actions/leadActions';
import { type InferSelectModel } from 'drizzle-orm';
import { type leads, type leadStatusEnum } from "~/server/db/schema";
import { togglePinLead, getPinnedLeads } from '~/app/_actions/pinnedLeadActions';
import { sendWhatsAppMessage } from '~/app/_actions/whatsappActions';
import { fetchUserData } from '~/app/_actions/userActions';
import { checkInAgent, checkOutAgent, getAssignmentPreview, autoAssignLeads } from '~/app/_actions/agentActions';
import AssignLeadModal from '~/app/_components/AssignLeadModal';
import { exportAllLeadsToCSV } from '~/app/_actions/exportActions';


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
  const [filters, setFilters] = useState<{
    status?: LeadStatus;
    search?: string;
    sortBy?: 'id' | 'created_at' | 'updated_at' | 'full_name' | 'amount' | 'phone_number';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }>({
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

  // Modify fetchLeadsWithFilters to load more leads when needed
  const fetchLeadsWithFilters = async (pageNum = 1) => {
    try {
      setIsLoadingMore(true);
      console.log('Fetching leads page:', pageNum);
      
      const result = await fetchFilteredLeads({
        search: '', // Don't send search to server
        sortBy: filters.sortBy ?? "created_at",
        sortOrder: filters.sortOrder ?? "desc",
        page: pageNum,
        limit: 50
      });
      
      if (result.success && result.leads) {
        setAllLoadedLeads(prev => [...prev, ...result.leads]);
        setHasMore(result.hasMore ?? false);
      } else {
        throw new Error(result.error ?? 'Failed to fetch leads');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Effect to load more leads if search has no results
  useEffect(() => {
    const loadMoreIfNeeded = async () => {
      if (!filters.search) return;
      
      const filteredLeads = filterLeads(allLoadedLeads, filters.search);
      if (filteredLeads.length === 0 && hasMore && !isLoadingMore) {
        const nextPage = Math.ceil(allLoadedLeads.length / 50) + 1;
        await fetchLeadsWithFilters(nextPage);
      }
    };

    void loadMoreIfNeeded();
  }, [filters.search, allLoadedLeads, hasMore, isLoadingMore]);

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
        
        const previewResult = await getAssignmentPreview();
        if (previewResult.success) {
          setAssignmentPreview(previewResult.preview);
          setAssignmentStats({
            totalAgents: previewResult.totalAgents,
            totalLeads: previewResult.totalLeads
          });
        }
        
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
    console.log('handleLeadAction:', action, leadId);
    console.log('allLoadedLeads:', allLoadedLeads);
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

      switch (action) {
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
            'whatsapp'
          );
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
        // Reset to first page and clear current leads
        setAllLoadedLeads([]);
        setPage(1);
        // Fetch fresh data
        await fetchLeadsWithFilters(1);
      }
    } catch (error) {
      console.error('Error in handleLeadAction:', error);
      showNotification('Failed to perform action', 'error');
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
      const downloadCount = Object.entries(result.csvDataByStatus).length;
      
      // Process each status CSV
      Object.entries(result.csvDataByStatus).forEach(([status, csvData]) => {
        // Create a Blob from the CSV data
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
        
        // Create a download link element
        const downloadLink = document.createElement('a');
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
        
        // Set attributes for the download link
        downloadLink.href = url;
        downloadLink.download = `leads_${date}_${status}.csv`;
        
        // Append to the document, click it to trigger download, then remove it
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Release the URL object
        URL.revokeObjectURL(url);
      });
      
      // Prepare the success message with counts
      const statusCounts = Object.entries(result.statusCounts ?? {})
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ');
      
      setExportStatus({ 
        loading: false, 
        success: `Successfully exported ${result.totalExported} leads in ${downloadCount} files (${statusCounts}).` 
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
                  void getAssignmentPreview().then(result => {
                    if (result.success) {
                      setAssignmentPreview(result.preview);
                      setAssignmentStats({
                        totalAgents: result.totalAgents,
                        totalLeads: result.totalLeads
                      });
                    }
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

      {/* Search Bar */}
      <div className="mb-6">
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
                
                // Scroll to results after a short delay to allow filtering
                setTimeout(() => scrollToResults(value), 100);
              }}
            />
            <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          
          {/* Search Results Count */}
          {filters.search && (
            <div className="text-sm text-gray-500">
              {filterLeads(allLoadedLeads, filters.search).length} results
              {isLoadingMore && ' (loading more...)'}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <select
          value={filters.status ?? 'new'}
          onChange={(e) => setFilters(prev => ({
            ...prev,
            status: e.target.value as LeadStatus
          }))}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        >
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          value={filters.sortBy ?? 'created_at'}
          onChange={(e) => setFilters(prev => ({
            ...prev,
            sortBy: e.target.value as 'id' | 'created_at' | 'updated_at' | 'full_name' | 'amount' | 'phone_number'
          }))}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="created_at">Created Date</option>
          <option value="updated_at">Updated Date</option>
          <option value="full_name">Name</option>
          <option value="amount">Amount</option>
        </select>

        <button
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          onClick={() => setFilters(prev => ({
            ...prev,
            sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
          }))}
        >
          {filters.sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Main Content - Kanban Board or List depending on active tab */}
      {activeTab === 'kanban' ? (
        // Kanban board view
        <div className="overflow-x-auto pb-4">
          <div className="flex space-x-4" style={{ minWidth: visibleStatuses.length * 320 + 'px' }}>
            {visibleStatuses.map((status) => {
              const statusLeads = status.id === 'pinned'
                ? pinnedLeads
                : filterLeads(allLoadedLeads, filters.search ?? '')
                    .filter(lead => lead.status === status.id);
              
              return (
                <div 
                  key={status.id} 
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
                    className="bg-gray-50 rounded-b-lg p-2 h-[calc(100vh-320px)] overflow-y-auto"
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
                            key={lead.id}
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
        // List view for All or Pinned tabs
        <div className="space-y-4">
          {getCurrentLeads().map((lead) => {
            const statusInfo = allStatuses.find(s => s.id === lead.status) ?? {
              id: 'new',
              name: 'New',
              color: 'bg-blue-100 text-blue-800'
            };
            return (
              <LeadCard 
                key={lead.id} 
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
                onClick={() => setFilters(prev => ({
                  ...prev,
                  page: (prev.page ?? 1) + 1
                }))}
                disabled={loading[filters.status ?? 'new']}
                className="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {loading[filters.status ?? 'new'] ? 'Loading...' : 'Load More'}
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
    </div>
  );
}