"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchLeadById, addLeadNote, fetchLeadNotes, updateLeadStatus, updateLeadDetails, deleteLead } from "~/app/_actions/leadActions";
import { getAppointmentsForLead, type EnhancedAppointment } from "~/app/_actions/appointmentAction";
import { type InferSelectModel } from "drizzle-orm";
import { leads, lead_notes, appointments } from "~/server/db/schema";
import { 
  ArrowLeftIcon, 
  PhoneIcon, 
  EnvelopeIcon,
  PencilIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  HomeIcon,
  BriefcaseIcon,
  BanknotesIcon,
  ChatBubbleLeftEllipsisIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  CheckIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useUserRole } from "../useUserRole";
import { format } from "date-fns";

type Lead = InferSelectModel<typeof leads>;
type LeadNote = InferSelectModel<typeof lead_notes> & {
  user_first_name?: string | null;
  user_last_name?: string | null;
};
type Appointment = EnhancedAppointment;

interface LeadResponse {
  success: boolean;
  lead?: Lead;
  message?: string;
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

// Status color configurations
const getStatusColor = (status: string | null) => {
  if (!status) return "bg-gray-100 text-gray-800 border-gray-200";
  
  const statusMap: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 border-blue-200",
    assigned: "bg-cyan-100 text-cyan-800 border-cyan-200",
    no_answer: "bg-gray-100 text-gray-800 border-gray-200",
    follow_up: "bg-indigo-100 text-indigo-800 border-indigo-200",
    booked: "bg-green-100 text-green-800 border-green-200",
    done: "bg-emerald-100 text-emerald-800 border-emerald-200",
    "missed/RS": "bg-pink-100 text-pink-800 border-pink-200",
    unqualified: "bg-orange-100 text-orange-800 border-orange-200",
    give_up: "bg-red-100 text-red-800 border-red-200",
    blacklisted: "bg-black text-white border-black",
    // Loan status colors
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200"
  };
  return statusMap[status] ?? "bg-gray-100 text-gray-800 border-gray-200";
};

const getAppointmentStatusColor = (status: string) => {
  const statusMap: Record<string, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>, colors: string }> = {
    upcoming: { icon: ClockIcon, colors: "bg-blue-50 text-blue-700 border-blue-200" },
    done: { icon: CheckCircleIcon, colors: "bg-green-50 text-green-700 border-green-200" },
    missed: { icon: ExclamationCircleIcon, colors: "bg-orange-50 text-orange-700 border-orange-200" },
    cancelled: { icon: XCircleIcon, colors: "bg-red-50 text-red-700 border-red-200" },
  };
  return statusMap[status] ?? { icon: ClockIcon, colors: "bg-gray-50 text-gray-700 border-gray-200" };
};

// Helper function to format values for display
const formatDisplayValue = (value: any, fallback: string = 'Not provided') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value.toString();
};

// Helper function to format checkbox group values
const formatCheckboxGroup = (value: string | null | undefined) => {
  if (!value) return 'None selected';
  return value.split(', ').filter(Boolean).join(', ');
};

