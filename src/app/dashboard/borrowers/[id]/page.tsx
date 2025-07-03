"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { 
  EyeIcon, 
  PencilIcon, 
  PhoneIcon, 
  ChatBubbleLeftRightIcon, 
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  HomeIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  InformationCircleIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  IdentificationIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { getBorrowerActions } from '~/app/_actions/borrowers';
import { getBorrowerWithLoanPlans } from '~/app/_actions/borrowerSync';
import { getBorrowerNotes } from '~/app/_actions/borrowerNotes';
import { createBorrowerNote } from '~/app/_actions/borrowerNotes';
import { getBorrowerAppointments } from '~/app/_actions/borrowerAppointments';
import BorrowerQuestionnaireModal from '~/app/_components/BorrowerQuestionnaireModal';
import { format, parseISO } from 'date-fns';

import BorrowerActionButtons from "~/app/_components/BorrowerActionButtons";
import BorrowerCommunicationPreferences from "~/app/_components/BorrowerCommunicationPreferences";
import BorrowerStatusUpdateModal from "~/app/_components/BorrowerStatusUpdateModal";

// Use inferred types from schema - much cleaner!
type Borrower = {
  id: number;
  atom_borrower_id: string | null;
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
  income_document_type: string | null;
  current_employer: string | null;
  average_monthly_income: string | null;
  annual_income: string | null;
  estimated_reloan_amount: string | null;
  loan_id: string | null;
  latest_completed_loan_date: string | null;
  is_in_closed_loan: string | null;
  is_in_2nd_reloan: string | null;
  is_in_attrition: string | null;
  is_in_last_payment_due: string | null;
  is_in_bhv1: string | null;
  credit_score: string | null;
  loan_amount: string | null;
  loan_status: string | null;
  loan_notes: string | null;
  lead_score: number | null;
  financial_commitment_change: string | null;
  contact_preference: string | null;
  communication_language: string | null;
  follow_up_date: Date | null;
  assigned_to: string | null;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  is_deleted: boolean | null;
  assigned_agent_name: string | null;
  assigned_agent_email: string | null;
};

type LoanPlan = {
  id: number;
  estimated_reloan_amount: string | null;
  loan_id: string;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  borrower_id: number;
  product_name: string | null;
  has_bd: boolean | null;
  has_bhv: boolean | null;
  has_dnc: boolean | null;
  is_overdue: boolean | null;
  next_due_date: Date | null;
  loan_completed_date: Date | null;
  loan_comments: string | null;
  is_selected: boolean | null;
  plan_details: unknown;
};

type BorrowerAppointment = {
  id: number;
  status: string;
  loan_status: string | null;
  loan_notes: string | null;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  borrower_id: number;
  agent_id: string;
  appointment_type: string | null;
  notes: string | null;
  lead_source: string | null;
  start_datetime: Date;
  end_datetime: Date;
};

type BorrowerAction = {
  action_id: number;
  borrower_id: number;
  user_id: string;
  action_type: string;
  content: string;
  timestamp: Date;
  created_by: string;
};

