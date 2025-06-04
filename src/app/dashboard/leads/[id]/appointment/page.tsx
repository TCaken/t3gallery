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
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { fetchLeadById } from '~/app/_actions/leadActions';
import { 
  checkExistingAppointment, 
  fetchAvailableTimeslots, 
  cancelAppointment,
  type AppointmentWithLead,
  type Timeslot
} from '~/app/_actions/appointmentAction';
import { createAppointmentWorkflow } from '~/app/_actions/transactionOrchestrator';
import { type InferSelectModel } from 'drizzle-orm';
import { leads } from "~/server/db/schema";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns';

type Lead = InferSelectModel<typeof leads>;

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
        if (leadResult.success) {
          setLead(leadResult.lead);
        }
        
        // Check for existing appointments
        const { hasAppointment, appointment } = await checkExistingAppointment(leadId);
        setHasAppointment(hasAppointment);
        setExistingAppointment(appointment);
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
    
    if (!selectedTimeslot) {
      alert('Please select a timeslot');
      return;
    }
    
    setLoading(true);
    
    try {
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
        <div key={`weekday-${i}`} className="text-center font-medium text-gray-500 text-xs py-2">
          {format(addDays(startOfWeek(new Date()), i), 'EEEEEE')}
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
        
        days.push(
          <div
            key={formattedDate}
            className={`
              relative text-center py-2 cursor-pointer hover:bg-blue-50 rounded-full mx-1
              ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
              ${!isCurrentMonth ? 'text-gray-300' : ''}
              ${isToday && !isSelected ? 'text-blue-500 font-bold' : ''}
            `}
            onClick={() => isCurrentMonth && cloneDay >= today && handleDateSelect(cloneDay)}
          >
            {format(cloneDay, dateFormat)}
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
      <div className="p-3 bg-white rounded-lg shadow-lg border border-gray-200">
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-2">
          <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100">
            <ChevronLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <h2 className="font-medium">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100">
            <ChevronRightIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        {/* Days of the week */}
        <div className="grid grid-cols-7 gap-1 mb-1">
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
                    {lead.first_name} {lead.last_name}
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
                    <span className="font-medium">Date:</span> {formatAppointmentDate(existingAppointment.start_datetime)}
                  </p>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Time:</span> {formatAppointmentTime(existingAppointment.start_datetime, existingAppointment.end_datetime)}
                  </p>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Status:</span> {existingAppointment.status}
                  </p>
                  
                  {existingAppointment.is_urgent && (
                    <div className="mt-2 flex items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                        Needed Early
                      </span>
                    </div>
                  )}
                  
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
                  onClick={() => router.push(`/dashboard/appointments/${existingAppointment?.id || ''}`)}
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
                      const isFull = slot.occupied_count >= slot.max_capacity;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedTimeslot(slot.id)}
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
                              {slot.occupied_count}/{slot.max_capacity} booked
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