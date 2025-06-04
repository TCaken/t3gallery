"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchLeadById, addLeadNote, fetchLeadNotes, updateLeadStatus, updateLeadDetails } from "~/app/_actions/leadActions";
import { type InferSelectModel } from "drizzle-orm";
import { leads, lead_notes } from "~/server/db/schema";
import { 
  ArrowLeftIcon, 
  PhoneIcon, 
  EnvelopeIcon,
  PencilIcon,
  DocumentTextIcon,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
  UserIcon
} from "@heroicons/react/24/solid";
import { checkExistingAppointment } from "~/app/_actions/appointmentAction";
import { getLeadComments, addLeadComment } from '~/app/_actions/commentActions';
import { useAuth } from '@clerk/nextjs';
import { fetchUserData } from '~/app/_actions/userActions';

type Lead = InferSelectModel<typeof leads>;
type LeadNote = InferSelectModel<typeof lead_notes>;

interface Comment {
  id: number;
  content: string;
  createdAt: Date;
  createdBy: string;
}

interface CommentResponse {
  success: boolean;
  comments?: Comment[];
  message?: string;
}

interface LeadResponse {
  success: boolean;
  lead?: Lead;
  message?: string;
}

interface Appointment {
  id: number;
  lead_id?: number;
  agent_id?: string;
  status?: string;
  notes?: string | null;
  start_datetime?: Date;
  end_datetime?: Date;
  created_at?: Date;
  updated_at?: Date | null;
  created_by?: string | null;
  updated_by?: string | null;
  [key: string]: unknown;
}

interface PageProps {
  params: {
    id: string;
  };
}


