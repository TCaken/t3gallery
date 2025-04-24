"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PlusIcon, 
  FunnelIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  BookmarkIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  ArrowUpTrayIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import LeadCard  from '~/app/_components/LeadCard';
import { hasPermission } from '~/server/rbac/queries';
import { fetchLeads, populateLeads } from '~/app/_actions/leadActions';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from "~/server/db/schema";

// Infer Lead type from the schema
type Lead = InferSelectModel<typeof leads>;

// Status columns for the Kanban board (updated to match your enum)
const LEAD_STATUSES = [
  { id: 'new', name: 'New', color: 'bg-blue-100 text-blue-800' },
  { id: 'open', name: 'Open', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'contacted', name: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'no_answer', name: 'No Answer', color: 'bg-gray-100 text-gray-800' },
  { id: 'follow_up', name: 'Follow Up', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'booked', name: 'Booked', color: 'bg-green-100 text-green-800' },
  { id: 'unqualified', name: 'Unqualified', color: 'bg-orange-100 text-orange-800' },
  { id: 'give_up', name: 'Give Up', color: 'bg-red-100 text-red-800' },
  { id: 'blacklisted', name: 'Blacklisted', color: 'bg-black text-white' },
];

// Tab options
const TABS = [
  { id: 'kanban', name: 'Kanban Board', icon: <FunnelIcon className="h-5 w-5" /> },
  { id: 'all', name: 'All Leads', icon: <UserGroupIcon className="h-5 w-5" /> },
  { id: 'my', name: 'My Leads', icon: <UserGroupIcon className="h-5 w-5" /> },
  { id: 'pinned', name: 'Pinned Leads', icon: <BookmarkIcon className="h-5 w-5" /> },
  { id: 'recent', name: 'Recent Activity', icon: <ClockIcon className="h-5 w-5" /> },
];

// Add this type for the WhatsApp request
type WhatsAppRequest = {
  workspaces: string;
  channels: string;
  projectId: string;
  identifierValue: string;
  parameters: Array<{
    type: string;
    key: string;
    value: string;
  }>;
};

