"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MagnifyingGlassIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationCircleIcon,
  ChatBubbleLeftIcon,
  PencilSquareIcon,
  PaperAirplaneIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { 
  fetchAppointments,
  updateAppointmentStatus,
  type AppointmentWithLead
} from '~/app/_actions/appointmentAction';
import { format, startOfDay, endOfDay } from 'date-fns';
import { updateLeadStatus } from '~/app/_actions/leadActions';
import { addLeadComment, getLeadComments } from '~/app/_actions/commentActions';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from '~/server/db/schema';

type Lead = InferSelectModel<typeof leads>;

export default function RetailSearchPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [appointments, setAppointments] = useState<AppointmentWithLead[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentWithLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [showNoteInput, setShowNoteInput] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  // Format phone number as user types
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits + and spaces
    const cleaned = e.target.value.replace(/[^\d\s+]/g, '');
    setPhoneNumber(cleaned);
  };
  
  // Function to show notifications
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    // Auto-dismiss after 3 seconds
    setTimeout(() => setNotification(null), 3000);
  };

  // Load today's appointments on initial render
  useEffect(() => {
    const loadTodayAppointments = async () => {
      try {
        setLoading(true);
        const today = new Date();
        const result = await fetchAppointments({ 
          date: today,
          view: 'day',
          status: ['upcoming']
        });
        setTodayAppointments(result);
      } catch (error) {
        console.error('Error loading today\'s appointments:', error);
      } finally {
        setLoading(false);
      }
    };
    
    void loadTodayAppointments();
  }, []);
  
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
      showNotification('An error occurred while searching for appointments', 'error');
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
        setTodayAppointments(prevAppointments => 
          prevAppointments.filter(app => 
            app.id !== appointmentId || (app.id === appointmentId && newStatus === 'upcoming')
          )
        );
        showNotification(`Appointment marked as ${newStatus}`, 'success');
      } else {
        showNotification(`Failed to update status: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error updating appointment status:', error);
      showNotification('An error occurred while updating the appointment status', 'error');
    } finally {
      setUpdating(null);
    }
  };
  
  // Handle lead status change
  const handleLeadStatusChange = async (leadId: number, newStatus: string) => {
    if (!confirm(`Change lead status to ${newStatus}?`)) {
      return;
    }
    
    try {
      const result = await updateLeadStatus(leadId, newStatus);
      
      if (result.success) {
        // Update appointments with this lead
        setAppointments(prevAppointments => 
          prevAppointments.map(app => 
            app.lead.id === leadId 
              ? { ...app, lead: { ...app.lead, status: newStatus } } 
              : app
          )
        );
        setTodayAppointments(prevAppointments => 
          prevAppointments.map(app => 
            app.lead.id === leadId 
              ? { ...app, lead: { ...app.lead, status: newStatus } } 
              : app
          )
        );
        showNotification(`Lead status updated to ${newStatus}`, 'success');
      } else {
        showNotification(result.message || 'Failed to update lead status', 'error');
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
      showNotification('An error occurred while updating the lead status', 'error');
    }
  };
  
  // Handle adding a comment to a lead
  const handleAddComment = async (leadId: number) => {
    if (!note.trim()) {
      showNotification('Please enter a comment', 'error');
      return;
    }
    
    setAddingNote(true);
    
    try {
      const result = await addLeadComment(leadId, note);
      
      if (result.success) {
        setNote('');
        setShowNoteInput(null);
        showNotification('Comment added successfully', 'success');
      } else {
        showNotification(result.error || 'Failed to add comment', 'error');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      showNotification('An error occurred while adding the comment', 'error');
    } finally {
      setAddingNote(false);
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
      },
      // Lead status badges
      'P': { 
        color: 'bg-emerald-100 text-emerald-800', 
        icon: <CheckCircleIcon className="h-4 w-4 mr-1" /> 
      },
      'PRS': { 
        color: 'bg-teal-100 text-teal-800', 
        icon: <CheckCircleIcon className="h-4 w-4 mr-1" /> 
      },
      'R': { 
        color: 'bg-violet-100 text-violet-800', 
        icon: <CheckCircleIcon className="h-4 w-4 mr-1" /> 
      },
      'miss/RS': { 
        color: 'bg-pink-100 text-pink-800', 
        icon: <XCircleIcon className="h-4 w-4 mr-1" /> 
      }
    };
    
    // Default to upcoming if status is not in the config
    const defaultConfig = {
      color: 'bg-blue-100 text-blue-800',
      icon: <ClockIcon className="h-4 w-4 mr-1" />
    };
    
    const config = statusConfig[status] || defaultConfig;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  const getLeadStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string }> = {
      'new': { color: 'bg-blue-100 text-blue-800' },
      'assigned': { color: 'bg-cyan-100 text-cyan-800' },
      'no_answer': { color: 'bg-gray-100 text-gray-800' },
      'follow_up': { color: 'bg-indigo-100 text-indigo-800' },
      'P': { color: 'bg-emerald-100 text-emerald-800' },
      'PRS': { color: 'bg-teal-100 text-teal-800' },
      'R': { color: 'bg-violet-100 text-violet-800' },
      'miss/RS': { color: 'bg-pink-100 text-pink-800' },
      'booked': { color: 'bg-green-100 text-green-800' },
      'unqualified': { color: 'bg-orange-100 text-orange-800' },
      'give_up': { color: 'bg-red-100 text-red-800' },
      'blacklisted': { color: 'bg-black text-white' },
    };
    
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {status}
      </span>
    );
  };
  
  const filteredAppointments = appointments.filter(app => 
    ['upcoming', 'done', 'missed'].includes(app.status)
  );
  
  // Track which dropdown is currently open
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  
  // Toggle dropdown function
  const toggleStatusDropdown = (leadId: number) => {
    if (openDropdown === leadId) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(leadId);
    }
  };
  
  const renderAppointmentCard = (appointment: AppointmentWithLead) => {
    // Check if appointment has urgent flag
    const isUrgent = 'is_urgent' in appointment && appointment.is_urgent === true;
    
    return (
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
              <div className="mt-1">
                <span className="mr-2">Lead Status:</span>
                {getLeadStatusBadge(appointment.lead.status)}
              </div>
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
            
            {isUrgent && (
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
          
          {/* Add comment section */}
          {showNoteInput === appointment.lead.id ? (
            <div className="mb-4">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter your comment..."
                className="w-full p-2 border rounded-md text-sm"
                rows={3}
              />
              <div className="flex justify-end mt-2 space-x-2">
                <button
                  onClick={() => {
                    setShowNoteInput(null);
                    setNote('');
                  }}
                  className="px-2 py-1 text-xs border rounded text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleAddComment(appointment.lead.id)}
                  disabled={addingNote || !note.trim()}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingNote ? 'Adding...' : 'Add Comment'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNoteInput(appointment.lead.id)}
              className="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
              Add Comment
            </button>
          )}
          
          <div className="flex flex-wrap justify-between items-center pt-3 border-t border-gray-200">
            <div className="flex flex-wrap gap-2 mt-2">
              {/* Appointment status buttons */}
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
              
              {/* Lead status buttons */}
              <div className="relative inline-block text-left">
                <div>
                  <button
                    type="button"
                    onClick={() => toggleStatusDropdown(appointment.lead.id)}
                    className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
                    id={`lead-status-button-${appointment.lead.id}`}
                    aria-expanded={openDropdown === appointment.lead.id}
                    aria-haspopup="true"
                  >
                    <UserIcon className="h-4 w-4 mr-1" />
                    Change Lead Status
                  </button>
                </div>

                {openDropdown === appointment.lead.id && (
                  <div
                    className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby={`lead-status-button-${appointment.lead.id}`}
                    tabIndex={-1}
                  >
                    <div className="py-1" role="none">
                      {['miss/RS', 'R', 'P', 'PRS'].map(status => (
                        <button
                          key={status}
                          onClick={() => {
                            void handleLeadStatusChange(appointment.lead.id, status);
                            setOpenDropdown(null);
                          }}
                          className="text-gray-700 block w-full px-4 py-2 text-left text-xs hover:bg-gray-100"
                          role="menuitem"
                          tabIndex={-1}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
    );
  };
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
          notification.type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' :
          notification.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' :
          'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Retail Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage appointments and customer information
        </p>
      </div>
      
      {/* Today's Appointments Section */}
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
          Today's Upcoming Appointments
        </h2>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : todayAppointments.length > 0 ? (
          <div className="space-y-6">
            {todayAppointments.map(appointment => renderAppointmentCard(appointment))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-lg shadow">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments for today</h3>
            <p className="mt-1 text-sm text-gray-500">
              There are no upcoming appointments scheduled for today.
            </p>
          </div>
        )}
      </div>
      
      {/* Phone Number Search Section */}
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <PhoneIcon className="h-5 w-5 mr-2 text-blue-600" />
          Search Appointments by Phone Number
        </h2>
        
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
                  {filteredAppointments.map(appointment => renderAppointmentCard(appointment))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
