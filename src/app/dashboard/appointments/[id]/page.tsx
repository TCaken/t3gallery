"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { fetchUserData } from '~/app/_actions/userActions';
import { 
  ArrowLeftIcon, 
  CalendarIcon, 
  ClockIcon, 
  UserIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';

// Types
type Appointment = {
  id: number;
  lead_id: number;
  agent_id: string;
  status: string;
  loan_status: string | null;
  loan_notes: string | null;
  notes: string | null;
  lead_source: string | null;
  start_datetime: Date;
  end_datetime: Date;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  // Related data
  lead?: {
    id: number;
    full_name: string;
    phone_number: string;
    email: string | null;
    status: string;
  };
  agent?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
};

type User = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export default function AppointmentEditPage() {
  const params = useParams();
  const router = useRouter();
  const { userId, isLoaded } = useAuth();
  const appointmentId = parseInt(params.id as string);
  
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<{roleId: number, roleName: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  // Form state
  const [agentId, setAgentId] = useState('');
  const [loanStatus, setLoanStatus] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [rsReason, setRsReason] = useState('');
  
  // Check if user is admin
  const isAdmin = userRoles.some(role => role.roleName === 'admin');

  // Load user roles
  useEffect(() => {
    const loadUserRoles = async () => {
      if (isLoaded && userId) {
        try {
          const { roles } = await fetchUserData();
          setUserRoles(roles);
        } catch (error) {
          console.error('Error fetching user roles:', error);
        }
      }
    };

    void loadUserRoles();
  }, [isLoaded, userId]);

  // Load appointment data
  useEffect(() => {
    const loadAppointmentData = async () => {
      try {
        setLoading(true);
        
        // Load appointment details
        const appointmentResponse = await fetch(`/api/appointments/${appointmentId}`);
        if (!appointmentResponse.ok) {
          throw new Error('Failed to load appointment');
        }
        const appointmentData = await appointmentResponse.json();
        setAppointment(appointmentData);
        
        // Set form state
        setAgentId(appointmentData.agent_id ?? '');
        setLoanStatus(appointmentData.loan_status || '');
        setLoanNotes(appointmentData.loan_notes || '');
        
        // Load users for dropdowns
        const usersResponse = await fetch('/api/users');
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData);
        }
        
      } catch (err) {
        console.error('Error loading appointment data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load appointment');
      } finally {
        setLoading(false);
      }
    };

    if (appointmentId) {
      void loadAppointmentData();
    }
  }, [appointmentId]);

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      showNotification('Only administrators can edit appointments', 'error');
      return;
    }

    setSaving(true);
    
    try {
      const updateData = {
        agent_id: agentId,
        loan_status: loanStatus || null,
        loan_notes: loanNotes || null,
        updated_by: userId
      };

      // Loan notes are now automatically updated based on loan status selection

      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        throw new Error(errorData.message ?? 'Failed to update appointment');
      }

      const updatedAppointment = await response.json();
      setAppointment(updatedAppointment);
      showNotification('Appointment updated successfully!', 'success');
      router.back();
      
    } catch (err) {
      console.error('Error updating appointment:', err);
      showNotification(err instanceof Error ? err.message : 'Failed to update appointment', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Format date/time for display
  const formatDateTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: "bg-blue-100 text-blue-800",
      done: "bg-green-100 text-green-800",
      missed: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800"
    };
    return colors[status] ?? "bg-gray-100 text-gray-800";
  };

  // Get loan status badge color
  const getLoanStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      P: "bg-green-100 text-green-800",
      PRS: "bg-blue-100 text-blue-800", 
      RS: "bg-orange-100 text-orange-800",
      R: "bg-red-100 text-red-800"
    };
    return colors[status] ?? "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-gray-500">Loading appointment...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Appointment</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Appointment Not Found</h2>
          <p className="text-yellow-600 mb-4">The requested appointment could not be found.</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600 mb-4">Only administrators can edit appointments.</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          notification.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5 mr-2" />}
            {notification.type === 'error' && <XCircleIcon className="h-5 w-5 mr-2" />}
            {notification.type === 'info' && <InformationCircleIcon className="h-5 w-5 mr-2" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center">
        <button
          onClick={() => router.back()}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Edit Appointment #{appointment.id}</h1>
          <p className="text-gray-600">Admin Edit Mode</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointment Details */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
            Appointment Details
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
              <div className="flex items-center text-gray-900">
                <ClockIcon className="h-4 w-4 mr-2 text-gray-500" />
                {formatDateTime(appointment.start_datetime)}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <div className="text-gray-900">
                {format(parseISO(appointment.start_datetime.toString()), 'h:mm a')} - {format(parseISO(appointment.end_datetime.toString()), 'h:mm a')}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(appointment.status)}`}>
                {appointment.status.toUpperCase()}
              </span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
              <div className="text-gray-900">{appointment.lead_source || 'N/A'}</div>
            </div>
            
            {appointment.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <div className="text-gray-900 bg-gray-50 p-3 rounded-md">{appointment.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Lead Information */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <UserIcon className="h-5 w-5 mr-2 text-green-600" />
            Lead Information
          </h2>
          
          {appointment.lead ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <div className="text-gray-900">{appointment.lead.full_name}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <div className="text-gray-900">{appointment.lead.phone_number}</div>
              </div>
              
              {appointment.lead.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="text-gray-900">{appointment.lead.email}</div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead Status</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(appointment.lead.status)}`}>
                  {appointment.lead.status.toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 italic">Lead information not available</div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <PencilIcon className="h-5 w-5 mr-2 text-purple-600" />
          Edit Appointment
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agent Assignment */}
            <div>
              <label htmlFor="agentId" className="block text-sm font-medium text-gray-700 mb-2">
                Assigned Agent *
              </label>
              <select
                id="agentId"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select an agent</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loan Status */}
          <div>
            <label htmlFor="loanStatus" className="block text-sm font-medium text-gray-700 mb-2">
              Loan Status
            </label>
            <select
              id="loanStatus"
              value={loanStatus}
              onChange={(e) => {
                const status = e.target.value;
                setLoanStatus(status);
                
                // Auto-update loan notes based on status
                let newLoanNotes = '';
                switch (status) {
                  case 'P':
                    newLoanNotes = 'P - Done';
                    break;
                  case 'PRS':
                    newLoanNotes = 'P - Customer Rejected';
                    break;
                  case 'R':
                    newLoanNotes = 'R - Rejected';
                    break;
                  case 'RS':
                    // For RS, we'll wait for the reason to be filled
                    newLoanNotes = 'RS - Rejected With Special Reason - ';
                    break;
                  default:
                    newLoanNotes = '';
                }
                
                setLoanNotes(newLoanNotes);
                
                if (status !== 'RS') {
                  setRsReason('');
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select loan status</option>
              <option value="P">P - Done</option>
              <option value="PRS">PRS - Customer Rejected</option>
              <option value="RS">RS - Rejected With Special Reason - </option>
              <option value="R">R - Rejected</option>
            </select>
          </div>

          {/* RS Reason (only show if loan status is RS) */}
          {loanStatus === 'RS' && (
            <div>
              <label htmlFor="rsReason" className="block text-sm font-medium text-gray-700 mb-2">
                RS Reason *
              </label>
              <textarea
                id="rsReason"
                value={rsReason}
                onChange={(e) => {
                  const reason = e.target.value;
                  setRsReason(reason);
                  if (loanStatus === 'RS') {
                    setLoanNotes(`RS - ${reason}`);
                  }
                }}
                placeholder="Please provide the reason for RS (Rejected Special) status..."
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={loanStatus === 'RS'}
              />
            </div>
          )}

          {/* Loan Notes */}
          <div>
            <label htmlFor="loanNotes" className="block text-sm font-medium text-gray-700 mb-2">
              Loan Notes
            </label>
            <textarea
              id="loanNotes"
              value={loanNotes}
              onChange={(e) => setLoanNotes(e.target.value)}
              placeholder="Enter any additional loan notes..."
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
