"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon, 
  CalendarIcon, 
  ClockIcon, 
  UserCircleIcon,
  PhoneIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { 
  getAppointmentById,
  updateAppointmentStatus,
  type AppointmentWithLead
} from '~/app/_actions/appointmentAction';
import { format, parseISO } from 'date-fns';

export default function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const appointmentId = parseInt(params.id);
  
  const [appointment, setAppointment] = useState<AppointmentWithLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        setLoading(true);
        const result = await getAppointmentById(appointmentId);
        
        if (result.success) {
          setAppointment(result.appointment);
        } else {
          setError(result.message || 'Failed to load appointment');
        }
      } catch (error) {
        console.error('Error loading appointment:', error);
        setError('An error occurred while loading the appointment');
      } finally {
        setLoading(false);
      }
    };
    
    void fetchAppointment();
  }, [appointmentId]);
  
  const handleStatusChange = async (newStatus: string) => {
    if (!appointment) return;
    
    const confirmationMessages: Record<string, string> = {
      'done': 'Mark this appointment as completed?',
      'missed': 'Mark this appointment as missed?', 
      'upcoming': 'Return this appointment to upcoming status?'
    };
    
    if (!confirm(confirmationMessages[newStatus] || `Change status to ${newStatus}?`)) {
      return;
    }
    
    setUpdatingStatus(true);
    
    try {
      const result = await updateAppointmentStatus(appointmentId, newStatus);
      
      if (result.success) {
        // Update the appointment in state
        setAppointment({
          ...appointment,
          status: newStatus
        });
      } else {
        alert(`Failed to update status: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating appointment status:', error);
      alert('An error occurred while updating the status');
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  const formatAppointmentDate = (date: Date) => {
    return format(date, 'EEEE, MMMM d, yyyy');
  };
  
  const formatAppointmentTime = (startTime: Date, endTime: Date) => {
    return `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`;
  };
  
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string, icon: React.ReactNode }> = {
      'upcoming': { 
        color: 'bg-blue-100 text-blue-800', 
        icon: <ClockIcon className="h-4 w-4 mr-1" /> 
      },
      'done': { 
        color: 'bg-green-100 text-green-800', 
        icon: <CheckCircleIcon className="h-4 w-4 mr-1" /> 
      },
      'missed': { 
        color: 'bg-red-100 text-red-800', 
        icon: <XCircleIcon className="h-4 w-4 mr-1" /> 
      },
      'cancelled': { 
        color: 'bg-gray-100 text-gray-800', 
        icon: <XCircleIcon className="h-4 w-4 mr-1" /> 
      }
    };
    
    const config = statusConfig[status] || statusConfig.upcoming;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${config.color}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }
  
  if (error || !appointment) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error || "Appointment not found"}</p>
        <button
          onClick={() => router.push("/dashboard/appointments")}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Appointments
        </button>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center">
        <button
          onClick={() => router.push("/dashboard/appointments")}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Appointment Details</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lead information sidebar */}
        <div>
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center">
              <UserCircleIcon className="h-5 w-5 mr-2 text-blue-600" />
              Lead Information
            </h2>
            
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">
                  {appointment.lead.first_name} {appointment.lead.last_name}
                </h3>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <PhoneIcon className="h-4 w-4 mr-2" />
                {appointment.lead.phone_number}
              </div>
              {appointment.lead.email && (
                <div className="flex items-center text-sm text-gray-600">
                  <EnvelopeIcon className="h-4 w-4 mr-2" />
                  {appointment.lead.email}
                </div>
              )}
              <div className="flex items-center text-sm text-gray-600">
                <div className="flex justify-between w-full">
                  <span>Status:</span>
                  <span className="font-medium">{appointment.lead.status}</span>
                </div>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="flex justify-between w-full">
                  <span>Type:</span>
                  <span>{appointment.lead.lead_type}</span>
                </div>
              </div>
              {appointment.lead.source && (
                <div className="flex items-center text-sm text-gray-600">
                  <div className="flex justify-between w-full">
                    <span>Source:</span>
                    <span>{appointment.lead.source}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={() => router.push(`/dashboard/leads/${appointment.lead.id}`)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View Lead Details
              </button>
            </div>
          </div>
          
          {/* Appointment Actions */}
          {appointment.status === 'upcoming' && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="font-semibold text-lg mb-4">Update Status</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleStatusChange('done')}
                  disabled={updatingStatus}
                  className="w-full flex items-center justify-center py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Mark as Completed
                </button>
                
                <button
                  onClick={() => handleStatusChange('missed')}
                  disabled={updatingStatus}
                  className="w-full flex items-center justify-center py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircleIcon className="h-5 w-5 mr-2" />
                  Mark as Missed
                </button>
              </div>
            </div>
          )}
          
          {/* Allow returning to upcoming status if missed */}
          {appointment.status === 'missed' && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <button
                onClick={() => handleStatusChange('upcoming')}
                disabled={updatingStatus}
                className="w-full flex items-center justify-center py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <ClockIcon className="h-5 w-5 mr-2" />
                Return to Upcoming
              </button>
            </div>
          )}
        </div>
        
        {/* Appointment details */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-semibold">Appointment Details</h2>
              {getStatusBadge(appointment.status)}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <CalendarIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
                <div>
                  <h3 className="font-medium">Date & Time</h3>
                  <p className="text-gray-700">{formatAppointmentDate(appointment.start_datetime)}</p>
                  <p className="text-gray-700">{formatAppointmentTime(appointment.start_datetime, appointment.end_datetime)}</p>
                </div>
              </div>
              
              {appointment.is_urgent && (
                <div className="flex items-start">
                  <ExclamationCircleIcon className="h-5 w-5 text-amber-500 mt-0.5 mr-3" />
                  <div>
                    <h3 className="font-medium">Priority</h3>
                    <p className="text-amber-700">This appointment is marked as urgent</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start">
                <ClockIcon className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
                <div>
                  <h3 className="font-medium">Created</h3>
                  <p className="text-gray-700">{format(new Date(appointment.created_at), 'MMM d, yyyy, h:mm a')}</p>
                </div>
              </div>
              
              {appointment.notes && (
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <h3 className="font-medium mb-2">Notes</h3>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-gray-700 whitespace-pre-wrap">{appointment.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}