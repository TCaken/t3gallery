"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon, 
  CalendarIcon, 
  ClockIcon, 
  UsersIcon, 
  UserCircleIcon,
  PhoneIcon,
  EnvelopeIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { fetchLeadById } from '~/app/_actions/leadActions';
import { 
  checkExistingAppointment, 
  fetchAvailableTimeslots, 
  cancelAppointment,
  getAppointmentsForLead,
  type Timeslot,
  type EnhancedAppointment
} from '~/app/_actions/appointmentAction';
import { createAppointmentWorkflow } from '~/app/_actions/transactionOrchestrator';
import { type InferSelectModel } from 'drizzle-orm';
import { leads, appointments } from "~/server/db/schema";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns';

type Lead = InferSelectModel<typeof leads>;
type Appointment = EnhancedAppointment;

// Timezone utility functions
const getSystemTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const getSingaporeTime = (date: Date) => {
  return new Date(date.toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
};

const convertToUTC = (localDateTimeString: string) => {
  // Create a date from the string - this will be interpreted differently based on environment
  const localDate = new Date(localDateTimeString);
  
  // Get the system timezone
  const systemTimezone = getSystemTimezone();
  
  console.log('🕐 Enhanced Timezone Conversion Debug:');
  console.log('System timezone:', systemTimezone);
  console.log('Input datetime string:', localDateTimeString);
  console.log('Parsed date (system interpretation):', localDate.toISOString());
  
  // Create a more reliable conversion:
  // Parse the datetime components manually and create UTC time
  const [datePart, timePart] = localDateTimeString.split('T');
  const [year, month, day] = datePart!.split('-').map(Number);
  const [hour, minute, second = 0] = timePart!.split(':').map(Number);
  
  // Validate parsed components
  if (!year || !month || !day || hour === undefined || minute === undefined) {
    console.error('Invalid datetime components:', { year, month, day, hour, minute });
    return new Date(); // fallback to current time
  }
  
  // Create Singapore time explicitly
  const singaporeTime = new Date();
  singaporeTime.setFullYear(year, month - 1, day); // month is 0-indexed
  singaporeTime.setHours(hour, minute, second, 0);
  
  // Convert Singapore time (UTC+8) to UTC by subtracting 8 hours
  const utcTime = new Date(singaporeTime.getTime() - (8 * 60 * 60 * 1000));
  
  console.log('🌏 Manual parsing approach:');
  console.log('Date components:', { year, month, day, hour, minute, second });
  console.log('Singapore time:', singaporeTime.toISOString());
  console.log('Converted to UTC:', utcTime.toISOString());
  console.log('Display back in SGT:', getSingaporeTime(utcTime).toLocaleString());
  
  return utcTime;
};

const SingaporeTime = (utcDate: Date) => {
  const singaporeTime = getSingaporeTime(utcDate);
  console.log('🕘 Displaying time:');
  console.log('UTC input:', utcDate.toISOString());
  console.log('Singaporeformat time:', singaporeTime.toLocaleString());
  return singaporeTime;
};

export default function AppointmentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const leadId = parseInt(params.id);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [loadingLead, setLoadingLead] = useState(true);
  const [existingAppointment, setExistingAppointment] = useState<any>(null);
  const [hasAppointment, setHasAppointment] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeslot, setSelectedTimeslot] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [loadingTimeslots, setLoadingTimeslots] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Load lead info and check for existing appointments
  useEffect(() => {
    const loadLeadData = async () => {
      try {
        // Load lead info
        const leadResult = await fetchLeadById(leadId);
        if (leadResult.success && leadResult.lead) {
          setLead(leadResult.lead);
        }
        
        // Check for existing appointments
        const { hasAppointment, appointment } = await checkExistingAppointment(leadId);
        setHasAppointment(hasAppointment);
        if (appointment) {
          setExistingAppointment(appointment);
        }
      } catch (error) {
        console.error("Error loading lead data:", error);
      } finally {
        setLoadingLead(false);
      }
    };
    
    void loadLeadData();
  }, [leadId]);
  
  // Load timeslots when date is selected
  useEffect(() => {
    if (!selectedDate) return;
    
    const loadTimeslots = async () => {
      setLoadingTimeslots(true);
      try {
        const slots = await fetchAvailableTimeslots(selectedDate);
        setTimeslots(slots);
      } catch (error) {
        console.error("Error loading timeslots:", error);
      } finally {
        setLoadingTimeslots(false);
      }
    };
    
    void loadTimeslots();
  }, [selectedDate]);
  
  // Set today as the default selected date
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(todayStr);
    }
  }, []);
  
  // Close calendar when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleDateSelect = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    setSelectedDate(formattedDate);
    setSelectedTimeslot(null);
    setShowCalendar(false);
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTimeslot || !selectedDate) {
      alert('Please select a date and timeslot');
      return;
    }
    
    setLoading(true);
    
    try {
      // Find the selected timeslot to get the time details
      const selectedSlot = timeslots.find(slot => slot.id === selectedTimeslot);
      if (!selectedSlot) {
        alert('Selected timeslot not found');
        return;
      }
      
      // Create the appointment datetime string in Singapore timezone
      const appointmentDateTimeString = `${selectedDate}T${selectedSlot.start_time}`;
      
      // Convert to UTC for database storage
      const utcDateTime = convertToUTC(appointmentDateTimeString);
      
      console.log('🗓️ Appointment Scheduling Debug:');
      console.log('Selected date:', selectedDate);
      console.log('Selected time:', selectedSlot.start_time);
      console.log('Combined datetime string:', appointmentDateTimeString);
      console.log('UTC datetime for database:', utcDateTime.toISOString());
      
      const result = await createAppointmentWorkflow({
        leadId,
        timeslotId: selectedTimeslot,
        notes,
        isUrgent,
        phone: lead?.phone_number ?? ''
      });
      
      if (result.success) {
        alert(`Appointment scheduled successfully! Executed ${result.results.length} actions.`);
        // Orchestrator handles: 1) create appointment, 2) update lead status to "booked" 
        // (which automatically triggers WhatsApp via updateLead)
        router.push(`/dashboard/leads/${leadId}`);
      } else {
        alert(`Failed to schedule appointment: ${result.error}`);
        if (result.rollbackAttempted) {
          console.log('Rollback was attempted due to failure');
        }
      }
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      alert('An error occurred while scheduling the appointment');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelAppointment = async () => {
    if (!existingAppointment) return;
    
    if (confirm('Are you sure you want to cancel this appointment?')) {
      setLoading(true);
      
      try {
        const result = await cancelAppointment(existingAppointment.id);
        
        if (result.success) {
          alert('Appointment cancelled successfully!');
          // Lead status will be reset to "new" by the server action
          setHasAppointment(false);
          setExistingAppointment(null);
        } else {
          alert(`Failed to cancel appointment: ${result.message}`);
        }
      } catch (error) {
        console.error('Error cancelling appointment:', error);
        alert('An error occurred while cancelling the appointment');
      } finally {
        setLoading(false);
      }
    }
  };
  
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const dateFormat = 'd';
    const rows = [];
    
    let days = [];
    let day = startDate;
    
    // Calendar header (days of the week)
    const daysOfWeek = [];
    for (let i = 0; i < 7; i++) {
      daysOfWeek.push(
        <div key={`weekday-${i}`} className="text-center font-semibold text-gray-700 text-sm py-3 uppercase tracking-wide">
          {format(addDays(startOfWeek(new Date()), i), 'EEE')}
        </div>
      );
    }
    
    // Calendar days
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const formattedDate = format(cloneDay, 'yyyy-MM-dd');
        const isSelected = selectedDate === formattedDate;
        const isToday = isSameDay(cloneDay, today);
        const isCurrentMonth = isSameMonth(cloneDay, monthStart);
        const isPastDate = cloneDay < today;
        
        days.push(
          <div
            key={formattedDate}
            className={`
              relative text-center py-3 cursor-pointer text-sm font-medium transition-all duration-200
              ${isSelected 
                ? 'bg-blue-500 text-white shadow-lg scale-105' 
                : isToday && !isSelected 
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                  : isCurrentMonth && !isPastDate
                    ? 'text-gray-900 hover:bg-blue-50 hover:text-blue-600'
                    : 'text-gray-300 cursor-not-allowed'
              }
              ${isCurrentMonth ? 'rounded-lg mx-1' : ''}
            `}
            onClick={() => isCurrentMonth && cloneDay >= today && handleDateSelect(cloneDay)}
          >
            <span className="block w-8 h-8 mx-auto leading-8 rounded-full">
              {format(cloneDay, dateFormat)}
            </span>
            {isToday && !isSelected && (
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full"></div>
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      
      rows.push(
        <div key={`week-${format(day, 'yyyy-MM-dd')}`} className="grid grid-cols-7 gap-1">
          {days}
        </div>
      );
      days = [];
    }
    
    return (
      <div className="p-4 bg-white rounded-xl shadow-lg border border-gray-200">
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
          <button 
            onClick={handlePrevMonth} 
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <h2 className="font-semibold text-lg text-gray-800">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button 
            onClick={handleNextMonth} 
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        {/* Days of the week */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek}
        </div>
        
        {/* Calendar grid */}
        <div className="space-y-1">
          {rows}
        </div>
      </div>
    );
  };
  
  const formatDisplayDate = (dateString: string) => {
    return format(parseISO(dateString), 'EEEE, MMMM d, yyyy');
  };
  
  const formatAppointmentDate = (date: Date) => {
    return format(date, 'EEEE, MMMM d, yyyy');
  };
  
  const formatAppointmentTime = (startTime: Date, endTime: Date) => {
    return `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`;
  };
  
  if (loadingLead) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center">
        <button
          onClick={() => router.push(`/dashboard/leads/${leadId}`)}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Schedule Appointment</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lead info sidebar */}
        <div>
          <div className="bg-white p-4 rounded-lg shadow-md mb-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center">
              <UserCircleIcon className="h-5 w-5 mr-2 text-blue-600" />
              Lead Information
            </h2>
            
            {lead && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium">
                    {lead.full_name ?? 'Unknown Lead'}
                  </h3>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <PhoneIcon className="h-4 w-4 mr-2" />
                  {lead.phone_number}
                </div>
                {lead.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    {lead.email}
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-600">
                  <InformationCircleIcon className="h-4 w-4 mr-2" />
                  Status: <span className="ml-1 font-medium">{lead.status}</span>
                </div>
                {lead.source && (
                  <div className="text-sm text-gray-600">
                    Source: {lead.source}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Previous Appointments Section */}
          <div className="bg-white p-4 rounded-lg shadow-md mb-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
              Previous Appointments
            </h2>
            
            {/* Load appointments using the existing getAppointmentsForLead from the leadId */}
            <PreviousAppointments leadId={leadId} />
          </div>
          
          {/* Calendar selection */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h2 className="font-semibold text-lg mb-4 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
              Select Date
            </h2>
            
            {/* Calendar input trigger */}
            <div className="mb-4 relative">
              <div 
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full p-2 border border-gray-300 rounded-md flex justify-between items-center cursor-pointer"
              >
                <span>{selectedDate ? formatDisplayDate(selectedDate) : 'Select a date'}</span>
                <CalendarIcon className="h-5 w-5 text-gray-500" />
              </div>
              
              {/* Calendar dropdown */}
              {showCalendar && (
                <div 
                  className="absolute z-10 mt-1 w-full"
                  ref={calendarRef}
                >
                  {renderCalendar()}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Timeslot selection and form */}
        <div className="md:col-span-2">
          {hasAppointment ? (
            <div className="bg-amber-50 p-6 rounded-lg shadow-md border border-amber-200">
              <div className="flex items-start mb-4">
                <ExclamationCircleIcon className="h-6 w-6 text-amber-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-lg text-amber-800">This lead already has an appointment</h2>
                  <p className="text-amber-700 mt-1">
                    This lead already has an upcoming appointment scheduled. You can either view the appointment details 
                    or cancel it to schedule a new one.
                  </p>
                </div>
              </div>
              
              {existingAppointment && (
                <div className="bg-white p-4 rounded-md border border-amber-200 mb-4">
                  <h3 className="font-medium text-gray-800 mb-2">Appointment Details</h3>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Date:</span> {formatAppointmentDate(new Date(existingAppointment.start_datetime))}
                  </p>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Time:</span> {formatAppointmentTime(new Date(existingAppointment.start_datetime), new Date(existingAppointment.end_datetime))}
                  </p>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Status:</span> {existingAppointment.status}
                  </p>
                  
                  {existingAppointment.notes && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
                      <p className="font-medium mb-1">Notes:</p>
                      <p>{existingAppointment.notes}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/appointments/${existingAppointment?.id ?? ''}`)}
                  className="py-2 px-4 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  View Appointment
                </button>
                <button
                  type="button"
                  onClick={handleCancelAppointment}
                  disabled={loading}
                  className="py-2 px-4 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {loading ? 'Cancelling...' : 'Cancel Appointment'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <form onSubmit={handleSubmit}>
                <h2 className="font-semibold text-lg mb-4 flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Select Time for {selectedDate ? formatDisplayDate(selectedDate) : ''}
                </h2>
                
                {loadingTimeslots ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="animate-pulse text-gray-500">Loading available timeslots...</div>
                  </div>
                ) : timeslots.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {timeslots.map(slot => {
                      const isFull = (slot.occupied_count ?? 0) >= (slot.max_capacity ?? 1);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={isFull}
                          onClick={() => {
                            if(!isFull) {
                              console.log(JSON.stringify(slot));
                              setSelectedTimeslot(slot.id)
                            }
                          }}
                          className={`
                            p-4 border rounded-md text-left transition-colors
                            ${selectedTimeslot === slot.id
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                              : isFull
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }
                          `}
                        >
                          <div className="font-medium">
                            {format(parseISO(`2000-01-01T${slot.start_time}`), 'h:mm a')} - 
                            {format(parseISO(`2000-01-01T${slot.end_time}`), 'h:mm a')}
                          </div>
                          <div className="text-sm mt-1 flex items-center">
                            <UsersIcon className="h-4 w-4 mr-1 text-gray-500" />
                            <span className={isFull ? 'text-red-500' : 'text-green-600'}>
                              {slot.occupied_count ?? 0}/{slot.max_capacity ?? 1} booked
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500 mb-6">
                    No available timeslots for this date.
                  </div>
                )}
                
                {/* Urgency checkbox */}
                <div className="mb-4">
                  <div className="flex items-center">
                    <input
                      id="urgent"
                      name="urgent"
                      type="checkbox"
                      checked={isUrgent}
                      onChange={(e) => setIsUrgent(e.target.checked)}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <label htmlFor="urgent" className="ml-2 flex items-center text-sm font-medium text-gray-900">
                      <ExclamationCircleIcon className="h-5 w-5 text-amber-500 mr-1" />
                      Mark as needed early
                    </label>
                  </div>
                  {isUrgent && (
                    <p className="mt-1 text-sm text-gray-500">
                      This will flag the appointment as high priority and needed early.
                    </p>
                  )}
                </div>
                
                <div className="mb-6">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Appointment Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter any notes or special instructions for this appointment..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedTimeslot || loading}
                    className={`
                      py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                      ${!selectedTimeslot || loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                    `}
                  >
                    {loading ? 'Scheduling...' : 'Schedule Appointment'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Previous Appointments Component
function PreviousAppointments({ leadId }: { leadId: number }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setLoading(true);
        const response = await getAppointmentsForLead(leadId);
        if (response.success && response.appointments) {
          // Sort appointments by date, newest first
          const sortedAppointments = response.appointments.sort((a: Appointment, b: Appointment) => 
            new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime()
          );
          console.log("Previous Appointments: " + JSON.stringify(sortedAppointments));
          setAppointments(sortedAppointments);
        }
      } catch (error) {
        console.error('Error loading appointments:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadAppointments();
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-pulse text-gray-500 text-sm">Loading appointments...</div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-6">
        <CalendarIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No previous appointments</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: "bg-blue-50 text-blue-700 border-blue-200",
      done: "bg-green-50 text-green-700 border-green-200", 
      missed: "bg-orange-50 text-orange-700 border-orange-200",
      cancelled: "bg-red-50 text-red-700 border-red-200"
    };
    return colors[status] ?? "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getLoanStatusColor = (status: string | null) => {
    if (!status) return "";
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
      cancelled: "bg-gray-100 text-gray-800 border-gray-200",
      completed: "bg-emerald-100 text-emerald-800 border-emerald-200"
    };
    return colors[status] ?? "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming': return <ClockIcon className="h-4 w-4" />;
      case 'done': return <CheckCircleIcon className="h-4 w-4" />;
      case 'missed': return <ExclamationCircleIcon className="h-4 w-4" />;
      case 'cancelled': return <XCircleIcon className="h-4 w-4" />;
      default: return <ClockIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {appointments.map((appointment) => {
        // Convert UTC to Singapore time for display
        const startTimeSGT = new Date(appointment.start_datetime);
        const endTimeSGT = new Date(appointment.end_datetime);
        // startTimeSGT.setHours(startTimeSGT.getHours() + 8);
        // endTimeSGT.setHours(endTimeSGT.getHours() + 8);
        
        return (
          <div 
            key={appointment.id} 
            className={`p-3 rounded-lg border ${getStatusColor(appointment.status)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getStatusIcon(appointment.status)}
                <span className="font-medium text-sm capitalize">{appointment.status}</span>
              </div>
              <span className="text-xs text-gray-500">
                #{appointment.id}
              </span>
            </div>
            
            <div className="text-sm space-y-1">
              <div className="flex items-center">
                <CalendarIcon className="h-3 w-3 mr-1" />
                <span>{format(startTimeSGT, 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center">
                <ClockIcon className="h-3 w-3 mr-1" />
                <span>
                  {format(startTimeSGT, 'h:mm a')} - {format(endTimeSGT, 'h:mm a')} (SGT)
                </span>
              </div>
              
              {/* Creator and Agent Info */}
              <div className="text-xs text-gray-500 mt-1">
                <div>Created by: <span className="font-medium">{appointment.creator_name}</span></div>
                <div>Assigned to: <span className="font-medium">{appointment.agent_name}</span></div>
                <div>Lead assigned to: <span className="font-medium">{appointment.assigned_user_name}</span></div>
              </div>
              
              {/* Loan Status */}
              {appointment.loan_status && (
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getLoanStatusColor(appointment.loan_status)}`}>
                    Loan: {appointment.loan_status}
                  </span>
                </div>
              )}
              
              {/* Notes */}
              {appointment.notes && (
                <div className="text-xs italic text-gray-600 mt-2 p-2 bg-white/50 rounded">
                  <span className="font-medium">Notes:</span> {appointment.notes}
                </div>
              )}
              
              {/* Loan Notes */}
              {appointment.loan_notes && (
                <div className="text-xs italic text-gray-600 mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                  <span className="font-medium">Loan Notes:</span> {appointment.loan_notes}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}