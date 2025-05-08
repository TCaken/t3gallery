"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  ChatBubbleLeftIcon
} from "@heroicons/react/24/outline";
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

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'details';
  const leadId = parseInt(params.id);
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
    'P', 
    'PRS', 
    'R', 
    'miss/RS', 
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => router.back()} className="flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back to Leads
        </button>
        {isAdmin && !editMode && (
          <button 
            onClick={() => setEditMode(true)}
            className="flex items-center bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            <PencilIcon className="h-5 w-5 mr-2" /> 
            Edit Lead
          </button>
        )}
        {editMode && (
          <div className="flex space-x-3">
            <button 
              onClick={() => setEditMode(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
            <button 
              onClick={handleEditSave}
              disabled={saving}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
          {error}
          <button 
            onClick={() => setError(null)} 
            className="ml-2 text-red-500 font-bold"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {!editMode ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">
                {lead.full_name}
              </h1>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(lead.status)}`}>
                  {lead.status}
                </span>
                {lead.eligibility_status && (
                  <span className={`px-3 py-1 rounded-full text-sm ${getEligibilityColor(lead.eligibility_status)}`}>
                    {lead.eligibility_status}
                  </span>
                )}
                {(isAdmin || isAgent) && (
                  <div className="relative ml-3">
                    <select
                      className="p-2 border rounded bg-white"
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Phone: {lead.phone_number}</p>
                <p className="text-gray-600">Email: {lead.email ?? 'N/A'}</p>
                <p className="text-gray-600">Nationality: {lead.nationality ?? 'N/A'}</p>
                <p className="text-gray-600">Amount: {lead.amount ?? 'N/A'}</p>
                {lead.employment_status && (
                  <p className="text-gray-600">Employment: {lead.employment_status}</p>
                )}
                {lead.loan_purpose && (
                  <p className="text-gray-600">Purpose: {lead.loan_purpose}</p>
                )}
                {lead.existing_loans && (
                  <p className="text-gray-600">Existing Loans: {lead.existing_loans}</p>
                )}
                <p className="text-gray-600">Assigned To: {lead.assigned_to ?? 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-gray-600">Source: {lead.source ?? 'N/A'}</p>
                <p className="text-gray-600">Type: {lead.lead_type}</p>
                <p className="text-gray-600">
                  Created: {new Date(lead.created_at).toLocaleDateString()}
                </p>
                {lead.eligibility_notes && (
                  <p className="text-gray-600">
                    Eligibility Notes: {lead.eligibility_notes}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex space-x-3">
              <button
                onClick={handleNavigateToAppointment}
                className="flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
              >
                <CalendarIcon className="h-5 w-5 mr-2" />
                {hasAppointment ? 'View Appointment' : 'Schedule Appointment'}
              </button>
            </div>
          </>
        ) : (
          // Edit Mode - Only for Admins
          <div>
            <h2 className="text-xl font-semibold mb-4">Edit Lead Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={editedLead?.full_name ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    name="phone_number"
                    value={editedLead?.phone_number ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editedLead?.email ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    name="nationality"
                    value={editedLead?.nationality ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Amount</label>
                  <input
                    type="text"
                    name="amount"
                    value={editedLead?.amount ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
              <div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Employment Status</label>
                  <input
                    type="text"
                    name="employment_status"
                    value={editedLead?.employment_status ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Loan Purpose</label>
                  <input
                    type="text"
                    name="loan_purpose"
                    value={editedLead?.loan_purpose ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Existing Loans</label>
                  <input
                    type="text"
                    name="existing_loans"
                    value={editedLead?.existing_loans ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={editedLead?.status ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  >
                    {validStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Source</label>
                  <input
                    type="text"
                    name="source"
                    value={editedLead?.source ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Lead Type</label>
                  <input
                    type="text"
                    name="lead_type"
                    value={editedLead?.lead_type ?? ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Combined Notes/Comments Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <ChatBubbleLeftIcon className="h-6 w-6 mr-2" />
          Notes & Comments
        </h2>
        <form onSubmit={handleAddNote} className="mb-4">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full p-2 border rounded-lg mb-2"
            placeholder="Add a note or comment..."
            rows={3}
          />
          <button
            type="submit"
            disabled={addingNote || !newNote.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {addingNote ? 'Adding...' : 'Add Note'}
          </button>
        </form>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-gray-500 italic text-center py-4">No notes or comments yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border-b pb-4">
                <p className="text-gray-800">{note.content}</p>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500">
                    {new Date(note.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {note.created_by ?? 'Unknown'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 