"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchLeadById, addLeadNote, fetchLeadNotes, updateLeadStatus } from "~/app/_actions/leadActions";
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
  ClockIcon
} from "@heroicons/react/24/outline";
import { checkExistingAppointment } from "~/app/_actions/appointmentAction";

type Lead = InferSelectModel<typeof leads>;
type LeadNote = InferSelectModel<typeof lead_notes>;

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const leadId = parseInt(params.id);
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [changeStatus, setChangeStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [hasAppointment, setHasAppointment] = useState(false);
  const [existingAppointment, setExistingAppointment] = useState<any>(null);
  const [checkingAppointment, setCheckingAppointment] = useState(true);

  const validStatuses = ['new', 'unqualified', 'give_up', 'blacklisted'];

  useEffect(() => {
    const loadLead = async () => {
      try {
        setLoading(true);
        const result = await fetchLeadById(leadId);
        if (result.success) {
          setLead(result.lead);
          // Load notes
          const notesResult = await fetchLeadNotes(leadId);
          if (notesResult.success) {
            setNotes(notesResult.notes);
          }

          // Check if lead has an existing appointment
          const appointmentCheck = await checkExistingAppointment(leadId);
          setHasAppointment(appointmentCheck.hasAppointment);
          setExistingAppointment(appointmentCheck.appointment);
          setCheckingAppointment(false);
        } else {
          setError(result.message || "Failed to load lead");
        }
      } catch (err) {
        console.error("Error loading lead:", err);
        setError("An error occurred while loading the lead");
      } finally {
        setLoading(false);
      }
    };

    void loadLead();
  }, [leadId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setAddingNote(true);
    try {
      const result = await addLeadNote(leadId, newNote);
      if (result.success) {
        setNotes((prev) => [result.note, ...prev]);
        setNewNote("");
      } else {
        alert(result.message || "Failed to add note");
      }
    } catch (error) {
      console.error("Error adding note:", error);
      alert("An error occurred while adding the note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === lead?.status) {
      setChangeStatus(false);
      return;
    }
    
    setUpdatingStatus(true);
    try {
      const result = await updateLeadStatus(leadId, newStatus);
      if (result.success) {
        setLead({...lead, status: newStatus});
        setChangeStatus(false);
      } else {
        alert(result.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("An error occurred while updating the status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleNavigateToAppointment = () => {
    if (hasAppointment && existingAppointment) {
      router.push(`/dashboard/appointments/${existingAppointment.id}`);
    } else {
      router.push(`/dashboard/leads/${leadId}/appointment`);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error || !lead) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error || "Lead not found"}</p>
        <button
          onClick={() => router.push("/dashboard/leads")}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  // Get status color
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      unqualified: "bg-orange-100 text-orange-800",
      give_up: "bg-red-100 text-red-800",
      blacklisted: "bg-black text-white",
    };
    return statusMap[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with back button */}
      <div className="mb-6 flex items-center">
        <button
          onClick={() => router.push("/dashboard/leads")}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Lead Details</h1>
      </div>

      {/* Lead info card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {lead.first_name} {lead.last_name}
          </h2>
          
          {changeStatus ? (
            <div className="flex items-center">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                disabled={updatingStatus}
                className="mr-2 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select status</option>
                {validStatuses.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
                  </option>
                ))}
              </select>
              <button
                onClick={handleStatusChange}
                disabled={updatingStatus || !newStatus}
                className="p-1 text-white bg-green-500 rounded-full hover:bg-green-600 disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <span 
              className={`px-3 py-1 rounded-full text-sm ${getStatusColor(lead.status)} cursor-pointer hover:opacity-80`}
              onClick={() => {
                setNewStatus(lead.status);
                setChangeStatus(true);
              }}
              title="Click to change status"
            >
              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1).replace("_", " ")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Contact Information</h3>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
                <span>{lead.phone_number}</span>
              </div>
              {lead.email && (
                <div className="flex items-center">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span>{lead.email}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Lead Information</h3>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Type:</span>
                <span>{lead.lead_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Source:</span>
                <span>{lead.source || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created:</span>
                <span>{new Date(lead.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Appointment Section */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {checkingAppointment ? (
              <p className="text-sm text-gray-500">Checking appointment status...</p>
            ) : hasAppointment ? (
              <div className="flex items-center">
                <CalendarIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm text-green-600 font-medium">Has upcoming appointment</span>
              </div>
            ) : (
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-500">No appointment scheduled</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/dashboard/leads/${leadId}/edit`)}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <PencilIcon className="h-4 w-4 mr-1" />
              Edit Lead
            </button>
            
            <button
              onClick={handleNavigateToAppointment}
              className={`flex items-center ${hasAppointment ? 'text-green-600 hover:text-green-800' : 'text-blue-600 hover:text-blue-800'}`}
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              {hasAppointment ? 'View Appointment' : 'Schedule Appointment'}
            </button>
          </div>
        </div>
      </div>

      {/* Notes section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <DocumentTextIcon className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold">Notes</h2>
        </div>

        {/* Add note form */}
        <form onSubmit={handleAddNote} className="mb-6">
          <div className="mb-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this lead..."
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            ></textarea>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingNote || !newNote.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {addingNote ? "Adding..." : "Add Note"}
            </button>
          </div>
        </form>

        {/* Notes list */}
        <div className="space-y-4">
          {notes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No notes yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border-b pb-4">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>
                    {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 