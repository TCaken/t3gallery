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
import { getBorrower } from '~/app/_actions/borrowers';
import { 
  getBorrowerAppointments,
  createBorrowerAppointment,
  deleteBorrowerAppointment,
  type CreateBorrowerAppointmentInput
} from '~/app/_actions/borrowerAppointments';
import { fetchAvailableTimeslots, type Timeslot } from '~/app/_actions/appointmentAction';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { useAuth } from '@clerk/nextjs';

type Borrower = Awaited<ReturnType<typeof getBorrower>>['data'];
type BorrowerAppointment = Awaited<ReturnType<typeof getBorrowerAppointments>>['data'][0];

export default function BorrowerAppointmentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { userId } = useAuth();
  const borrowerId = parseInt(params.id);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [loadingBorrower, setLoadingBorrower] = useState(true);
  const [existingAppointment, setExistingAppointment] = useState<BorrowerAppointment | null>(null);
  const [hasUpcomingAppointment, setHasUpcomingAppointment] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeslot, setSelectedTimeslot] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [loadingTimeslots, setLoadingTimeslots] = useState(false);
  
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Load borrower info and check for existing appointments
  useEffect(() => {
    const loadBorrowerData = async () => {
      try {
        // Load borrower info
        const borrowerResult = await getBorrower(borrowerId);
        if (borrowerResult.success && borrowerResult.data) {
          setBorrower(borrowerResult.data);
        }
        
        // Check for existing upcoming appointments
        const appointmentsResult = await getBorrowerAppointments({ borrower_id: borrowerId });
        if (appointmentsResult.success && appointmentsResult.data) {
          const upcomingAppointment = appointmentsResult.data.find(
            apt => apt.status === 'upcoming' || apt.status === 'scheduled'
          );
          
          if (upcomingAppointment) {
            setHasUpcomingAppointment(true);
            setExistingAppointment(upcomingAppointment);
          }
        }
      } catch (error) {
        console.error("Error loading borrower data:", error);
      } finally {
        setLoadingBorrower(false);
      }
    };
    
    void loadBorrowerData();
  }, [borrowerId]);

  // Load timeslots when date is selected
  useEffect(() => {
    if (selectedDate && !hasUpcomingAppointment) {
      const loadTimeslots = async () => {
        setLoadingTimeslots(true);
        try {
          const timeslotsData = await fetchAvailableTimeslots(selectedDate);
          if (Array.isArray(timeslotsData)) {
            setTimeslots(timeslotsData);
          } else {
            setTimeslots([]);
          }
        } catch (error) {
          console.error('Error loading timeslots:', error);
          setTimeslots([]);
        } finally {
          setLoadingTimeslots(false);
        }
      };
      
      void loadTimeslots();
    }
  }, [selectedDate, hasUpcomingAppointment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTimeslot || !userId) {
      alert('Please select a date and time slot');
      return;
    }
    
    setLoading(true);
    
    try {
      const selectedTimeslotData = timeslots.find(slot => slot.id === selectedTimeslot);
      if (!selectedTimeslotData) {
        throw new Error('Selected timeslot not found');
      }
      
      // Create appointment data
      const appointmentData: CreateBorrowerAppointmentInput = {
        borrower_id: borrowerId,
        agent_id: userId,
        appointment_type: 'reloan_consultation',
        notes: notes.trim() || undefined,
        start_datetime: new Date(`${selectedDate}T${selectedTimeslotData.start_time}`),
        end_datetime: new Date(`${selectedDate}T${selectedTimeslotData.end_time}`),
        timeslot_ids: [selectedTimeslot]
      };
      
      const result = await createBorrowerAppointment(appointmentData);
      
      if (result.success) {
        alert('Appointment scheduled successfully!');
        router.push(`/dashboard/borrowers/${borrowerId}`);
      } else {
        alert('Failed to schedule appointment');
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
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
        const result = await deleteBorrowerAppointment(existingAppointment.id);
        
        if (result.success) {
          alert('Appointment cancelled successfully!');
          setHasUpcomingAppointment(false);
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

  const handleDateSelect = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setSelectedTimeslot(null);
    setShowCalendar(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];

    const days = [];
    const dayFormat = "EE";
    let day = startDate;

    // Day headers
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center text-xs font-medium text-gray-500 py-2">
          {format(day, dayFormat)}
        </div>
      );
      day = addDays(day, 1);
    }

    const daysOfWeek = <div className="grid grid-cols-7 gap-1">{days}</div>;

    // Calendar grid
    let days_grid = [];
    day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const isPastDate = day < today;
        const isToday = isSameDay(day, today);
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isSelected = selectedDate && isSameDay(day, parseISO(selectedDate));
        
        days_grid.push(
          <button
            key={day.toString()}
            type="button"
            onClick={() => !isPastDate && isCurrentMonth && handleDateSelect(cloneDay)}
            disabled={isPastDate || !isCurrentMonth}
            className={`
              relative w-full h-10 rounded-lg text-sm transition-colors
              ${isPastDate || !isCurrentMonth 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-700 hover:bg-blue-50 cursor-pointer'
              }
              ${isToday ? 'bg-blue-100 font-semibold' : ''}
              ${isSelected ? 'bg-blue-500 text-white font-semibold' : ''}
            `}
          >
            <span>{format(day, dateFormat)}</span>
          </button>
        );
        day = addDays(day, 1);
      }
      
      if (days_grid.length === 7) {
        rows.push(
          <div key={day.toString()} className="grid grid-cols-7 gap-1">
            {days_grid}
          </div>
        );
        days_grid = [];
      }
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
        {daysOfWeek}
        
        {/* Calendar grid */}
        <div className="space-y-1 mt-2">
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
  
  if (loadingBorrower) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center">
        <button
          onClick={() => router.push(`/dashboard/borrowers/${borrowerId}`)}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Schedule Borrower Appointment</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Borrower info sidebar */}
        <div>
          <div className="bg-white p-4 rounded-lg shadow-md mb-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center">
              <UserCircleIcon className="h-5 w-5 mr-2 text-blue-600" />
              Borrower Information
            </h2>
            
            {borrower && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium">
                    {borrower.full_name}
                  </h3>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <PhoneIcon className="h-4 w-4 mr-2" />
                  {borrower.phone_number}
                </div>
                {borrower.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    {borrower.email}
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-600">
                  <InformationCircleIcon className="h-4 w-4 mr-2" />
                  Status: <span className="ml-1 font-medium">{borrower.status}</span>
                </div>
                {borrower.source && (
                  <div className="text-sm text-gray-600">
                    Source: {borrower.source}
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
            
            <PreviousAppointments borrowerId={borrowerId} />
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
          {hasUpcomingAppointment ? (
            <div className="bg-amber-50 p-6 rounded-lg shadow-md border border-amber-200">
              <div className="flex items-start mb-4">
                <ExclamationCircleIcon className="h-6 w-6 text-amber-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-lg text-amber-800">This borrower already has an appointment</h2>
                  <p className="text-amber-700 mt-1">
                    This borrower already has an upcoming appointment scheduled. You can either view the appointment details 
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
                      const isSelected = selectedTimeslot === slot.id;
                      
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedTimeslot(slot.id)}
                          disabled={isFull}
                          className={`
                            p-3 rounded-lg border-2 text-left transition-all
                            ${isFull 
                              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' 
                              : isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-800'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }
                          `}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">
                              {format(new Date(`2024-01-01T${slot.start_time}`), 'h:mm a')} - 
                              {format(new Date(`2024-01-01T${slot.end_time}`), 'h:mm a')}
                            </span>
                            {isFull && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                                Full
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {slot.occupied_count ?? 0} / {slot.max_capacity ?? 1} booked
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : selectedDate ? (
                  <div className="text-center py-8">
                    <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No available timeslots for this date</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Please select a date to view available timeslots</p>
                  </div>
                )}
                
                {/* Notes section */}
                <div className="mb-6">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add any notes about this appointment..."
                  />
                </div>
                
                {/* Submit button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!selectedDate || !selectedTimeslot || loading}
                    className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
function PreviousAppointments({ borrowerId }: { borrowerId: number }) {
  const [appointments, setAppointments] = useState<BorrowerAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setLoading(true);
        const response = await getBorrowerAppointments({ borrower_id: borrowerId });
        if (response.success && response.data) {
          // Sort appointments by date, newest first, exclude upcoming ones
          const pastAppointments = response.data
            .filter(apt => apt.status !== 'upcoming' && apt.status !== 'scheduled')
            .sort((a, b) => 
              new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime()
            );
          setAppointments(pastAppointments);
        }
      } catch (error) {
        console.error('Error loading appointments:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadAppointments();
  }, [borrowerId]);

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
      done: "bg-green-50 text-green-700 border-green-200", 
      missed: "bg-orange-50 text-orange-700 border-orange-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
      completed: "bg-green-50 text-green-700 border-green-200"
    };
    return colors[status] ?? "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactElement> = {
      done: <CheckCircleIcon className="h-4 w-4 text-green-600" />,
      completed: <CheckCircleIcon className="h-4 w-4 text-green-600" />,
      missed: <XCircleIcon className="h-4 w-4 text-orange-600" />,
      cancelled: <XCircleIcon className="h-4 w-4 text-red-600" />
    };
    return icons[status] ?? <CalendarIcon className="h-4 w-4 text-gray-600" />;
  };

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {appointments.map((appointment) => {
        const startTimeSGT = new Date(appointment.start_datetime);
        const endTimeSGT = new Date(appointment.end_datetime);
        
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
              <div className="flex items-center text-gray-600">
                <CalendarIcon className="h-3 w-3 mr-1" />
                <span>{format(startTimeSGT, 'MMM dd, yyyy')}</span>
                <ClockIcon className="h-3 w-3 ml-2 mr-1" />
                <span>{format(startTimeSGT, 'h:mm a')} - {format(endTimeSGT, 'h:mm a')}</span>
              </div>
              
              {(appointment.agent_first_name ?? appointment.agent_last_name) && (
                <div className="text-gray-600">
                  <span className="font-medium">Agent:</span> {appointment.agent_first_name} {appointment.agent_last_name}
                </div>
              )}
            </div>
            
            {appointment.notes && (
              <div className="text-xs text-gray-600 mt-2 p-2 bg-white/50 rounded">
                <span className="font-medium">Notes:</span> {appointment.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 