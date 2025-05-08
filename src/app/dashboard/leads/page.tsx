"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { 
  PlusIcon, 
  FunnelIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  BookmarkIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  ArrowUpTrayIcon,
  CalendarIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserPlusIcon,
  ArrowDownOnSquareIcon
} from '@heroicons/react/24/outline';
import LeadCard  from '~/app/_components/LeadCard';
import { hasPermission } from '~/server/rbac/queries';
import { fetchLeads, populateLeads, updateLeadStatus } from '~/app/_actions/leadActions';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from "~/server/db/schema";
import LazyComment from '~/app/_components/LazyComment';
import LeadActionButtons from '~/app/_components/LeadActionButtons';
import { togglePinLead, getPinnedLeads } from '~/app/_actions/pinnedLeadActions';
import { sendWhatsAppMessage } from '~/app/_actions/whatsappActions';
import { fetchUserData } from '~/app/_actions/userActions';
import { checkInAgent, checkOutAgent, getAssignmentPreview, autoAssignLeads } from '~/app/_actions/agentActions';
import AssignLeadModal from '~/app/_components/AssignLeadModal';
import TagSelectionModal from '~/app/_components/TagSelectionModal';
import { updateLeadTag, getLeadTag, removeLeadTag } from '~/app/_actions/tagActions';

// Infer Lead type from the schema
type Lead = InferSelectModel<typeof leads>;

// Update the StatusInfo type definition
type StatusInfo = {
  id: string;
  name: string;
  color: string;
};

// Update the LEAD_STATUSES constant
const LEAD_STATUSES: StatusInfo[] = [
  { id: 'new', name: 'New', color: 'bg-blue-100 text-blue-800' },
  { id: 'assigned', name: 'Assigned', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'follow_up', name: 'Follow Up', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'no_answer', name: 'No Answer', color: 'bg-gray-100 text-gray-800' },
  { id: 'booked', name: 'Booked', color: 'bg-green-100 text-green-800' },
  { id: 'done', name: 'Done', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'miss/RS', name: 'Miss/RS', color: 'bg-pink-100 text-pink-800' },
  { id: 'unqualified', name: 'Unqualified', color: 'bg-orange-100 text-orange-800' },
  { id: 'give_up', name: 'Give Up', color: 'bg-red-100 text-red-800' },
  { id: 'blacklisted', name: 'Blacklisted', color: 'bg-black text-white' },
];

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
    "miss/RS": "bg-pink-100 text-pink-800",
    unqualified: "bg-orange-100 text-orange-800",
    give_up: "bg-red-100 text-red-800",
    blacklisted: "bg-black text-white",
  };
  return statusMap[status] ?? "bg-gray-100 text-gray-800";
};