export default function LeadDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const leadId = parseInt(id);
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedLead, setEditedLead] = useState<Partial<Lead> | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasAppointment, setHasAppointment] = useState(false);
  const [existingAppointment, setExistingAppointment] = useState<Appointment | null>(null);
  const [checkingAppointment, setCheckingAppointment] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { userId } = useAuth();

  // Define statuses that agents can move leads to
  const agentAllowedStatuses = [
    'assigned', 
    'no_answer', 
    'follow_up',
    'booked',
    'miss/RS',
    'give_up', 
    'blacklisted'
  ];

  // Define which statuses are visible to agents in the UI
  const agentVisibleStatuses = [
    'assigned', 
    'no_answer', 
    'follow_up',
    'booked',
    'miss/RS',
    'give_up', 
    'blacklisted'
  ];

  // All valid statuses (for admins)
  const validStatuses = [
    'new', 
    'assigned', 
    'no_answer', 
    'follow_up', 
    'missed/RS', 
    'booked', 
    'unqualified', 
    'give_up', 
    'blacklisted'
  ];

  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const { roles } = await fetchUserData();
        if (roles && roles.length > 0) {
          setUserRole(roles[0]?.roleName ?? null);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    void loadUserRole();
  }, []);

  useEffect(() => {
    const loadLeadData = async () => {
      try {
        setLoading(true);
        const leadResponse = await fetchLeadById(leadId);
        if (!leadResponse.success || !leadResponse.lead) {
          throw new Error(leadResponse.message ?? 'Failed to load lead');
        }
        setLead(leadResponse.lead);
        setEditedLead(leadResponse.lead);

        const notesResponse = await fetchLeadNotes(leadId);
        if (notesResponse.success) {
          setNotes(notesResponse.notes ?? []);
        }

        // Check if lead has an existing appointment
        const appointmentCheck = await checkExistingAppointment(leadId);
        setHasAppointment(appointmentCheck.hasAppointment);
        if (appointmentCheck.appointment) {
          setExistingAppointment(appointmentCheck.appointment as Appointment);
        }
        setCheckingAppointment(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    void loadLeadData();
  }, [leadId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setAddingNote(true);
    try {
      const result = await addLeadNote(leadId, newNote);
      if (result.success) {
        setNotes((prev) => [result.note!, ...prev]);
        setNewNote("");
      } else {
        throw new Error(result.message ?? 'Failed to add note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!newStatus || newStatus === lead?.status) {
      return;
    }

    // Check if user is agent and trying to update to a disallowed status
    if (userRole === 'agent' && !agentAllowedStatuses.includes(newStatus)) {
      setError('Agents can only update to certain statuses');
      return;
    }
    
    try {
      const result = await updateLeadStatus(leadId, newStatus);
      if (result.success && lead) {
        setLead({...lead, status: newStatus} as Lead);
      } else {
        throw new Error(result.error ?? 'Failed to update status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating the status');
    }
  };

  const handleNavigateToAppointment = () => {
    if (hasAppointment && existingAppointment?.id) {
      router.push(`/dashboard/appointments/${existingAppointment.id}`);
    } else {
      router.push(`/dashboard/leads/${leadId}/appointment`);
    }
  };

  const handleEditSave = async () => {
    if (!editedLead || !lead) return;
    
    setSaving(true);
    try {
      const result = await updateLeadDetails(leadId, editedLead);
      if (result.success && result.lead) {
        setLead(result.lead as Lead);
        setEditMode(false);
      } else {
        throw new Error(result.message ?? 'Failed to save changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editedLead) {
      setEditedLead({...editedLead, [name]: value});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error ?? 'Lead not found'}</div>
      </div>
    );
  }

  // Get status color
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      assigned: "bg-cyan-100 text-cyan-800",
      no_answer: "bg-gray-100 text-gray-800",
      follow_up: "bg-indigo-100 text-indigo-800",
      P: "bg-emerald-100 text-emerald-800",
      PRS: "bg-teal-100 text-teal-800",
      R: "bg-violet-100 text-violet-800",
      "miss/RS": "bg-pink-100 text-pink-800",
      booked: "bg-green-100 text-green-800",
      unqualified: "bg-orange-100 text-orange-800",
      give_up: "bg-red-100 text-red-800",
      blacklisted: "bg-black text-white",
    };
    return statusMap[status] ?? "bg-gray-100 text-gray-800";
  };

  const getEligibilityColor = (status: string) => {
    const colorMap: Record<string, string> = {
      eligible: "bg-green-100 text-green-800",
      ineligible: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
      duplicate: "bg-gray-100 text-gray-800",
      error: "bg-red-100 text-red-800"
    };
    return colorMap[status] ?? "bg-gray-100 text-gray-800";
  };

  const isAdmin = userRole === 'admin';
  const isAgent = userRole === 'agent';

  // Get the list of statuses available to the current user based on role
  const availableStatuses = isAdmin ? validStatuses : agentVisibleStatuses;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push(`/dashboard/leads`)} 
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Lead Details</h1>
          </div>
          {isAdmin && !editMode && (
            <button 
              onClick={() => setEditMode(true)}
              className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PencilIcon className="h-5 w-5 mr-2" /> 
              Edit Lead
            </button>
          )}
          {editMode && (
            <div className="flex space-x-3">
              <button 
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleEditSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead Information Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6">
                {!editMode ? (
                  <>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          {lead.full_name}
                        </h2>
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(lead.status)}`}>
                            {lead.status}
                          </span>
                          {lead.eligibility_status && (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEligibilityColor(lead.eligibility_status)}`}>
                              {lead.eligibility_status}
                            </span>
                          )}
                        </div>
                      </div>
                      {(isAdmin || isAgent) && (
                        <div className="relative">
                          <select
                            className="p-2 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={lead.status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                          >
                            {availableStatuses.map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <PhoneIcon className="h-5 w-5 text-gray-400" />
                          <span className="text-gray-600">{lead.phone_number}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                          <span className="text-gray-600">{lead.email ?? 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                          <span className="text-gray-600">Amount: {lead.amount ?? 'N/A'}</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {lead.employment_status && (
                          <div className="flex items-center space-x-3">
                            <UserIcon className="h-5 w-5 text-gray-400" />
                            <span className="text-gray-600">Employment: {lead.employment_status}</span>
                          </div>
                        )}
                        {lead.loan_purpose && (
                          <div className="flex items-center space-x-3">
                            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                            <span className="text-gray-600">Purpose: {lead.loan_purpose}</span>
                          </div>
                        )}
                        {lead.existing_loans && (
                          <div className="flex items-center space-x-3">
                            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                            <span className="text-gray-600">Existing Loans: {lead.existing_loans}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-3">
                          <UserIcon className="h-5 w-5 text-gray-400" />
                          <span className="text-gray-600">Assigned To: {lead.assigned_to ?? 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>

                    {lead.eligibility_notes && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Eligibility Notes</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-gray-700">{lead.eligibility_notes}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Source</p>
                          <p className="text-gray-900">{lead.source ?? 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Type</p>
                          <p className="text-gray-900">{lead.lead_type}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Created</p>
                          <p className="text-gray-900">{new Date(lead.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <button
                        onClick={handleNavigateToAppointment}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        <CalendarIcon className="h-5 w-5 mr-2" />
                        {hasAppointment ? 'View Appointment' : 'Schedule Appointment'}
                      </button>
                    </div>
                  </>
                ) : (
                  // Edit Mode Form
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-900">Edit Lead Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                          <input
                            type="text"
                            name="full_name"
                            value={editedLead?.full_name ?? ''}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                          <input
                            type="text"
                            name="phone_number"
                            value={editedLead?.phone_number ?? ''}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            name="email"
                            value={editedLead?.email ?? ''}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                          <input
                            type="text"
                            name="amount"
                            value={editedLead?.amount ?? ''}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
                          <input
                            type="text"
                            name="employment_status"
                            value={editedLead?.employment_status ?? ''}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Loan Purpose</label>
                          <input
                            type="text"
                            name="loan_purpose"
                            value={editedLead?.loan_purpose ?? ''}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Existing Loans</label>
                          <input
                            type="text"
                            name="existing_loans"
                            value={editedLead?.existing_loans ?? ''}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            name="status"
                            value={editedLead?.status ?? ''}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {validStatuses.map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                        <input
                          type="text"
                          name="source"
                          value={editedLead?.source ?? ''}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lead Type</label>
                        <input
                          type="text"
                          name="lead_type"
                          value={editedLead?.lead_type ?? ''}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    {lead.eligibility_notes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Eligibility Notes</label>
                        <textarea
                          name="eligibility_notes"
                          value={editedLead?.eligibility_notes ?? ''}
                          onChange={handleInputChange}
                          rows={3}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes & Comments Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <ChatBubbleLeftIcon className="h-6 w-6 mr-2 text-gray-400" />
                  Notes & Comments
                </h2>
                <form onSubmit={handleAddNote} className="mb-6">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add a note or comment..."
                    rows={3}
                  />
                  <button
                    type="submit"
                    disabled={addingNote || !newNote.trim()}
                    className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {addingNote ? 'Adding...' : 'Add Note'}
                  </button>
                </form>
                <div className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {notes.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-4">No notes or comments yet</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-800">{note.content}</p>
                        <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                          <span>{note.created_by ?? 'Unknown'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 