export default function LeadDetailPage({ params }: PageProps) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const leadId = parseInt(unwrappedParams.id);
  const { userRole, hasRole } = useUserRole();
  
  // State management
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load lead data
        const leadResponse = await fetchLeadById(leadId);
        console.log('leadResponse', leadResponse);
        if (!leadResponse.success || !leadResponse.lead) {
          throw new Error(leadResponse.message ?? 'Failed to load lead');
        }
        setLead(leadResponse.lead as any); // Temporarily use any to handle the extended type

        // Load notes
        const notesResponse = await fetchLeadNotes(leadId);
        if (notesResponse.success) {
          setNotes(notesResponse.notes ?? []);
        }

        // Load appointments
        const appointmentsResponse = await getAppointmentsForLead(leadId);
        if (appointmentsResponse.success) {
          setAppointments(appointmentsResponse.appointments ?? []);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [leadId]);

  // Add note handler
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

  // Delete lead handler (admin only)
  const handleDeleteLead = async () => {
    if (!hasRole('admin')) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete this lead? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    setDeleting(true);
    try {
      const result = await deleteLead(leadId);
      if (result.success) {
        router.push('/dashboard/leads');
      } else {
        throw new Error(result.message ?? 'Failed to delete lead');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete lead');
    } finally {
      setDeleting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lead details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-medium">Error loading lead</p>
            <p className="text-red-600 mt-2">{error}</p>
            <button 
              onClick={() => router.push('/dashboard/leads')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No lead found
  if (!lead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Lead not found</p>
          <button 
            onClick={() => router.push('/dashboard/leads')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            {/* Left side - Back button and title */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/leads')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                <span>Back to Leads</span>
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{lead.full_name}</h1>
                <p className="text-sm text-gray-500">Lead ID: {lead.id}</p>
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/dashboard/leads/${lead.id}/edit`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit Lead
              </button>
              {hasRole('admin') && (
                <div className="relative">
                  <button
                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </button>
                  {showActionsDropdown && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                      <div className="py-1">
                        <button
                          onClick={handleDeleteLead}
                          disabled={deleting}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          {deleting ? 'Deleting...' : 'Delete Lead'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Lead Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Section */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Lead Status</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Lead Status</h3>
                    <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Loan Status</h3>
                    <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.loan_status)}`}>
                      {lead.loan_status ?? 'Not set'}
                    </div>
                  </div>
                  {lead.loan_notes && (
                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-500">Admin Notes</h3>
                      <p className="mt-1 text-sm text-gray-900">{lead.loan_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Information Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-gray-400" />
                  Personal Information
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                    <p className="text-gray-900 font-medium">{formatDisplayValue(lead.full_name)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                    <div className="flex items-center">
                      <EnvelopeIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-gray-900">{formatDisplayValue(lead.email)}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Primary Phone</label>
                    <div className="flex items-center">
                      <PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-gray-900">{formatDisplayValue(lead.phone_number)}</p>
                    </div>
                  </div>
                  {lead.phone_number_2 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Secondary Phone</label>
                      <div className="flex items-center">
                        <PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
                        <p className="text-gray-900">{lead.phone_number_2}</p>
                      </div>
                    </div>
                  )}
                  {lead.phone_number_3 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Additional Phone</label>
                      <div className="flex items-center">
                        <PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
                        <p className="text-gray-900">{lead.phone_number_3}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Lead Source</label>
                    <p className="text-gray-900">{formatDisplayValue(lead.source, 'System')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Lead Type</label>
                    <p className="text-gray-900 capitalize">{formatDisplayValue(lead.lead_type, 'new')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Residential Information Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <HomeIcon className="h-5 w-5 mr-2 text-gray-400" />
                  Residential Information
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Residential Status</label>
                    <p className="text-gray-900">{formatDisplayValue(lead.residential_status)}</p>
                  </div>
                  {lead.residential_status === 'Foreigner' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Work Pass Expiry</label>
                        <p className="text-gray-900">{formatDisplayValue(lead.has_work_pass_expiry)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Proof of Residence Documents</label>
                        <p className="text-gray-900">{formatCheckboxGroup(lead.proof_of_residence_type)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Has Proof of Residence</label>
                        <div className="flex items-center">
                          {lead.has_proof_of_residence ? (
                            <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <XMarkIcon className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          <p className="text-gray-900">{formatDisplayValue(lead.has_proof_of_residence)}</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Has Letter of Consent</label>
                        <div className="flex items-center">
                          {lead.has_letter_of_consent ? (
                            <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <XMarkIcon className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          <p className="text-gray-900">{formatDisplayValue(lead.has_letter_of_consent)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Employment Information Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <BriefcaseIcon className="h-5 w-5 mr-2 text-gray-400" />
                  Employment Information
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Employment Status</label>
                    <p className="text-gray-900">{formatDisplayValue(lead.employment_status)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Monthly Income</label>
                    <p className="text-gray-900">{lead.employment_salary ? `$${lead.employment_salary}` : 'Not specified'}</p>
                  </div>
                  {lead.employment_status !== 'Unemployed' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Length of Employment</label>
                      <p className="text-gray-900">{formatDisplayValue(lead.employment_length)}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Has Latest 3 Months Payslips</label>
                    <div className="flex items-center">
                      {lead.has_payslip_3months ? (
                        <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <XMarkIcon className="h-4 w-4 text-red-500 mr-2" />
                      )}
                      <p className="text-gray-900">{formatDisplayValue(lead.has_payslip_3months)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Loan Information Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <BanknotesIcon className="h-5 w-5 mr-2 text-gray-400" />
                  Loan Information
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Requested Loan Amount</label>
                    <p className="text-gray-900 font-medium">{lead.amount ? `$${lead.amount}` : 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Purpose of Loan</label>
                    <p className="text-gray-900">{formatDisplayValue(lead.loan_purpose)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Has Existing Loans</label>
                    <p className="text-gray-900">{formatDisplayValue(lead.existing_loans)}</p>
                  </div>
                  {lead.existing_loans === 'Yes' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Outstanding Loan Amount</label>
                      <p className="text-gray-900">{lead.outstanding_loan_amount ? `$${lead.outstanding_loan_amount}` : 'Not specified'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Communication Preferences Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <ChatBubbleLeftEllipsisIcon className="h-5 w-5 mr-2 text-gray-400" />
                  Communication Preferences
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Preferred Contact Method</label>
                    <p className="text-gray-900">{formatDisplayValue(lead.contact_preference, 'No Preferences')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Preferred Language</label>
                    <p className="text-gray-900">{formatDisplayValue(lead.communication_language, 'No Preferences')}</p>
                  </div>
                  {/* <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Is Contactable</label>
                    <div className="flex items-center">
                      {lead.is_contactable ? (
                        <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <XMarkIcon className="h-4 w-4 text-red-500 mr-2" />
                      )}
                      <p className="text-gray-900">{formatDisplayValue(lead.is_contactable)}</p>
                    </div>
                  </div> */}
                </div>
              </div>
            </div>

            {/* Lead Management Card (Admin only) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <ExclamationCircleIcon className="h-5 w-5 mr-2 text-gray-400" />
                  Lead Management
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Lead Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
                      {lead.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Assigned To</label>
                    <p className="text-gray-900">{(lead as any).assigned_user_name ?? formatDisplayValue(lead.assigned_to)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Lead Score</label>
                    <p className="text-gray-900">{formatDisplayValue(lead.lead_score, '0')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Eligibility Status</label>
                    <p className="text-gray-900 capitalize">{formatDisplayValue(lead.eligibility_status)}</p>
                  </div>
                  {lead.eligibility_notes && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">Eligibility Notes</label>
                      <p className="text-gray-900">{lead.eligibility_notes}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Created</label>
                    <p className="text-gray-900">{lead.created_at ? format(new Date(lead.created_at), 'MMM dd, yyyy • h:mm a') : 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Last Updated</label>
                    <p className="text-gray-900">{lead.updated_at ? format(new Date(lead.updated_at), 'MMM dd, yyyy • h:mm a') : 'Never'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Appointments Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900 flex items-center">
                    <CalendarIcon className="h-5 w-5 mr-2 text-gray-400" />
                    Appointments ({appointments.length})
                  </h2>
                  <button
                    onClick={() => router.push(`/dashboard/leads/${leadId}/appointment`)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Schedule New
                  </button>
                </div>
              </div>
              <div className="p-6">
                {appointments.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No appointments scheduled</p>
                    <button
                      onClick={() => router.push(`/dashboard/leads/${leadId}/appointment`)}
                      className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Schedule an appointment
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appointments.map((appointment) => {
                      const statusConfig = getAppointmentStatusColor(appointment.status);
                      const StatusIcon = statusConfig.icon;
                      
                      // Convert UTC times to Singapore timezone for display
                      const startTimeSGT = new Date(appointment.start_datetime);
                      const endTimeSGT = new Date(appointment.end_datetime);
                      // Add 8 hours for Singapore timezone (UTC+8)
                      // startTimeSGT.setHours(startTimeSGT.getHours() + 8);
                      // endTimeSGT.setHours(endTimeSGT.getHours() + 8);
                      
                      return (
                        <div key={appointment.id} className={`border rounded-lg p-4 ${statusConfig.colors}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center">
                              <StatusIcon className="h-5 w-5 mr-3" />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-gray-500">#{appointment.id}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-600 mb-1">
                                  <CalendarIcon className="h-4 w-4 mr-1" />
                                  <span>{format(startTimeSGT, 'MMM dd, yyyy')}</span>
                                  <ClockIcon className="h-4 w-4 ml-3 mr-1" />
                                  <span>
                                    {format(startTimeSGT, 'h:mm a')} - {format(endTimeSGT, 'h:mm a')} (SGT)
                                  </span>
                                </div>
                                
                                {/* Creator and Agent Info */}
                                <div className="text-xs text-gray-500 mb-2">
                                  <div>Booked by: <span className="font-medium">{appointment.agent_name}</span></div>
                                  {appointment.created_at && (
                                    <div>Created: <span className="font-medium">
                                      {format(new Date(appointment.created_at), 'MMM dd, yyyy • h:mm a')}
                                    </span></div>
                                  )}
                                  {/* <div>Assigned to: <span className="font-medium">{appointment.assigned_user_name}</span></div> */}
                                </div>

                                {/* Appointment Status */}
                                <div className="mb-2">
                                  <span className="font-semibold text-gray-500 mr-2">Status:</span>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                                    {appointment.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </span>
                                </div>
                                
                                {/* Loan Status if available */}
                                {appointment.loan_status && (
                                  <div className="mb-2">
                                    <span className="font-semibold text-gray-500 mr-2">Loan Status:</span>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.loan_status)}`}>
                                      {appointment.loan_status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Notes */}
                                {appointment.notes && (
                                  <p className="text-sm mt-2 italic bg-white/50 p-2 rounded">{appointment.notes}</p>
                                )}
                                
                                {/* Loan Notes */}
                                {appointment.loan_notes && (
                                  <p className="text-sm mt-2 italic bg-yellow-50 p-2 rounded border border-yellow-200">
                                    <span className="font-medium">Loan Notes:</span> {appointment.loan_notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column - Notes */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-gray-400" />
                  Notes ({notes.length})
                </h2>
              </div>
              <div className="p-6">
                {/* Add note form */}
                <form onSubmit={handleAddNote} className="mb-6">
                  <div className="flex flex-col space-y-3">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={addingNote || !newNote.trim()}
                      className="self-end px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingNote ? 'Adding...' : 'Add Note'}
                    </button>
                  </div>
                </form>

                {/* Notes list */}
                <div className="space-y-4">
                  {notes.length === 0 ? (
                    <div className="text-center py-8">
                      <ChatBubbleLeftIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No notes yet</p>
                      <p className="text-sm text-gray-400 mt-1">Add the first note above</p>
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-800">{note.content}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            {note.created_at ? format(new Date(note.created_at), 'MMM dd, yyyy • h:mm a') : 'Unknown date'}
                          </div>
                          <div className="flex items-center">
                            <UserIcon className="h-3 w-3 mr-1" />
                            {note.user_first_name && note.user_last_name 
                              ? `${note.user_first_name} ${note.user_last_name}`
                              : 'Unknown user'}
                          </div>
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

      {/* Click outside to close dropdown */}
      {showActionsDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowActionsDropdown(false)}
        />
      )}
    </div>
  );
} 