export default function BorrowerDetailPage() {
  const params = useParams();
  const borrowerId = parseInt(params.id as string);
  
  // Use proper schema types - no more 'any'!
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [loanPlans, setLoanPlans] = useState<LoanPlan[]>([]);
  const [actions, setActions] = useState<BorrowerAction[]>([]);
  const [appointments, setAppointments] = useState<BorrowerAppointment[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [borrowerActions, setBorrowerActions] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'general' | 'loan_discussion' | 'payment_issue' | 'follow_up' | 'other'>('general');
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  // Questionnaire modal state
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
  
  // Status update modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [preSelectedStatus, setPreSelectedStatus] = useState<'follow_up' | 'no_answer' | 'give_up' | 'blacklisted' | undefined>(undefined);

  // Helper function to safely access loan plan properties
  const safeLoanPlanAccess = (plan: any, property: string): any => {
    return plan && typeof plan === 'object' ? plan[property] : null;
  };

  // Notification handler
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Status update handlers
  const handleStatusUpdate = (status?: 'follow_up' | 'no_answer' | 'give_up' | 'blacklisted') => {
    setPreSelectedStatus(status);
    setShowStatusModal(true);
  };

  const handleModalClose = () => {
    setShowStatusModal(false);
    setPreSelectedStatus(undefined);
  };

  const handleModalUpdate = () => {
    // Trigger refresh of borrower data
    if (borrowerId) {
      window.location.reload();
    }
  };

  // Format follow-up date with time awareness
  const formatFollowUpDate = (followUpDate: Date | string | null) => {
    if (!followUpDate) return null;
    
    try {
      const date = typeof followUpDate === 'string' ? parseISO(followUpDate) : followUpDate;
      const hours = date.getHours();
      const minutes = date.getMinutes();
      
      // Check if time is not default (16:00:00+00 which would be 00:00:00 Singapore time)
      const hasSpecificTime = !(hours === 0 && minutes === 0);
      
      if (hasSpecificTime) {
        return format(date, 'MMM d, yyyy \'at\' h:mm a');
      } else {
        return format(date, 'MMM d, yyyy');
      }
    } catch {
      return 'Invalid date';
    }
  };

  useEffect(() => {
    const fetchBorrowerData = async () => {
      try {
        setLoading(true);
        
        // Fetch borrower details and loan plans in one call
        const borrowerWithPlansResult = await getBorrowerWithLoanPlans(borrowerId);
        if (borrowerWithPlansResult.success && borrowerWithPlansResult.data?.borrower) {
          setBorrower(borrowerWithPlansResult.data.borrower as Borrower);
          setLoanPlans(borrowerWithPlansResult.data.loanPlans);
        }

        // Fetch actions
        const actionsResult = await getBorrowerActions(borrowerId);
        if (actionsResult.success) {
          setBorrowerActions(actionsResult.data);
        }

        // Fetch appointments
        const appointmentsResult = await getBorrowerAppointments({ borrower_id: borrowerId });
        if (appointmentsResult.success) {
          setAppointments(appointmentsResult.data);
        }

        // Fetch notes
        const notesResult = await getBorrowerNotes({ borrower_id: borrowerId, limit: 10 });
        if (notesResult.success) {
          setNotes(notesResult.data);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch borrower data");
      } finally {
        setLoading(false);
      }
    };

    if (borrowerId) {
      void fetchBorrowerData();
    }
  }, [borrowerId]);

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      assigned: "bg-purple-100 text-purple-800",
      no_answer: "bg-yellow-100 text-yellow-800",
      follow_up: "bg-orange-100 text-orange-800",
      booked: "bg-green-100 text-green-800",
      done: "bg-gray-100 text-gray-800",
      "missed/RS": "bg-red-100 text-red-800",
      unqualified: "bg-red-100 text-red-800",
      give_up: "bg-red-100 text-red-800",
      blacklisted: "bg-black text-white",
    };
    return colors[status] ?? "bg-gray-100 text-gray-800";
  };

  const getAppointmentStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: "bg-blue-100 text-blue-800",
      done: "bg-green-100 text-green-800",
      missed: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return colors[status] ?? "bg-gray-100 text-gray-800";
  };

  const getLeadSource = (borrower: any) => {
    // Prioritized lead source determination based on performance buckets
    if (borrower?.is_in_closed_loan === "Yes") {
      return { source: "Closed Loan", priority: "high", color: "#4caf50" };
    }
    if (borrower?.is_in_2nd_reloan === "Yes") {
      return { source: "2nd Reloan", priority: "medium", color: "#ff9800" };
    }
    if (borrower?.is_in_attrition === "Yes") {
      return { source: "Attrition Risk", priority: "medium", color: "#f44336" };
    }
    if (borrower?.is_in_last_payment_due === "Yes") {
      return { source: "Last Payment Due", priority: "medium", color: "#9c27b0" };
    }
    if (borrower?.is_in_bhv1 === "Yes") {
      return { source: "BHV1 Pattern", priority: "low", color: "#607d8b" };
    }
    
    // Default fallback
    return { source: "Not Eligible", priority: "low", color: "#9e9e9e" };
  };

  // Get the latest/upcoming appointment
  const upcomingAppointment = appointments.find(apt => apt.status === 'upcoming');
  const latestAppointment = appointments.length > 0 ? appointments[0] : null;

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div>Loading borrower details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "red" }}>
        <div>Error: {error}</div>
      </div>
    );
  }

  if (!borrower) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div>Borrower not found</div>
      </div>
    );
  }

  const primaryLoanPlan = loanPlans.find(plan => plan.is_selected);
  const otherLoanPlans = loanPlans.filter(plan => !plan.is_selected);

  const handleSaveNote = async () => {
    if (!newNoteContent.trim() || !borrower) return;
    
    setSavingNote(true);
    try {
      await createBorrowerNote({
        borrower_id: borrower.id,
        content: newNoteContent.trim(),
        note_type: noteType
      });
      
      setNewNoteContent('');
      setNoteType('general');
      showNotification('Note saved successfully!', 'success');
      
      // Refresh notes
      const notesResult = await getBorrowerNotes({ borrower_id: borrower.id, limit: 10 });
      if (notesResult.success) {
        setNotes(notesResult.data);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      showNotification('Failed to save note', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleQuestionnaireUpdate = () => {
    showNotification('Questionnaire saved successfully!', 'success');
    setShowQuestionnaireModal(false);
    
    // Refresh notes and actions instead of reloading the page
    const refreshData = async () => {
      try {
        // Fetch notes
        const notesResult = await getBorrowerNotes({ borrower_id: borrowerId, limit: 10 });
        if (notesResult.success) {
          setNotes(notesResult.data);
        }
        
        // Fetch actions
        const actionsResult = await getBorrowerActions(borrowerId);
        if (actionsResult.success) {
          setBorrowerActions(actionsResult.data);
        }
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    };
    
    void refreshData();
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 1000,
          padding: "12px 24px",
          borderRadius: "8px",
          backgroundColor: notification.type === 'success' ? '#d4edda' : 
                          notification.type === 'error' ? '#f8d7da' : '#d1ecf1',
          border: `1px solid ${notification.type === 'success' ? '#c3e6cb' : 
                              notification.type === 'error' ? '#f5c6cb' : '#bee5eb'}`,
          color: notification.type === 'success' ? '#155724' : 
                 notification.type === 'error' ? '#721c24' : '#0c5460'
        }}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div style={{ 
        marginBottom: "30px", 
        padding: "20px", 
        backgroundColor: "#fff", 
        borderRadius: "8px", 
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)" 
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "15px" }}>
          <div>
            <h1 style={{ fontSize: "28px", marginBottom: "5px", color: "#333" }}>
              {borrower.full_name}
            </h1>
            <div style={{ fontSize: "14px", color: "#666" }}>
              ID: {borrower.id} {borrower.atom_borrower_id && `• External ID: ${borrower.atom_borrower_id}`}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(borrower.status)}`}>
              {borrower.status.replace("_", " ").toUpperCase()}
            </span>
            {borrower.assigned_to && (
              <div style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}>
                Assigned to: {borrower.assigned_agent_name || borrower.assigned_agent_email || borrower.assigned_to}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
          <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>PRIMARY LOAN</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
              {primaryLoanPlan?.product_name || borrower.loan_id || "No Active Loan"}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              {primaryLoanPlan?.loan_id || borrower.loan_id ? `ID: ${primaryLoanPlan?.loan_id || borrower.loan_id}` : ""}
            </div>
          </div>
          
          <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>ESTIMATED LOAN AMOUNT</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
              ${borrower.loan_amount || borrower.estimated_reloan_amount || "N/A"}
            </div>
          </div>

          <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>MONTHLY INCOME</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
              ${borrower.average_monthly_income || "N/A"}
            </div>
          </div>

          <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>ACTIONS</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => setShowQuestionnaireModal(true)}
                style={{
                  padding: "10px 16px",
                  backgroundColor: "#8e24aa",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(142, 36, 170, 0.3)",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#7b1fa2";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#8e24aa";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <PencilSquareIcon className="h-5 w-5" />
                Update Questionnaire
              </button>
              <button
                onClick={() => window.location.href = `/dashboard/borrowers/${borrowerId}/appointments`}
                style={{
                  padding: "10px 16px",
                  backgroundColor: "#1976d2",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(25, 118, 210, 0.3)",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#1565c0";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#1976d2";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <CalendarIcon className="h-5 w-5" />
                View Appointments
              </button>
            </div>
          </div>
        </div>

        {/* Appointment and Follow-up Information */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "20px" }}>
          {/* Appointment Status */}
          <div style={{ padding: "15px", backgroundColor: "#f0f7ff", borderRadius: "6px", border: "1px solid #e3f2fd" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>APPOINTMENT STATUS</div>
            {upcomingAppointment ? (
              <div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1976d2", marginBottom: "5px" }}>
                  <span className={`px-2 py-1 rounded text-sm ${getAppointmentStatusBadgeColor(upcomingAppointment.status)}`}>
                    {upcomingAppointment.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "14px", color: "#666" }}>
                  {formatDateTime(upcomingAppointment.start_datetime)}
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                  with {(upcomingAppointment as any).agent_name}
                </div>
              </div>
            ) : latestAppointment ? (
              <div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>
                  <span className={`px-2 py-1 rounded text-sm ${getAppointmentStatusBadgeColor(latestAppointment.status)}`}>
                    {latestAppointment.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "14px", color: "#666" }}>
                  Last: {formatDateTime(latestAppointment.start_datetime)}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#666" }}>
                No Appointments
              </div>
            )}
            <button
              onClick={() => window.location.href = `/dashboard/borrowers/${borrowerId}/appointments`}
              style={{
                marginTop: "10px",
                padding: "8px 16px",
                backgroundColor: "#1976d2",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <CalendarIcon className="h-4 w-4" />
              Manage Appointments
            </button>
          </div>

          {/* Follow-up Date */}
          <div style={{ padding: "15px", backgroundColor: "#fff8e1", borderRadius: "6px", border: "1px solid #ffecb3" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>FOLLOW-UP DATE</div>
            {borrower.follow_up_date ? (
              <div>
                <div style={{ 
                  fontSize: "16px", 
                  fontWeight: "bold", 
                  color: new Date(borrower.follow_up_date) < new Date() ? "#f44336" : "#ff9800",
                  marginBottom: "5px"
                }}>
                  {formatFollowUpDate(borrower.follow_up_date)}
                </div>
                <div style={{ fontSize: "14px", color: "#666" }}>
                  {new Date(borrower.follow_up_date) < new Date() ? (
                    <span style={{ color: "#f44336", fontWeight: "500" }}>⚠️ OVERDUE</span>
                  ) : (
                    <span style={{ color: "#4caf50" }}>✓ SCHEDULED</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>
                  Not Scheduled
                </div>
                <div style={{ fontSize: "14px", color: "#666" }}>
                  No follow-up date set
                </div>
              </div>
            )}
            
            {/* Quick Status Update Buttons */}
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "600" }}>
                QUICK STATUS UPDATE
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <button
                  onClick={() => handleStatusUpdate('follow_up')}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f3e5f5",
                    color: "#7b1fa2",
                    border: "1px solid #ce93d8",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#e1bee7";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#f3e5f5";
                  }}
                >
                  <CalendarIcon className="h-3 w-3" />
                  Follow-up
                </button>
                
                <button
                  onClick={() => handleStatusUpdate('no_answer')}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f5f5f5",
                    color: "#616161",
                    border: "1px solid #bdbdbd",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#eeeeee";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#f5f5f5";
                  }}
                >
                  No Answer
                </button>
                
                {/* <button
                  onClick={() => handleStatusUpdate('give_up')}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#fff3e0",
                    color: "#ef6c00",
                    border: "1px solid #ffcc02",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffe0b2";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#fff3e0";
                  }}
                >
                  Give Up
                </button>
                
                <button
                  onClick={() => handleStatusUpdate('blacklisted')}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#ffebee",
                    color: "#c62828",
                    border: "1px solid #ef5350",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffcdd2";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffebee";
                  }}
                >
                  Blacklist
                </button> */}
                
                <button
                  onClick={() => handleStatusUpdate()}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#e3f2fd",
                    color: "#1976d2",
                    border: "1px solid #2196f3",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#bbdefb";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#e3f2fd";
                  }}
                >
                  <Cog6ToothIcon className="h-3 w-3" />
                  More
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ borderBottom: "2px solid #e9ecef", display: "flex", gap: "20px" }}>
          {[
            { id: "overview", label: "Overview", icon: <UserIcon className="h-4 w-4" /> },
            { id: "loans", label: `Loan Plans (${loanPlans.length})`, icon: <BanknotesIcon className="h-4 w-4" /> },
            { id: "history", label: `History (${borrowerActions.length})`, icon: <ClockIcon className="h-4 w-4" /> },
            { id: "appointments", label: `Appointments (${appointments.length})`, icon: <CalendarIcon className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 16px",
                border: "none",
                backgroundColor: "transparent",
                borderBottom: activeTab === tab.id ? "3px solid #007bff" : "3px solid transparent",
                color: activeTab === tab.id ? "#007bff" : "#666",
                fontWeight: activeTab === tab.id ? "bold" : "normal",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gap: "20px" }}>
          {/* Top Row - Key Information Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
            {/* Contact & Personal Information */}
            <div style={{ 
              padding: "24px", 
              backgroundColor: "#fff", 
              borderRadius: "12px", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid #e9ecef"
            }}>
              <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333", display: "flex", alignItems: "center", gap: "10px" }}>
                <UserIcon className="h-6 w-6 text-blue-600" />
                Contact & Personal Details
              </h3>
              
              {/* Contact Methods */}
              <div style={{ marginBottom: "24px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Contact Information
                </h4>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <PhoneIcon className="h-4 w-4 text-green-600" />
                    <span style={{ fontWeight: "500" }}>Primary:</span> {borrower.phone_number}
                  </div>
                  {borrower.phone_number_2 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "20px" }}>
                      <span style={{ fontWeight: "500" }}>Secondary:</span> {borrower.phone_number_2}
                    </div>
                  )}
                  {borrower.phone_number_3 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "20px" }}>
                      <span style={{ fontWeight: "500" }}>Tertiary:</span> {borrower.phone_number_3}
                    </div>
                  )}
                  {borrower.email && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <ChatBubbleLeftRightIcon className="h-4 w-4 text-blue-600" />
                      <span style={{ fontWeight: "500" }}>Email:</span> {borrower.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Details */}
              <div style={{ marginBottom: "24px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Personal Details
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div><span style={{ fontWeight: "500" }}>Residential Status:</span> {borrower.residential_status?.replace("_", " ").toUpperCase() ?? "N/A"}</div>
                  <div><span style={{ fontWeight: "500" }}>Source:</span> {borrower.source ?? "N/A"}</div>
                  <div><span style={{ fontWeight: "500" }}>Current Employer:</span> {borrower.current_employer ?? "N/A"}</div>
                  <div><span style={{ fontWeight: "500" }}>Latest Loan Completed:</span> {formatDate(borrower.latest_completed_loan_date)}</div>
                </div>
              </div>

              {/* System Timestamps */}
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Record History
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "14px", color: "#666" }}>
                  <div><span style={{ fontWeight: "500" }}>Created:</span> {formatDateTime(borrower.created_at)}</div>
                  <div><span style={{ fontWeight: "500" }}>Last Updated:</span> {formatDateTime(borrower.updated_at)}</div>
                </div>
              </div>
            </div>

            {/* Identity & Status Card */}
            <div style={{ 
              padding: "24px", 
              backgroundColor: "#fff", 
              borderRadius: "12px", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid #e9ecef"
            }}>
              <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333", display: "flex", alignItems: "center", gap: "10px" }}>
                <IdentificationIcon className="h-6 w-6 text-purple-600" />
                Identity & Status
              </h3>
              
              {/* AA Status - Prominent */}
              <div style={{ marginBottom: "20px", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", textTransform: "uppercase" }}>AA Status</div>
                <span style={{ 
                  padding: "8px 16px", 
                  borderRadius: "20px", 
                  fontSize: "14px",
                  fontWeight: "600",
                  backgroundColor: borrower.aa_status === "yes" ? "#d4edda" : 
                                 borrower.aa_status === "no" ? "#f8d7da" : "#fff3cd",
                  color: borrower.aa_status === "yes" ? "#155724" : 
                         borrower.aa_status === "no" ? "#721c24" : "#856404"
                }}>
                  {(borrower.aa_status ?? 'pending').toUpperCase()}
                </span>
              </div>

              {/* ID Information */}
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Identification
                </h4>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div><span style={{ fontWeight: "500" }}>Type:</span> {borrower.id_type?.replace("_", " ").toUpperCase()}</div>
                  {/* <div><span style={{ fontWeight: "500" }}>Number:</span> {borrower.id_number ?? "N/A"}</div> */}
                  <div><span style={{ fontWeight: "500" }}>Income Doc:</span> {borrower.income_document_type?.replace("_", " ").toUpperCase() ?? "N/A"}</div>
                </div>
              </div>

              {/* Lead Source */}
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Lead Source
                </h4>
                <div style={{ textAlign: "center" }}>
                  <span style={{ 
                    color: "#007bff",
                    fontWeight: "600",
                    padding: "6px 12px",
                    backgroundColor: "#007bff20",
                    borderRadius: "8px",
                    fontSize: "13px",
                    display: "inline-block"
                  }}>
                    {borrower.source}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row - Financial Overview */}
          <div style={{ 
            padding: "24px", 
            backgroundColor: "#fff", 
            borderRadius: "12px", 
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e9ecef"
          }}>
            <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333", display: "flex", alignItems: "center", gap: "10px" }}>
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
              Financial Overview
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
              {/* Income Information */}
              <div style={{ padding: "16px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Income
                </h4>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#28a745", marginBottom: "4px" }}>
                  ${borrower.average_monthly_income ?? "N/A"}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>Monthly Average</div>
                {borrower.annual_income && (
                  <div style={{ fontSize: "14px", color: "#666", marginTop: "8px" }}>
                    Annual: ${borrower.annual_income}
                  </div>
                )}
              </div>

              {/* Loan Amount */}
              <div style={{ padding: "16px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Estimated Reloan
                </h4>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#007bff", marginBottom: "4px" }}>
                  ${borrower.estimated_reloan_amount ?? "N/A"}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>Projected Amount</div>
              </div>

              {/* Scores */}
              <div style={{ padding: "16px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Scores
                </h4>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px" }}>Lead Score:</span>
                    <span style={{ 
                      fontWeight: "600",
                      color: (borrower.lead_score ?? 0) >= 75 ? "#28a745" : 
                             (borrower.lead_score ?? 0) >= 50 ? "#ffc107" : "#dc3545"
                    }}>
                      {borrower.lead_score}/100
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px" }}>Credit Score:</span>
                    <span style={{ fontWeight: "600" }}>
                      {borrower.credit_score || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div style={{ padding: "16px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  System Status
                </h4>
                <div style={{ marginBottom: "12px" }}>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(borrower.status)}`}>
                    {borrower.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "14px", color: "#666" }}>
                  {(borrower as any).assigned_to ? (
                    <>
                      <div><span style={{ fontWeight: "500" }}>Agent:</span> {(borrower as any).assigned_to}</div>
                      {(borrower as any).assigned_to_email && (
                        <div style={{ fontSize: "12px", color: "#999" }}>{(borrower as any).assigned_to_email}</div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontStyle: "italic" }}>Unassigned</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row - Communication & Status Buckets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
            {/* Communication Preferences */}
            <BorrowerCommunicationPreferences
              borrowerId={borrowerId}
              currentContactPreference={borrower.contact_preference ?? undefined}
              currentCommunicationLanguage={borrower.communication_language ?? undefined}
              onSuccess={() => {
                window.location.reload();
              }}
            />

            {/* Customer Performance Buckets */}
            <div style={{ 
              padding: "24px", 
              backgroundColor: "#fff", 
              borderRadius: "12px", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid #e9ecef"
            }}>
              <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333", display: "flex", alignItems: "center", gap: "10px" }}>
                <ChartBarIcon className="h-6 w-6 text-indigo-600" />
                Performance Buckets
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
                <StatusBucket 
                  title="Closed Loan"
                  value={borrower.is_in_closed_loan}
                  description="Completed loans"
                />
                <StatusBucket 
                  title="2nd Reloan"
                  value={borrower.is_in_2nd_reloan}
                  description="Second cycle"
                />
                <StatusBucket 
                  title="Attrition"
                  value={borrower.is_in_attrition}
                  description="Leaving risk"
                />
                <StatusBucket 
                  title="Last Payment"
                  value={borrower.is_in_last_payment_due}
                  description="Final payment"
                />
                <StatusBucket 
                  title="BHV1"
                  value={borrower.is_in_bhv1}
                  description="Behavior pattern"
                />
              </div>
            </div>
          </div>

          {/* Notes & Communications Section - Only Manual Notes */}
          <div style={{ 
            padding: "24px", 
            backgroundColor: "#fff", 
            borderRadius: "12px", 
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e9ecef"
          }}>
            <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333", display: "flex", alignItems: "center", gap: "10px" }}>
              <DocumentTextIcon className="h-6 w-6 text-purple-600" />
              Notes & Communications
            </h3>
            
            {/* Add New Note Form */}
            <div style={{ 
              padding: "20px", 
              backgroundColor: "#f8f9fa", 
              borderRadius: "8px",
              border: "1px solid #e9ecef",
              marginBottom: "20px"
            }}>
              <h4 style={{ fontSize: "16px", marginBottom: "16px", color: "#333" }}>Add New Note</h4>
              
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#666", marginBottom: "6px" }}>
                    Note Type
                  </label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as typeof noteType)}
                    style={{ 
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="general">General Note</option>
                    <option value="loan_discussion">Loan Discussion</option>
                    <option value="payment_issue">Payment Issue</option>
                    <option value="follow_up">Follow-up Required</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#666", marginBottom: "6px" }}>
                    Note Content *
                  </label>
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Enter your note here..."
                    rows={4}
                    style={{ 
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "14px",
                      resize: "vertical"
                    }}
                  />
                </div>
                
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    onClick={() => {
                      setNewNoteContent('');
                      setNoteType('general');
                    }}
                    disabled={savingNote}
                    style={{ 
                      padding: "8px 16px",
                      backgroundColor: "#f8f9fa",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote || !newNoteContent.trim()}
                    style={{ 
                      padding: "8px 16px",
                      backgroundColor: savingNote || !newNoteContent.trim() ? "#ccc" : "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: savingNote || !newNoteContent.trim() ? "not-allowed" : "pointer"
                    }}
                  >
                    {savingNote ? "Saving..." : "Save Note"}
                  </button>
                </div>
              </div>
            </div>

            {/* Only Manual Notes Display */}
            <div>
              {notes.length > 0 ? (
                <div style={{ display: "grid", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
                  {notes.slice(0, 10).map((note: any, index: number) => (
                    <div 
                      key={`note-${note.id || index}`}
                      style={{ 
                        padding: "16px", 
                        backgroundColor: "#f8f9fa", 
                        borderRadius: "8px",
                        borderLeft: "4px solid " + (
                          note.note_type === 'loan_discussion' ? '#1976d2' :
                          note.note_type === 'payment_issue' ? '#f44336' :
                          note.note_type === 'follow_up' ? '#ff9800' :
                          note.note_type === 'other' ? '#9c27b0' :
                          '#4caf50' // general
                        )
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ 
                            fontSize: "12px", 
                            fontWeight: "600", 
                            color: "#666",
                            textTransform: "uppercase",
                            backgroundColor: '#4caf5020',
                            padding: "2px 6px",
                            borderRadius: "4px"
                          }}>
                            📝 {note.note_type || 'general'}
                          </span>
                          <span style={{ fontSize: "12px", color: "#999" }}>
                            by {note.created_by_name && note.created_by_last_name ? 
                                `${note.created_by_name} ${note.created_by_last_name}` : 
                                note.created_by_email || 'Unknown'}
                          </span>
                        </div>
                        <span style={{ fontSize: "12px", color: "#666" }}>
                          {formatDateTime(note.created_at)}
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: "14px", 
                        color: "#333", 
                        lineHeight: "1.4",
                        whiteSpace: "pre-wrap"
                      }}>
                        {note.content?.substring(0, 200)}
                        {note.content && note.content.length > 200 && '...'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: "40px", 
                  textAlign: "center", 
                  backgroundColor: "#f8f9fa", 
                  borderRadius: "8px", 
                  color: "#666" 
                }}>
                  <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <div>No manual notes yet</div>
                  <div style={{ fontSize: "14px", marginTop: "5px" }}>
                    Add the first note above to keep track of custom information
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {activeTab === "loans" && (
        <div>
          <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333", display: "flex", alignItems: "center", gap: "8px" }}>
            <BanknotesIcon className="h-6 w-6 text-gray-600" />
            Loan Plans ({loanPlans.length})
          </h3>
          
          {loanPlans.length > 0 ? (
            <div style={{ display: "grid", gap: "20px" }}>
              {loanPlans.map((plan) => (
                <LoanPlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          ) : (
            <div style={{ 
              padding: "40px", 
              textAlign: "center", 
              backgroundColor: "#f8f9fa", 
              borderRadius: "8px", 
              color: "#666" 
            }}>
              <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <div>No loan plans found for this borrower</div>
              <div style={{ fontSize: "14px", marginTop: "5px" }}>
                Loan plans will appear here after syncing with external API
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div>
          <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333", display: "flex", alignItems: "center", gap: "8px" }}>
            <ClockIcon className="h-6 w-6 text-gray-600" />
            Action History ({borrowerActions.length})
          </h3>
          
          {borrowerActions.length > 0 ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {borrowerActions.map((action) => (
                <div key={action.action_id} style={{
                  padding: "15px",
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  borderLeft: "4px solid #007bff"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        padding: "4px 8px",
                        backgroundColor: "#e3f2fd",
                        color: "#1976d2",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold"
                      }}>
                        {action.action_type.toUpperCase()}
                      </span>
                      <span style={{ fontSize: "14px", color: "#666" }}>
                        by {(action as any).user_first_name} {(action as any).user_last_name}
                      </span>
                    </div>
                    <span style={{ fontSize: "14px", color: "#999" }}>
                      {formatDateTime(action.timestamp)}
                    </span>
                  </div>
                  {action.content && (
                    <div style={{ fontSize: "14px", color: "#333", lineHeight: "1.4" }}>
                      {action.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              padding: "40px", 
              textAlign: "center", 
              backgroundColor: "#f8f9fa", 
              borderRadius: "8px", 
              color: "#666" 
            }}>
              <ClockIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <div>No action history found</div>
              <div style={{ fontSize: "14px", marginTop: "5px" }}>
                Actions will appear here as you interact with this borrower
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "appointments" && (
        <div>
          <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333", display: "flex", alignItems: "center", gap: "8px" }}>
            <CalendarIcon className="h-6 w-6 text-gray-600" />
            Appointments ({appointments.length})
          </h3>
          
          <div style={{ marginBottom: "20px", textAlign: "right" }}>
            <button
              onClick={() => window.location.href = `/dashboard/borrowers/${borrowerId}/appointments`}
              style={{
                padding: "12px 24px",
                backgroundColor: "#1976d2",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                cursor: "pointer",
                fontWeight: "500",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <CalendarIcon className="h-5 w-5" />
              Manage Appointments
            </button>
          </div>

          {appointments.length > 0 ? (
            <div style={{ display: "grid", gap: "15px" }}>
              {appointments.map((appointment) => (
                <div key={appointment.id} style={{
                  padding: "20px",
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  borderLeft: `4px solid ${
                    appointment.status === 'upcoming' ? '#4caf50' :
                    appointment.status === 'done' ? '#2196f3' :
                    appointment.status === 'missed' ? '#f44336' :
                    '#9e9e9e'
                  }`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "15px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                        <span className={`px-3 py-1 rounded text-sm font-medium ${getAppointmentStatusBadgeColor(appointment.status)}`}>
                          {appointment.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: "14px", color: "#666" }}>
                          {appointment.appointment_type?.replace('_', ' ').toUpperCase() ?? 'GENERAL'}
                        </span>
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#333" }}>
                        {formatDateTime(appointment.start_datetime)}
                      </div>
                      <div style={{ fontSize: "14px", color: "#666" }}>
                        to {formatDateTime(appointment.end_datetime)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "14px", color: "#666", marginBottom: "5px" }}>
                        <strong>Agent:</strong> {(appointment as any).agent_first_name} {(appointment as any).agent_last_name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#999" }}>
                        Created: {formatDateTime(appointment.created_at)}
                      </div>
                      {appointment.created_by && (
                        <div style={{ fontSize: "12px", color: "#999" }}>
                          Booked by: {appointment.created_by}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Appointment Details */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "15px" }}>
                    {appointment.lead_source && (
                      <div><strong>Lead Source:</strong> {appointment.lead_source}</div>
                    )}
                    {appointment.loan_status && (
                      <div>
                        <strong>Loan Status:</strong> 
                        <span style={{ 
                          marginLeft: "5px",
                          padding: "2px 6px", 
                          borderRadius: "3px", 
                          fontSize: "11px",
                          backgroundColor: 
                            appointment.loan_status === 'P' ? '#e8f5e8' :
                            appointment.loan_status === 'PRS' ? '#e3f2fd' :
                            appointment.loan_status === 'RS' ? '#fff3e0' :
                            appointment.loan_status === 'R' ? '#ffebee' :
                            '#f5f5f5',
                          color: 
                            appointment.loan_status === 'P' ? '#2e7d32' :
                            appointment.loan_status === 'PRS' ? '#1976d2' :
                            appointment.loan_status === 'RS' ? '#ef6c00' :
                            appointment.loan_status === 'R' ? '#c62828' :
                            '#666'
                        }}>
                          {appointment.loan_status === 'P' ? 'Approved' :
                           appointment.loan_status === 'PRS' ? 'Customer Rejected' :
                           appointment.loan_status === 'RS' ? 'Rejected (Special)' :
                           appointment.loan_status === 'R' ? 'Rejected' :
                           appointment.loan_status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {appointment.notes && (
                    <div style={{ marginTop: "15px" }}>
                      <strong style={{ fontSize: "14px" }}>Notes:</strong>
                      <div style={{ 
                        marginTop: "5px", 
                        padding: "10px", 
                        backgroundColor: "#f5f5f5", 
                        borderRadius: "4px", 
                        fontSize: "14px",
                        lineHeight: "1.4"
                      }}>
                        {appointment.notes}
                      </div>
                    </div>
                  )}

                  {/* Loan Notes */}
                  {appointment.loan_notes && (
                    <div style={{ marginTop: "15px" }}>
                      <strong style={{ fontSize: "14px" }}>Loan Notes:</strong>
                      <div style={{ 
                        marginTop: "5px", 
                        padding: "10px", 
                        backgroundColor: "#fff3e0", 
                        borderRadius: "4px", 
                        fontSize: "14px",
                        lineHeight: "1.4"
                      }}>
                        {appointment.loan_notes}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              padding: "40px", 
              textAlign: "center", 
              backgroundColor: "#f8f9fa", 
              borderRadius: "8px", 
              color: "#666" 
            }}>
              <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <div>No appointments found</div>
              <div style={{ fontSize: "14px", marginTop: "5px" }}>
                <button
                  onClick={() => window.location.href = `/dashboard/borrowers/${borrowerId}/appointments`}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#1976d2",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Schedule the first appointment
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Update Modal */}
      <BorrowerStatusUpdateModal
        isOpen={showStatusModal}
        onClose={handleModalClose}
        borrower={borrower && {
          id: borrower.id,
          full_name: borrower.full_name,
          phone_number: borrower.phone_number,
          status: borrower.status
        }}
        preSelectedStatus={preSelectedStatus}
        onUpdate={handleModalUpdate}
        showNotification={showNotification}
      />

      {/* Questionnaire Modal */}
      <BorrowerQuestionnaireModal
        isOpen={showQuestionnaireModal}
        onClose={() => setShowQuestionnaireModal(false)}
        borrower={borrower}
        onUpdate={handleQuestionnaireUpdate}
      />

      {/* Notification Toast */}
      {notification && (
        <div style={{ 
          position: "fixed", 
          top: "20px", 
          right: "20px", 
          zIndex: 2000, 
          maxWidth: "400px",
          backgroundColor: notification.type === 'success' ? "#d4edda" : 
                           notification.type === 'error' ? "#f8d7da" : "#d1ecf1",
          color: notification.type === 'success' ? "#155724" : 
                 notification.type === 'error' ? "#721c24" : "#0c5460",
          padding: "12px 16px",
          borderRadius: "8px",
          border: `1px solid ${notification.type === 'success' ? "#c3e6cb" : 
                                 notification.type === 'error' ? "#f5c6cb" : "#bee5eb"}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5" />}
            {notification.type === 'error' && <XCircleIcon className="h-5 w-5" />}
            {notification.type === 'info' && <InformationCircleIcon className="h-5 w-5" />}
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              {notification.message}
            </span>
          </div>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <XCircleIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Status Bucket Component
function StatusBucket({ title, value, description }: { title: string; value: any; description: string }) {
  const getStatusDisplay = (val: any) => {
    if (val === null || val === undefined) return { text: "NULL", color: "#9e9e9e", bg: "#f5f5f5" };
    if (val === "" || val === '') return { text: "EMPTY", color: "#ff9800", bg: "#fff3e0" };
    if (val === "Yes" || val === true) return { text: "YES", color: "#4caf50", bg: "#e8f5e8" };
    if (val === "No" || val === false) return { text: "NO", color: "#f44336", bg: "#ffebee" };
    return { text: String(val).toUpperCase(), color: "#2196f3", bg: "#e3f2fd" };
  };

  const status = getStatusDisplay(value);

  return (
    <div style={{
      padding: "12px",
      border: "1px solid #e0e0e0",
      borderRadius: "6px",
      textAlign: "center",
      backgroundColor: "#fafafa"
    }}>
      <div style={{ fontSize: "12px", fontWeight: "bold", color: "#666", marginBottom: "4px" }}>
        {title}
      </div>
      <div style={{
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: "bold",
        backgroundColor: status.bg,
        color: status.color,
        marginBottom: "6px"
      }}>
        {status.text}
      </div>
      <div style={{ fontSize: "10px", color: "#999", lineHeight: "1.2" }}>
        {description}
      </div>
    </div>
  );
}

// Loan Plan Card Component
function LoanPlanCard({ plan }: { plan: any }) {
  const planDetails = plan.plan_details;
  
  return (
    <div style={{
      padding: "20px",
      backgroundColor: "#fff",
      border: "1px solid #e0e0e0",
      borderRadius: "8px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.08)"
    }}>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <h4 style={{ 
          fontSize: "18px", 
          fontWeight: "600", 
          margin: "0 0 8px 0",
          color: "#333"
        }}>
          {plan.product_name || "Loan Plan"}
        </h4>
        <div style={{ display: "flex", gap: "20px", fontSize: "14px", color: "#666" }}>
          <div><strong>Loan ID:</strong> {plan.loan_id}</div>
          <div><strong>Estimated Reloan Amount:</strong> ${plan.estimated_reloan_amount || planDetails?.estimated_reloan_amount || "N/A"}</div>
        </div>
      </div>

      {/* Risk Status Badges */}
      {(planDetails?.has_bd === "Yes" || 
        planDetails?.has_bhv === "Yes" || 
        planDetails?.has_dnc === "Yes" || 
        planDetails?.is_overdue === "Yes") && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "8px", textTransform: "uppercase" }}>
            Risk Flags
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {planDetails?.has_bd === "Yes" && (
              <span style={{ 
                padding: "4px 8px", 
                backgroundColor: "#fff3cd", 
                color: "#856404", 
                borderRadius: "4px", 
                fontSize: "11px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <ExclamationTriangleIcon className="h-3 w-3" />
                BD Risk
              </span>
            )}
            {planDetails?.has_bhv === "Yes" && (
              <span style={{ 
                padding: "4px 8px", 
                backgroundColor: "#f8d7da", 
                color: "#721c24", 
                borderRadius: "4px", 
                fontSize: "11px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <XCircleIcon className="h-3 w-3" />
                BHV Risk
              </span>
            )}
            {planDetails?.has_dnc === "Yes" && (
              <span style={{ 
                padding: "4px 8px", 
                backgroundColor: "#d1ecf1", 
                color: "#0c5460", 
                borderRadius: "4px", 
                fontSize: "11px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <PhoneIcon className="h-3 w-3" />
                DNC Listed
              </span>
            )}
            {planDetails?.is_overdue === "Yes" && (
              <span style={{ 
                padding: "4px 8px", 
                backgroundColor: "#f5c6cb", 
                color: "#721c24", 
                borderRadius: "4px", 
                fontSize: "11px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <ClockIcon className="h-3 w-3" />
                Overdue
              </span>
            )}
          </div>
        </div>
      )}

      {/* Important Dates */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "8px", textTransform: "uppercase" }}>
          Important Dates
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
          {planDetails?.next_due_date && (
            <div>
              <div style={{ fontSize: "11px", color: "#666" }}>Next Due Date</div>
              <div style={{ fontSize: "13px", fontWeight: "500" }}>
                {new Date(planDetails.next_due_date).toLocaleDateString()}
              </div>
            </div>
          )}
          {planDetails?.loan_completed_date && (
            <div>
              <div style={{ fontSize: "11px", color: "#666" }}>Completion Date</div>
              <div style={{ fontSize: "13px", fontWeight: "500" }}>
                {new Date(planDetails.loan_completed_date).toLocaleDateString()}
              </div>
            </div>
          )}
          {/* <div>
            <div style={{ fontSize: "11px", color: "#666" }}>Plan Created</div>
            <div style={{ fontSize: "13px", fontWeight: "500" }}>
              {new Date(plan.created_at).toLocaleDateString()}
            </div>
          </div> */}
        </div>
      </div>

      {/* Comments - Top 3 Only */}
      {planDetails?.loan_comments && planDetails.loan_comments.length > 0 && (
        <div>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "8px", textTransform: "uppercase" }}>
            Recent Comments
          </div>
          <div style={{ 
            backgroundColor: "#f8f9fa", 
            padding: "12px", 
            borderRadius: "6px",
            borderLeft: "3px solid #6c757d"
          }}>
            {planDetails.loan_comments.slice(0, 3).map((comment: string, idx: number) => (
              <div key={idx} style={{ 
                fontSize: "13px", 
                lineHeight: "1.4", 
                marginBottom: idx < Math.min(planDetails.loan_comments.length, 3) - 1 ? "8px" : "0",
                paddingBottom: idx < Math.min(planDetails.loan_comments.length, 3) - 1 ? "8px" : "0",
                borderBottom: idx < Math.min(planDetails.loan_comments.length, 3) - 1 ? "1px solid #dee2e6" : "none"
              }}>
                "{comment}"
              </div>
            ))}
            {/* {planDetails.loan_comments.length > 3 && (
              <div style={{ 
                fontSize: "12px", 
                color: "#6c757d", 
                fontStyle: "italic",
                marginTop: "8px",
                textAlign: "center"
              }}>
                ... and {planDetails.loan_comments.length - 3} more comments
              </div>
            )} */}
          </div>
        </div>
      )}
    </div>
  );
} 