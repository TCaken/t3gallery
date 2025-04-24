"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MagnifyingGlassIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { 
  fetchAppointments,
  updateAppointmentStatus,
  type AppointmentWithLead
} from '~/app/_actions/appointmentAction';
import { format } from 'date-fns';

export default function RetailSearchPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [appointments, setAppointments] = useState<AppointmentWithLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  
  // Format phone number as user types
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits + and spaces
    const cleaned = e.target.value.replace(/[^\d\s+]/g, '');
    setPhoneNumber(cleaned);
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) return;
    
    setLoading(true);
    
    try {
      // Search for appointments with this phone number
      const searchQuery = phoneNumber.trim();
      const result = await fetchAppointments({ searchQuery });
      setAppointments(result);
      setSearched(true);
    } catch (error) {
      console.error('Error searching appointments:', error);
      alert('An error occurred while searching for appointments');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStatusChange = async (appointmentId: number, newStatus: string) => {
    // Confirm status change
    const confirmMessages: Record<string, string> = {
      'done': 'Mark this appointment as completed?',
      'missed': 'Mark this appointment as missed?',
      'upcoming': 'Move this appointment back to upcoming status?'
    };
    
    if (!confirm(confirmMessages[newStatus] || `Change status to ${newStatus}?`)) {
      return;
    }
    
    setUpdating(appointmentId);
    
    try {
      const result = await updateAppointmentStatus(appointmentId, newStatus);
      
      if (result.success) {
        // Update the local state
        setAppointments(prevAppointments => 
          prevAppointments.map(app => 
            app.id === appointmentId ? { ...app, status: newStatus } : app
          )
        );
      } else {
        alert(`Failed to update status: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating appointment status:', error);
      alert('An error occurred while updating the appointment status');
    } finally {
      setUpdating(null);
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
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  const filteredAppointments = appointments.filter(app => 
    ['upcoming', 'done', 'missed'].includes(app.status)
  );
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Appointment Search</h1>
        <p className="text-gray-600 mt-2">
          Search for appointments by phone number
        </p>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <PhoneIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              placeholder="Enter phone number"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !phoneNumber.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Searching...' : (
              <>
                <MagnifyingGlassIcon className="h-5 w-5 mr-1" />
                Search
              </>
            )}
          </button>
        </form>
      </div>
      
      {searched && (
        <div>
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                We couldn't find any appointments with this phone number.
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold mb-4">Found {filteredAppointments.length} appointments</h2>
              
              <div className="space-y-6">
                {filteredAppointments.map(appointment => (
                  <div key={appointment.id} className="bg-white shadow-md rounded-lg overflow-hidden">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {appointment.lead.first_name} {appointment.lead.last_name}
                          </h3>
                          <p className="text-gray-600">
                            {appointment.lead.phone_number}
                          </p>
                        </div>
                        {getStatusBadge(appointment.status)}
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex items-center mb-2">
                          <CalendarIcon className="h-5 w-5 text-gray-500 mr-2" />
                          <span>{formatAppointmentDate(appointment.start_datetime)}</span>
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="h-5 w-5 text-gray-500 mr-2" />
                          <span>{formatAppointmentTime(appointment.start_datetime, appointment.end_datetime)}</span>
                        </div>
                        
                        {appointment.is_urgent && (
                          <div className="mt-2 flex items-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                              Urgent
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {appointment.notes && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-700">{appointment.notes}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap justify-between items-center pt-3 border-t border-gray-200">
                        <div className="flex space-x-2 mt-2">
                          {appointment.status === 'upcoming' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(appointment.id, 'done')}
                                disabled={updating === appointment.id}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 disabled:opacity-50"
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Mark Done
                              </button>
                              
                              <button
                                onClick={() => handleStatusChange(appointment.id, 'missed')}
                                disabled={updating === appointment.id}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 disabled:opacity-50"
                              >
                                <XCircleIcon className="h-4 w-4 mr-1" />
                                Mark Missed
                              </button>
                            </>
                          )}
                          
                          {appointment.status === 'missed' && (
                            <button
                              onClick={() => handleStatusChange(appointment.id, 'upcoming')}
                              disabled={updating === appointment.id}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50"
                            >
                              <ClockIcon className="h-4 w-4 mr-1" />
                              Return to Upcoming
                            </button>
                          )}
                        </div>
                        
                        <button
                          onClick={() => router.push(`/dashboard/appointments/${appointment.id}`)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 mt-2"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-1" />
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