// Add this function after the existing imports
const sendWhatsAppMessage = async (phone: string) => {
  console.log('Attempting to send WhatsApp message');
  console.log('Phone number:', phone);
  
  try {
    const whatsappData: WhatsAppRequest = {
      workspaces: "976e3394-ae10-4b32-9a23-8ecf78da9fe7",
      channels: "8d8c5cd0-e776-5d80-b223-435bd0536927",
      projectId: "ec4f6834-806c-47eb-838b-bc72004f8cca",
      identifierValue: phone.startsWith('+') ? phone : `+${phone}`,
      parameters: [
        {
          type: "string",
          key: "Date",
          value: "2025-04-24"
        },
        {
          type: "string",
          key: "Account_ID",
          value: "222972"
        },
        {
          type: "string",
          key: "Loan_Balance",
          value: "615.24"
        }
      ]
    };

    console.log('WhatsApp request data:', JSON.stringify(whatsappData, null, 2));

    // Changed to use our local API route instead of calling the external API directly
    const response = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whatsappData)
    });

    console.log('API Response status:', response.status);
    const data = await response.json();
    console.log('API Response data:', data);
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to send WhatsApp message');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingLead, setDraggingLead] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const loadLeads = async () => {
    try {
      setLoading(true);
      const result = await fetchLeads();
      if (result.success) {
        setLeads(result.leads);
      } else {
        setError("Failed to load leads");
      }
    } catch (err) {
      console.error("Error loading leads:", err);
      setError("An error occurred while loading leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
  }, []);

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

  function handleDragStart(leadId: number) {
    setDraggingLead(leadId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, status: string) {
    e.preventDefault();
    if (draggingLead === null) return;

    // Update lead status
    const updatedLeads = leads.map(lead => {
      if (lead.id === draggingLead) {
        return { ...lead, status };
      }
      return lead;
    });

    setLeads(updatedLeads);
    setDraggingLead(null);

    // In a real app, you would update the lead status in your database
    // Example: updateLeadStatus(draggingLead, status);
  }

  // Modify the handleLeadAction function to include WhatsApp messaging
  const handleLeadAction = async (action: string, leadId: number) => {
    console.log('Lead action triggered:', action);
    console.log('Lead ID:', leadId);
    
    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      console.log('Lead not found');
      return;
    }
    
    switch (action) {
      case 'view':
        // Navigate to lead detail page
        router.push(`/dashboard/leads/${leadId}`);
        break;
      case 'add_note':
        // Navigate to lead detail page with note section focused
        router.push(`/dashboard/leads/${leadId}?focus=notes`);
        break;
      case 'schedule_appointment':
        // Navigate to appointment scheduling page
        router.push(`/dashboard/leads/${leadId}/appointment`);
        break;
      case 'make_call':
        // Open call dialog or start call
        console.log('Calling lead', leadId);
        break;
      case 'send_message':
        // Open message compose dialog
        console.log('Messaging lead', leadId);
        break;
      case 'edit_lead':
        // Open edit form
        router.push(`/dashboard/leads/${leadId}/edit`);
        break;
      case 'assign_lead':
        // Open assign dialog
        console.log('Assigning lead', leadId);
        break;
      case 'pin_lead':
        // Toggle pin status
        console.log('Toggling pin for lead', leadId);
        break;
      case 'delete_lead':
        // Confirm and delete
        if (confirm(`Are you sure you want to delete lead ${lead.first_name} ${lead.last_name}?`)) {
          console.log('Deleting lead', leadId);
          // deleteLeadAPI(leadId).then(() => {
          //   setLeads(leads.filter(l => l.id !== leadId));
          // });
        }
        break;
      case 'send_whatsapp':
        console.log('Processing WhatsApp action');
        if (!lead.phone_number) {
          console.log('No phone number available');
          alert('No phone number available for this lead');
          return;
        }
        
        console.log('Sending WhatsApp message to:', lead.phone_number);
        const result = await sendWhatsAppMessage(lead.phone_number);
        console.log('WhatsApp send result:', result);
        
        if (result.success) {
          alert('WhatsApp message sent successfully!');
          
          if (lead.status === 'new') {
            console.log('Updating lead status from new to contacted');
            const updatedLeads = leads.map(l => 
              l.id === leadId ? { ...l, status: 'contacted' } : l
            );
            setLeads(updatedLeads);
          }
        } else {
          alert(`Failed to send WhatsApp message: ${result.error}`);
        }
        break;
      default:
        console.log(`Unknown action ${action} for lead ${leadId}`);
    }
  };

  // Filter tabs based on permissions
  const filteredTabs = TABS.filter(tab => {
    // Everyone can see the kanban board if they have view_leads permission
    // if (tab.id === 'kanban' && hasPermission('view_leads')) return true;
    
    // // Pinned leads require pin_leads permission
    // if (tab.id === 'pinned' && !hasPermission('pin_leads')) return false;
    
    return true;
  });

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

  // Check if user has permission to view leads
  // if (!hasPermission('view_leads')) {
  //   return (
  //     <div className="text-center py-10">
  //       <h2 className="text-xl font-semibold text-red-600">Access Denied</h2>
  //       <p className="mt-2">You don't have permission to view the leads page.</p>
  //     </div>
  //   );
  // }

  return (
    <div className="h-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Leads Management</h1>
        
        {/* {hasPermission('add_leads') && ( */}
          <div className="flex gap-2">
            <button 
              className="bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600"
              onClick={handlePopulateLeads}
            >
              <PlusIcon className="h-5 w-5" />
              <span>Populate Sample Leads</span>
          </button>
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
              onClick={() => router.push('/dashboard/leads/new')}
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add Lead</span>
            </button>
            <button 
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
              onClick={() => router.push('/dashboard/leads/import')}
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              <span>Import Leads</span>
            </button>
            <button 
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
              onClick={() => router.push('/dashboard/appointments')}
            >
              <CalendarIcon className="h-5 w-5" />
              <span>Appointments</span>
            </button>
            </div>
        {/* )} */}
          </div>
          
      {/* Tabs and Search */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div className="flex space-x-4">
              {filteredTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 flex items-center space-x-2 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.name}</span>
                    </button>
              ))}
            </div>
          
            <div className="mt-3 sm:mt-0 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board View */}
      {activeTab === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6 h-[calc(100vh-260px)]">
          {LEAD_STATUSES.map(status => {
            // Filter leads by status
            const statusLeads = leads.filter(lead => lead.status === status.id);
            
            return (
              <div 
                key={status.id}
                className="flex-shrink-0 w-80 bg-gray-50 rounded-lg shadow"
              >
                <div className="p-3 border-b bg-white rounded-t-lg flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-3 h-3 rounded-full ${status.color.split(' ')[0]}`}></span>
                    <h3 className="font-medium">{status.name}</h3>
                    <span className="text-gray-500 text-sm">
                      ({statusLeads.length})
                    </span>
                  </div>
                  <button className="text-gray-500 hover:text-gray-700">
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                  </button>
                </div>

                <div 
                  className="p-2 h-full overflow-y-auto"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status.id)}
                >
                  {statusLeads.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No leads in this status
                    </div>
                  ) : (
                    statusLeads.map(lead => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        statusInfo={status}
                        onAction={handleLeadAction}
                        onDragStart={() => handleDragStart(lead.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Other tab views would go here */}
      {activeTab !== 'kanban' && (
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4">{TABS.find(t => t.id === activeTab)?.name}</h2>
          
          {/* Placeholder content for other tabs */}
          <p className="text-gray-500">
            This tab view is under development. Please switch to Kanban view to manage leads.
          </p>
        </div>
      )}
      </div>
    );
  }