// Define user role type
type UserRole = 'admin' | 'agent' | 'retail' | 'user';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pinnedLeads, setPinnedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Define statuses that agents can move leads to
  const agentAllowedStatuses = [
    'assigned', 
    'no_answer', 
    'follow_up',
    'booked',
    'done',
    'miss/RS',
    'unqualified',
    'give_up', 
    'blacklisted'
  ];

  // Function to show notifications
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    // Auto-dismiss after 3 seconds
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const loadLeads = async () => {
      try {
        setLoading(true);
        const result = await fetchLeads();
        if (result.success && result.leads) {
          setLeads(result.leads);
        } else {
          throw new Error('Failed to load leads');
        }

        const pinnedResult = await getPinnedLeads();
        if (pinnedResult.success && pinnedResult.pinnedLeads) {
          const pinnedLeadIds = pinnedResult.pinnedLeads.map(p => p.lead_id);
          const pinnedLeadsData = result.leads.filter(lead => pinnedLeadIds.includes(lead.id));
          setPinnedLeads(pinnedLeadsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Fetch user roles
    const fetchRole = async () => {
      try {
        const { roles } = await fetchUserData();
        console.log('Roles:', roles);
        if (roles && roles.length > 0) {
          // Convert to our UserRole type safely
          const roleName = roles[0]?.roleName ?? 'user';
          setUserRole(roleName as UserRole);
          // console.log('User role set to:', roleName);
        }
      } catch (e) {
        console.error('Error fetching user role:', e);
        setUserRole('user');
      }
    };

    // Execute functions
    void loadLeads();
    void fetchRole();
  }, []);

  useEffect(() => {
    const loadAgentStatus = async () => {
      // console.log('Loading agent status for user:', userId, userRole);
      if (!userId || userRole !== 'agent') return;
      
      try {
        // Normally you would check if the agent is already checked in for today
        // This is a placeholder - implement the actual check on your server
        setIsCheckedIn(false); // Default to not checked in
      } catch (error) {
        console.error("Error checking agent status:", error);
      }
    };

    const loadAssignmentPreview = async () => {
      // console.log('Loading assignment preview for user:', userId, userRole);
      if (!userId || userRole !== 'admin') return;
      
      try {
        setIsLoadingPreview(true);
        const result = await getAssignmentPreview();
        console.log('Assignment preview result:', result);
        if (result.success) {
          setAssignmentPreview(result.preview as { agentId: string; agentName: string; leadCount: number }[]);
          setAssignmentStats({
            totalAgents: result.totalAgents,
            totalLeads: result.totalLeads
          });
        }
      } catch (error) {
        console.error("Error loading assignment preview:", error);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    void loadAgentStatus();
    void loadAssignmentPreview();
  }, [userId, userRole]);

  useEffect(() => {
    const loadLeadTags = async () => {
      const tagPromises = leads.map(async (lead) => {
        const result = await getLeadTag(lead.id);
        if (result.success && result.tag) {
          return [lead.id, { id: result.tag.id, name: result.tag.name }] as const;
        }
        return null;
      });

      const tagResults = await Promise.all(tagPromises);
      const tagsMap = Object.fromEntries(
        tagResults.filter((result): result is readonly [number, { id: number, name: string }] => result !== null)
      );
      setLeadTags(tagsMap);
    };

    void loadLeadTags();
  }, [leads]);

  const handlePopulateLeads = async () => {
    try {
      setLoading(true);
      const result = await populateLeads();
      
      if (result.success) {
        // Reload leads after populating
        const leadsResult = await fetchLeads();
        if (leadsResult.success) {
          setLeads(leadsResult.leads);
        }
        alert(result.message);
      } else {
        alert(result.message || "Failed to populate leads");
      }
    } catch (err) {
      console.error("Error populating leads:", err);
      alert("An error occurred while populating leads");
    } finally {
      setLoading(false);
    }
  };

  const handleLeadAction = async (action: string, leadId: number) => {
    try {
      switch (action) {
        case 'pin':
          const pinResult = await togglePinLead(leadId);
          if (pinResult.success && pinResult.action === 'pinned') {
            const leadToPin = leads.find(l => l.id === leadId);
            if (leadToPin && !pinnedLeads.some(p => p.id === leadId)) {
              setPinnedLeads([...pinnedLeads, leadToPin]);
            }
          }
          break;
        case 'unpin':
          const unpinResult = await togglePinLead(leadId);
          if (unpinResult.success && unpinResult.action === 'unpinned') {
            setPinnedLeads(pinnedLeads.filter(p => p.id !== leadId));
          }
          break;
        case 'whatsapp':
          // Use the example template (currently the only active one)
          await sendWhatsAppMessage(
            leads.find(l => l.id === leadId)?.phone_number ?? '', 
            'example_template',
            {},
            'whatsapp'
          );
          break;
        case 'schedule':
          // This case is now handled directly in the LeadActionButtons component
          // The button redirects to /dashboard/leads/[id]/appointment
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
          const newStatus = action.replace('move_to_', '');
          
          // Check if user is agent and trying to update to a disallowed status
          if (userRole === 'agent' && !agentAllowedStatuses.includes(newStatus)) {
            showNotification('Agents cannot set this status: ' + newStatus, 'error');
            return;
          }

          // Check if this status requires a tag
          if (['follow_up', 'miss/RS', 'give_up', 'blacklisted', 'done'].includes(newStatus)) {
            setPendingStatusChange({ leadId, newStatus });
            setIsTagModalOpen(true);
            return;
          }
          
          // For statuses that don't require tags, proceed with the update
          await updateLeadStatus(leadId, newStatus);
          await removeLeadTag(leadId); // Remove any existing tag
          
          // Update local state
          const updatedLeads = leads.map(lead => 
            lead.id === leadId ? { ...lead, status: newStatus } : lead
          );
          setLeads(updatedLeads);
          
          // Update pinnedLeads if needed
          if (pinnedLeads.some(p => p.id === leadId)) {
            setPinnedLeads(pinnedLeads.map(lead => 
              lead.id === leadId ? { ...lead, status: newStatus } : lead
            ));
          }
          break;
        case 'assign':
          const leadToAssign = leads.find(l => l.id === leadId);
          if (leadToAssign) {
            setSelectedLead(leadToAssign);
            setIsAssignModalOpen(true);
          }
          break;
        default:
          console.log('Unknown action:', action);
      }
    } catch (error) {
      console.error('Error handling lead action:', error);
      showNotification('Failed to perform action', 'error');
    }
  };

  // Define visible columns based on role
  const allStatuses = [
    { id: 'new', name: 'New', color: 'bg-blue-100 text-blue-800' },
    { id: 'assigned', name: 'Assigned', color: 'bg-cyan-100 text-cyan-800' },
    { id: 'no_answer', name: 'No Answer', color: 'bg-gray-100 text-gray-800' },
    { id: 'follow_up', name: 'Follow Up', color: 'bg-indigo-100 text-indigo-800' },
    { id: 'done', name: 'Done', color: 'bg-emerald-100 text-emerald-800' },
    { id: 'miss/RS', name: 'Miss/RS', color: 'bg-pink-100 text-pink-800' },
    { id: 'booked', name: 'Booked', color: 'bg-green-100 text-green-800' },
    { id: 'unqualified', name: 'Unqualified', color: 'bg-orange-100 text-orange-800' },
    { id: 'give_up', name: 'Give Up', color: 'bg-red-100 text-red-800' },
    { id: 'blacklisted', name: 'Blacklisted', color: 'bg-black text-white' },
  ];
  
  // Define statuses that agents should see in Kanban view
  const agentVisibleColumns = [
    'assigned', 
    'no_answer', 
    'follow_up',
    'booked',
    'done',
    'miss/RS',
    'unqualified',
    'give_up', 
    'blacklisted'
  ];
  
  // Filter visibleStatuses based on user role
  const visibleStatuses = userRole === 'agent'
    ? allStatuses.filter(col => agentVisibleColumns.includes(col.id))
    : allStatuses;

  // Filter leads for agent
  const visibleLeads = userRole === 'agent'
    ? leads.filter(lead => lead.assigned_to === userId)
    : leads;

  console.log('Visible statuses for role', userRole, ':', visibleStatuses.map(s => s.id));
  console.log('User ID:', userId);
  console.log('Filtering leads:', userRole === 'agent' ? 'Yes (agent)' : 'No (admin)');
  console.log('Visible leads count:', visibleLeads.length, 'out of', leads.length);

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
        
        // Refresh the leads and preview
        const leadsResult = await fetchLeads();
        if (leadsResult.success) {
          setLeads(leadsResult.leads);
          
          // Also update pinnedLeads with fresh data
          const pinnedResult = await getPinnedLeads();
          if (pinnedResult.success && pinnedResult.pinnedLeads) {
            const pinnedLeadIds = pinnedResult.pinnedLeads.map(p => p.lead_id);
            const pinnedLeadsData = leadsResult.leads.filter(lead => pinnedLeadIds.includes(lead.id));
            setPinnedLeads(pinnedLeadsData);
          }
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

  const handleTagConfirm = async (tagId: number) => {
    if (!pendingStatusChange || !userId) return;

    try {
      // Update the lead status
      const statusResult = await updateLeadStatus(pendingStatusChange.leadId, pendingStatusChange.newStatus);
      if (!statusResult.success) {
        throw new Error('Failed to update status');
      }
      
      // Update the tag
      const result = await updateLeadTag(pendingStatusChange.leadId, tagId, userId);
      
      if (!result.success) {
        throw new Error('Failed to update tag');
      }

      // Update local state
      const updatedLeads = leads.map(lead => 
        lead.id === pendingStatusChange.leadId 
          ? { ...lead, status: pendingStatusChange.newStatus } 
          : lead
      );
      setLeads(updatedLeads);
      
      // Update pinnedLeads if needed
      if (pinnedLeads.some(p => p.id === pendingStatusChange.leadId)) {
        setPinnedLeads(pinnedLeads.map(lead => 
          lead.id === pendingStatusChange.leadId 
            ? { ...lead, status: pendingStatusChange.newStatus } 
            : lead
        ));
      }

      // Refresh the tag for this lead
      const tagResult = await getLeadTag(pendingStatusChange.leadId);
      if (tagResult.success && tagResult.tag !== null) {
        setLeadTags(prev => ({
          ...prev,
          [pendingStatusChange.leadId]: { 
            id: tagResult.tag?.id ?? 0, 
            name: tagResult.tag?.name ?? '' 
          }
        }));
      }

      showNotification('Status and tag updated successfully', 'success');
    } catch (error) {
      console.error('Error updating status and tag:', error);
      showNotification('Failed to update status and tag', 'error');
    } finally {
      setIsTagModalOpen(false);
      setPendingStatusChange(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error}</p>
        <button 
          onClick={() => router.refresh()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

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

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : activeTab === 'kanban' ? (
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {/* Pinned column */}
          <div
            className="flex-none w-80 bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500"
          >
            <h3 className="font-semibold mb-4 flex items-center">
              <BookmarkIcon className="h-5 w-5 mr-2 text-blue-500" />
              Pinned
            </h3>
            <div className="space-y-4">
              {pinnedLeads.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No pinned leads</p>
              ) : (
                pinnedLeads.map((lead) => {
                  const statusInfo = visibleStatuses.find(s => s.id === lead.status) ?? {
                    id: 'new',
                    name: 'New',
                    color: 'bg-blue-100 text-blue-800'
                  };
                  return (
                    <LeadCard
                      key={`pinned-${lead.id}`}
                      lead={lead}
                      statusInfo={statusInfo}
                      onAction={handleLeadAction}
                      isPinned={true}
                      onView={handleViewLead}
                      tag={leadTags[lead.id]}
                    />
                  );
                })
              )}
            </div>
          </div>
          
          {/* Status columns */}
          {visibleStatuses.map((status) => (
            <div
              key={status.id}
              className="flex-none w-80 bg-gray-50 rounded-lg p-4"
            >
              <h3 className="font-semibold mb-4">{status.name}</h3>
              <div className="space-y-4">
                {visibleLeads
                  .filter((lead) => lead.status === status.id)
                  .map((lead) => {
                    const statusInfo: StatusInfo = {
                      id: status.id,
                      name: status.name,
                      color: status.color
                    };
                    return (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        statusInfo={statusInfo}
                        onAction={handleLeadAction}
                        isPinned={pinnedLeads.some(p => p.id === lead.id)}
                        onView={handleViewLead}
                        tag={leadTags[lead.id]}
                      />
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getCurrentLeads().map((lead) => {
            const statusInfo = visibleStatuses.find(s => s.id === lead.status) ?? {
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
                tag={leadTags[lead.id]}
              />
            );
          })}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center border-b p-4">
              <h2 className="text-xl font-bold">Lead Details</h2>
              <button 
                onClick={() => setSelectedLead(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                  <div className="space-y-3">
                    <p className="text-gray-700">
                      <span className="font-medium">Name:</span> {selectedLead.full_name}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Phone:</span> {selectedLead.phone_number}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Email:</span> {selectedLead.email ?? 'N/A'}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Status:</span> 
                      <span className={`ml-2 px-2 py-1 rounded-full ${getStatusColor(selectedLead.status)}`}>
                        {selectedLead.status}
                      </span>
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Lead Information</h3>
                  <div className="space-y-3">
                    <p className="text-gray-700">
                      <span className="font-medium">Source:</span> {selectedLead.source ?? 'N/A'}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Type:</span> {selectedLead.lead_type}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Created:</span> {new Date(selectedLead.created_at).toLocaleString()}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Assigned To:</span> {selectedLead.assigned_to ?? 'Unassigned'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Actions</h3>
                <div className="flex space-x-4">
                  <button 
                    onClick={() => handleLeadAction(pinnedLeads.some(p => p.id === selectedLead.id) ? 'unpin' : 'pin', selectedLead.id)}
                    className="flex items-center px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <BookmarkIcon className="h-5 w-5 mr-2" />
                    {pinnedLeads.some(p => p.id === selectedLead.id) ? 'Unpin Lead' : 'Pin Lead'}
                  </button>
                  <button 
                    onClick={() => {
                      setIsWhatsAppModalOpen(true);
                      setSelectedLead(null);
                    }}
                    className="flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200"
                  >
                    <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                    Send WhatsApp
                  </button>
                  
                  {userRole === 'admin' && (
                    <button 
                      onClick={() => setIsAssignModalOpen(true)}
                      className="flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
                    >
                      <UserPlusIcon className="h-5 w-5 mr-2" />
                      Assign to Agent
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Comments</h3>
                <LazyComment leadId={selectedLead.id} />
              </div>
            </div>
          </div>
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
          void fetchLeads().then(result => {
            if (result.success && result.leads) {
              setLeads(result.leads);
            }
          });
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

      {/* Add the TagSelectionModal */}
      <TagSelectionModal
        isOpen={isTagModalOpen}
        onClose={() => {
          setIsTagModalOpen(false);
          setPendingStatusChange(null);
        }}
        onConfirm={handleTagConfirm}
        status={pendingStatusChange?.newStatus ?? ''}
      />
    </div>
  );
}