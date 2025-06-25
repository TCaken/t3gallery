"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getBorrower } from "~/app/_actions/borrowers";
import { getBorrowerLoanPlans } from "~/app/_actions/borrowerSync";
import { getBorrowerActions } from "~/app/_actions/borrowers";
import { getBorrowerAppointments } from "~/app/_actions/borrowerAppointments";

import BorrowerActionButtons from "~/app/_components/BorrowerActionButtons";
import BorrowerCommunicationPreferences from "~/app/_components/BorrowerCommunicationPreferences";

export default function BorrowerDetailPage() {
  const params = useParams();
  const borrowerId = parseInt(params.id as string);
  
  const [borrower, setBorrower] = useState<any>(null);
  const [loanPlans, setLoanPlans] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState<string>("");


  useEffect(() => {
    const fetchBorrowerData = async () => {
      try {
        setLoading(true);
        
        // Fetch borrower details
        const borrowerResult = await getBorrower(borrowerId);
        if (borrowerResult.success) {
          setBorrower(borrowerResult.data);
        }

        // Fetch loan plans
        const loanPlansResult = await getBorrowerLoanPlans(borrowerId);
        if (loanPlansResult.success) {
          setLoanPlans(loanPlansResult.data);
        }

        // Fetch actions/history
        const actionsResult = await getBorrowerActions(borrowerId);
        if (actionsResult.success) {
          setActions(actionsResult.data);
        }

        // Fetch appointments
        const appointmentsResult = await getBorrowerAppointments({ borrower_id: borrowerId });
        if (appointmentsResult.success) {
          setAppointments(appointmentsResult.data);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-SG", {
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
      return { source: "Attrition Risk", priority: "high", color: "#f44336" };
    }
    if (borrower?.is_in_last_payment_due === "Yes") {
      return { source: "Last Payment Due", priority: "medium", color: "#9c27b0" };
    }
    if (borrower?.is_in_bhv1 === "Yes") {
      return { source: "BHV1 Pattern", priority: "low", color: "#607d8b" };
    }
    
    // Default fallback
    return { source: "Standard", priority: "low", color: "#9e9e9e" };
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

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
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
            {borrower.assigned_agent_name && (
              <div style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}>
                Assigned to: {borrower.assigned_agent_name}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
          <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>PRIMARY LOAN</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
              {borrower.loan_product || "No Active Loan"}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              {borrower.loan_id && `ID: ${borrower.loan_id}`}
            </div>
          </div>
          
          <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>LOAN AMOUNT</div>
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
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>TOTAL LOAN PLANS</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
              {loanPlans.length}
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
                  with {upcomingAppointment.agent_name}
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
                fontWeight: "500"
              }}
            >
              📅 Manage Appointments
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
                  {formatDate(borrower.follow_up_date)}
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
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ borderBottom: "2px solid #e9ecef", display: "flex", gap: "20px" }}>
          {[
            { id: "overview", label: "Overview" },
            { id: "loan_plans", label: `Loan Plans (${loanPlans.length})` },
            { id: "financial", label: "Financial Info" },
            { id: "appointments", label: `Appointments (${appointments.length})` },
            { id: "history", label: `History (${actions.length})` },
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
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Basic Information */}
          <div style={{ 
            padding: "20px", 
            backgroundColor: "#fff", 
            borderRadius: "8px", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)" 
          }}>
            <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
              📋 Basic Information
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div><strong>Full Name:</strong> {borrower.full_name}</div>
              <div>
                <strong>Phone Numbers:</strong>
                <div style={{ marginLeft: "10px", fontSize: "14px" }}>
                  <div>Primary: {borrower.phone_number}</div>
                  <div>Secondary: {borrower.phone_number_2 ?? "N/A"}</div>
                  <div>Tertiary: {borrower.phone_number_3 ?? "N/A"}</div>
                </div>
              </div>
              <div><strong>Email:</strong> {borrower.email ?? "N/A"}</div>
              <div><strong>Residential Status:</strong> {borrower.residential_status ?? "N/A"}</div>
              <div><strong>Source:</strong> {borrower.source ?? "N/A"}</div>
              <div><strong>Latest Loan Completed:</strong> {formatDate(borrower.latest_completed_loan_date)}</div>
              <div><strong>Created:</strong> {formatDateTime(borrower.created_at)}</div>
              <div><strong>Last Updated:</strong> {formatDateTime(borrower.updated_at)}</div>
            </div>
          </div>

          {/* Identity & Documentation */}
          <div style={{ 
            padding: "20px", 
            backgroundColor: "#fff", 
            borderRadius: "8px", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)" 
          }}>
            <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
              🆔 Identity & Documentation
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <strong>AA Status:</strong> 
                <span style={{ 
                  marginLeft: "10px",
                  padding: "4px 8px", 
                  borderRadius: "4px", 
                  fontSize: "12px",
                  backgroundColor: borrower.aa_status === "yes" ? "#d4edda" : 
                                 borrower.aa_status === "no" ? "#f8d7da" : "#fff3cd",
                  color: borrower.aa_status === "yes" ? "#155724" : 
                         borrower.aa_status === "no" ? "#721c24" : "#856404"
                }}>
                  {borrower.aa_status.toUpperCase()}
                </span>
              </div>
              <div><strong>Has DNC:</strong> {borrower.is_dnc ? "Yes" : "No"}</div>
              <div><strong>ID Type:</strong> {borrower.id_type.replace("_", " ").toUpperCase()}</div>
              <div><strong>ID Number:</strong> {borrower.id_number || "N/A"}</div>
              <div><strong>Income Document Type:</strong> {borrower.income_document_type.replace("_", " ").toUpperCase()}</div>
              <div><strong>Current Employer:</strong> {borrower.current_employer ?? "N/A"}</div>
              <div><strong>Average Monthly Income:</strong> ${borrower.average_monthly_income ?? "N/A"}</div>
              <div><strong>Annual Income:</strong> ${borrower.annual_income ?? "N/A"}</div>
              <div><strong>Estimated Reloan Amount:</strong> ${borrower.estimated_reloan_amount ?? "N/A"}</div>
            </div>
          </div>

          {/* Interactive Communication Preferences Component */}
          <BorrowerCommunicationPreferences
            borrowerId={borrowerId}
            currentContactPreference={borrower.contact_preference}
            currentCommunicationLanguage={borrower.communication_language}
                       onSuccess={() => {
               // Refresh the page data after updating preferences
               window.location.reload();
             }}
          />

          {/* System Information */}
          <div style={{ 
            padding: "20px", 
            backgroundColor: "#fff", 
            borderRadius: "8px", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)" 
          }}>
            <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
              ⚙️ System Information
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <strong>Assigned Agent:</strong>{" "}
                {borrower.assigned_agent_name ? (
                  <span style={{ 
                    color: "#1976d2", 
                    fontWeight: "500" 
                  }}>
                    {borrower.assigned_agent_name}
                  </span>
                ) : (
                  <span style={{ color: "#666", fontStyle: "italic" }}>Unassigned</span>
                )}
                {borrower.assigned_agent_email && (
                  <div style={{ fontSize: "12px", color: "#666", marginLeft: "10px" }}>
                    {borrower.assigned_agent_email}
                  </div>
                )}
              </div>
              
              <div>
                <strong>Follow-up Date:</strong>{" "}
                {borrower.follow_up_date ? (
                  <span style={{ 
                    color: new Date(borrower.follow_up_date) < new Date() ? "#f44336" : "#4caf50",
                    fontWeight: "500"
                  }}>
                    {formatDateTime(borrower.follow_up_date)}
                    {new Date(borrower.follow_up_date) < new Date() && (
                      <span style={{ marginLeft: "8px", fontSize: "12px" }}>⚠️ OVERDUE</span>
                    )}
                  </span>
                ) : (
                  <span style={{ color: "#666", fontStyle: "italic" }}>Not scheduled</span>
                )}
              </div>

              <div>
                <strong>Lead Source:</strong>{" "}
                {(() => {
                  const leadSourceInfo = getLeadSource(borrower);
                  return (
                    <span style={{ 
                      color: leadSourceInfo.color,
                      fontWeight: "500",
                      padding: "4px 8px",
                      backgroundColor: `${leadSourceInfo.color}20`,
                      borderRadius: "4px",
                      fontSize: "13px"
                    }}>
                      {leadSourceInfo.source}
                      <span style={{ 
                        marginLeft: "6px", 
                        fontSize: "10px",
                        opacity: 0.8,
                        textTransform: "uppercase"
                      }}>
                        {leadSourceInfo.priority}
                      </span>
                    </span>
                  );
                })()}
              </div>

              <div>
                <strong>Credit Score:</strong>{" "}
                {borrower.credit_score ? (
                  <span style={{ fontWeight: "500" }}>{borrower.credit_score}</span>
                ) : (
                  <span style={{ color: "#666", fontStyle: "italic" }}>Not available</span>
                )}
              </div>

              <div>
                <strong>Lead Score:</strong>{" "}
                <span style={{ 
                  fontWeight: "500",
                  color: borrower.lead_score >= 75 ? "#4caf50" : 
                         borrower.lead_score >= 50 ? "#ff9800" : "#f44336"
                }}>
                  {borrower.lead_score}/100
                </span>
              </div>

              <div>
                <strong>System Status:</strong>{" "}
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(borrower.status)}`}>
                  {borrower.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Status Buckets */}
          <div style={{ 
            padding: "20px", 
            backgroundColor: "#fff", 
            borderRadius: "8px", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            gridColumn: "1 / -1",
            marginBottom: "20px"
          }}>
            <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
              📊 Customer Performance Buckets
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              <StatusBucket 
                title="Closed Loan"
                value={borrower.is_in_closed_loan}
                description="Customer has closed/completed loans"
              />
              <StatusBucket 
                title="2nd Reloan"
                value={borrower.is_in_2nd_reloan}
                description="Customer is in second reloan cycle"
              />
              <StatusBucket 
                title="Attrition"
                value={borrower.is_in_attrition}
                description="Customer showing signs of leaving"
              />
              <StatusBucket 
                title="Last Payment Due"
                value={borrower.is_in_last_payment_due}
                description="Customer on final payment"
              />
              <StatusBucket 
                title="BHV1"
                value={borrower.is_in_bhv1}
                description="Customer behavioral pattern 1"
              />
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ gridColumn: "1 / -1", marginBottom: "20px" }}>
            <BorrowerActionButtons
              borrowerId={borrowerId}
              onAction={(action, id) => {
                // Handle action responses - for now just refresh
                console.log(`Action ${action} performed on borrower ${id}`);
                window.location.reload();
              }}
              isPinned={false} // This would come from pinned borrowers data
              currentStatus={borrower.status}
              phoneNumber={borrower.phone_number}
              borrowerName={borrower.full_name}
              onSuccess={() => {
                window.location.reload();
              }}
            />
          </div>

          {/* Current Primary Loan */}
          <div style={{ 
            padding: "20px", 
            backgroundColor: "#fff", 
            borderRadius: "8px", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            gridColumn: "1 / -1"
          }}>
            <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
              💰 Current Primary Loan
            </h3>
            {borrower.loan_id ? (
              <div style={{ 
                padding: "15px", 
                backgroundColor: "#e3f2fd", 
                border: "1px solid #2196f3", 
                borderRadius: "6px" 
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
                  <div><strong>Loan ID:</strong> {borrower.loan_id}</div>
                  <div><strong>Product:</strong> {borrower.loan_product}</div>
                  <div><strong>Amount:</strong> ${borrower.loan_amount}</div>
                  <div><strong>Status:</strong> {borrower.loan_status || "Active"}</div>
                  <div><strong>Next Due:</strong> {formatDate(borrower.next_due_date)}</div>
                  <div><strong>Completed:</strong> {formatDate(borrower.loan_completed_date)}</div>
                  <div><strong>Latest Completed:</strong> {formatDate(borrower.latest_completed_loan_date)}</div>
                  <div>
                    <strong>Has DNC:</strong> 
                    <span style={{ 
                      marginLeft: "5px",
                      padding: "2px 6px", 
                      borderRadius: "3px", 
                      fontSize: "11px",
                      backgroundColor: borrower.is_dnc ? "#ffebee" : "#e8f5e8",
                      color: borrower.is_dnc ? "#c62828" : "#2e7d32"
                    }}>
                      {borrower.is_dnc ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
                
                {/* Loan Flags */}
                <div style={{ marginTop: "15px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {borrower.is_bd_loan && (
                    <span style={{ padding: "4px 8px", backgroundColor: "#ff9800", color: "white", borderRadius: "4px", fontSize: "12px" }}>
                      BD LOAN
                    </span>
                  )}
                  {borrower.is_bhv1_loan && (
                    <span style={{ padding: "4px 8px", backgroundColor: "#f44336", color: "white", borderRadius: "4px", fontSize: "12px" }}>
                      BHV1 LOAN
                    </span>
                  )}
                  {borrower.is_overdue_loan && (
                    <span style={{ padding: "4px 8px", backgroundColor: "#d32f2f", color: "white", borderRadius: "4px", fontSize: "12px" }}>
                      OVERDUE
                    </span>
                  )}
                  {borrower.is_dnc && (
                    <span style={{ padding: "4px 8px", backgroundColor: "#424242", color: "white", borderRadius: "4px", fontSize: "12px" }}>
                      DNC
                    </span>
                  )}
                </div>

                {borrower.loan_notes && (
                  <div style={{ marginTop: "15px" }}>
                    <strong>Notes:</strong>
                    <div style={{ 
                      marginTop: "5px", 
                      padding: "10px", 
                      backgroundColor: "#f5f5f5", 
                      borderRadius: "4px", 
                      fontSize: "14px",
                      maxHeight: "100px",
                      overflowY: "auto"
                    }}>
                      {borrower.loan_notes}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ 
                padding: "20px", 
                textAlign: "center", 
                backgroundColor: "#f8f9fa", 
                borderRadius: "6px", 
                color: "#666" 
              }}>
                No active loan information available
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "loan_plans" && (
        <div>
          <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333" }}>
            📄 Loan Plans ({loanPlans.length})
          </h3>
          
          {primaryLoanPlan && (
            <div style={{ marginBottom: "30px" }}>
              <h4 style={{ fontSize: "16px", marginBottom: "10px", color: "#007bff" }}>
                🎯 Primary Loan Plan (Active/Selected)
              </h4>
              <LoanPlanCard plan={primaryLoanPlan} isPrimary={true} />
            </div>
          )}

          {otherLoanPlans.length > 0 && (
            <div>
              <h4 style={{ fontSize: "16px", marginBottom: "10px", color: "#666" }}>
                📚 Other Loan Plans
              </h4>
              <div style={{ display: "grid", gap: "15px" }}>
                {otherLoanPlans.map((plan) => (
                  <LoanPlanCard key={plan.id} plan={plan} isPrimary={false} />
                ))}
              </div>
            </div>
          )}

          {loanPlans.length === 0 && (
            <div style={{ 
              padding: "40px", 
              textAlign: "center", 
              backgroundColor: "#f8f9fa", 
              borderRadius: "8px", 
              color: "#666" 
            }}>
              <div style={{ fontSize: "18px", marginBottom: "10px" }}>📄</div>
              <div>No loan plans found for this borrower</div>
              <div style={{ fontSize: "14px", marginTop: "5px" }}>
                Loan plans will appear here after syncing with external API
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "financial" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Employment Information */}
          <div style={{ 
            padding: "20px", 
            backgroundColor: "#fff", 
            borderRadius: "8px", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)" 
          }}>
            <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
              💼 Employment Information
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div><strong>Current Employer:</strong> {borrower.current_employer || "N/A"}</div>
              <div><strong>Average Monthly Income:</strong> ${borrower.average_monthly_income || "N/A"}</div>
              <div><strong>Annual Income:</strong> ${borrower.annual_income || "N/A"}</div>
              <div><strong>Income Document Type:</strong> {borrower.income_document_type.replace("_", " ").toUpperCase()}</div>
            </div>
          </div>

          {/* Financial Assessment */}
          <div style={{ 
            padding: "20px", 
            backgroundColor: "#fff", 
            borderRadius: "8px", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)" 
          }}>
            <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
              📊 Financial Assessment
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div><strong>Credit Score:</strong> {borrower.credit_score || "N/A"}</div>
              <div><strong>Lead Score:</strong> {borrower.lead_score}/100</div>
              <div><strong>Estimated Reloan Amount:</strong> ${borrower.estimated_reloan_amount || "N/A"}</div>
              <div>
                <strong>Financial Commitment Change:</strong> 
                <span style={{ marginLeft: "5px" }}>
                  {borrower.financial_commitment_change.replace("_", " ").toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Communication Preferences */}
          <div style={{ 
            padding: "20px", 
            backgroundColor: "#fff", 
            borderRadius: "8px", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            gridColumn: "1 / -1"
          }}>
            <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
              📞 Communication Preferences
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "15px" }}>
              <div><strong>Contact Preference:</strong> {borrower.contact_preference}</div>
              <div><strong>Communication Language:</strong> {borrower.communication_language}</div>
              {borrower.follow_up_date && (
                <div><strong>Follow-up Date:</strong> {formatDateTime(borrower.follow_up_date)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div>
          <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333" }}>
            📜 Action History ({actions.length})
          </h3>
          
          {actions.length > 0 ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {actions.map((action) => (
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
                        by {action.user_first_name} {action.user_last_name}
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
              <div style={{ fontSize: "18px", marginBottom: "10px" }}>📜</div>
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
          <h3 style={{ fontSize: "20px", marginBottom: "20px", color: "#333" }}>
            📅 Appointments ({appointments.length})
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
                fontWeight: "500"
              }}
            >
              📅 Manage Appointments
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
                          {appointment.appointment_type?.replace('_', ' ').toUpperCase() || 'GENERAL'}
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
                        <strong>Agent:</strong> {appointment.agent_first_name} {appointment.agent_last_name}
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
              <div style={{ fontSize: "18px", marginBottom: "10px" }}>📅</div>
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
function LoanPlanCard({ plan, isPrimary }: { plan: any; isPrimary: boolean }) {
  const planDetails = plan.plan_details;
  
  return (
    <div style={{
      padding: "20px",
      backgroundColor: isPrimary ? "#e3f2fd" : "#fff",
      border: isPrimary ? "2px solid #2196f3" : "1px solid #e0e0e0",
      borderRadius: "8px",
      position: "relative"
    }}>
      {isPrimary && (
        <div style={{
          position: "absolute",
          top: "-10px",
          left: "15px",
          padding: "4px 12px",
          backgroundColor: "#2196f3",
          color: "white",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "bold"
        }}>
          PRIMARY LOAN
        </div>
      )}
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: isPrimary ? "10px" : "0" }}>
        <div><strong>Loan ID:</strong> {plan.loan_id}</div>
        <div><strong>Product:</strong> {plan.plan_name}</div>
        <div><strong>Amount:</strong> ${plan.loan_amount || planDetails?.estimated_reloan_amount || "N/A"}</div>
        <div>
          <strong>Status:</strong> 
          <span style={{ color: planDetails?.is_overdue === "Yes" ? "#d32f2f" : planDetails?.loan_completed_date ? "#666" : "#4caf50", marginLeft: "5px" }}>
            {planDetails?.is_overdue === "Yes" ? "Overdue" : 
             planDetails?.loan_completed_date ? "Completed" : "Active"}
          </span>
        </div>
        <div><strong>Next Due:</strong> {planDetails?.next_due_date ? new Date(planDetails.next_due_date).toLocaleDateString() : "N/A"}</div>
        <div><strong>Completed:</strong> {planDetails?.loan_completed_date ? new Date(planDetails.loan_completed_date).toLocaleDateString() : "N/A"}</div>
        <div><strong>Created:</strong> {new Date(plan.created_at).toLocaleDateString()}</div>
        <div><strong>Is Selected:</strong> 
          <span style={{ 
            marginLeft: "5px",
            padding: "2px 6px", 
            borderRadius: "3px", 
            fontSize: "10px",
            backgroundColor: plan.is_selected ? "#e8f5e8" : "#fff3e0",
            color: plan.is_selected ? "#2e7d32" : "#ef6c00"
          }}>
            {plan.is_selected ? "PRIMARY" : "SECONDARY"}
          </span>
        </div>
      </div>

      {/* Extended Loan Details */}
      <div style={{ marginTop: "15px", padding: "12px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
        <h5 style={{ fontSize: "14px", marginBottom: "10px", color: "#555" }}>📋 Extended Details</h5>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", fontSize: "13px" }}>
          <div><strong>Has BD:</strong> <span style={{ color: planDetails?.has_bd === "Yes" ? "#d32f2f" : "#4caf50" }}>{planDetails?.has_bd || "N/A"}</span></div>
          <div><strong>Has BHV:</strong> <span style={{ color: planDetails?.has_bhv === "Yes" ? "#d32f2f" : "#4caf50" }}>{planDetails?.has_bhv || "N/A"}</span></div>
          <div><strong>Has DNC:</strong> <span style={{ color: planDetails?.has_dnc === "Yes" ? "#d32f2f" : "#4caf50" }}>{planDetails?.has_dnc || "N/A"}</span></div>
          <div><strong>Interest Rate:</strong> {plan.interest_rate || "N/A"}</div>
          <div><strong>Loan Tenure:</strong> {plan.loan_tenure || "N/A"}</div>
          <div><strong>Monthly Installment:</strong> {plan.monthly_installment || "N/A"}</div>
        </div>
      </div>

      {planDetails && (
        <div style={{ marginTop: "15px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
            {planDetails.has_bd === "Yes" && (
              <span style={{ padding: "4px 8px", backgroundColor: "#ff9800", color: "white", borderRadius: "4px", fontSize: "12px" }}>
                BD
              </span>
            )}
            {planDetails.has_bhv === "Yes" && (
              <span style={{ padding: "4px 8px", backgroundColor: "#f44336", color: "white", borderRadius: "4px", fontSize: "12px" }}>
                BHV
              </span>
            )}
            {planDetails.has_dnc === "Yes" && (
              <span style={{ padding: "4px 8px", backgroundColor: "#424242", color: "white", borderRadius: "4px", fontSize: "12px" }}>
                DNC
              </span>
            )}
            {planDetails.is_overdue === "Yes" && (
              <span style={{ padding: "4px 8px", backgroundColor: "#d32f2f", color: "white", borderRadius: "4px", fontSize: "12px" }}>
                OVERDUE
              </span>
            )}
          </div>

          {planDetails.next_due_date && (
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "5px" }}>
              <strong>Next Due:</strong> {new Date(planDetails.next_due_date).toLocaleDateString()}
            </div>
          )}

          {planDetails.loan_comments && planDetails.loan_comments.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <strong style={{ fontSize: "14px" }}>Recent Comments:</strong>
              <div style={{ 
                marginTop: "5px", 
                maxHeight: "100px", 
                overflowY: "auto", 
                backgroundColor: "#f5f5f5", 
                padding: "10px", 
                borderRadius: "4px",
                fontSize: "13px"
              }}>
                {planDetails.loan_comments.slice(0, 3).map((comment: string, idx: number) => (
                  <div key={idx} style={{ borderLeft: "2px solid #ddd", paddingLeft: "8px", marginBottom: "5px" }}>
                    {comment}
                  </div>
                ))}
                {planDetails.loan_comments.length > 3 && (
                  <div style={{ fontStyle: "italic", color: "#999", fontSize: "12px" }}>
                    ... and {planDetails.loan_comments.length - 3} more comments
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      <div style={{ fontSize: "12px", color: "#999", marginTop: "15px" }}>
        Created: {new Date(plan.created_at).toLocaleDateString()}
      </div>
    </div>
  );
} 