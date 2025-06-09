"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  PhoneIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import { createAppointment, fetchAppointments, type AppointmentWithLead } from '~/app/_actions/appointmentAction';
import { fetchAvailableTimeslots, type Timeslot } from '~/app/_actions/appointmentAction';
import { format, parseISO, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, isToday } from 'date-fns';
import { createLead } from '~/app/_actions/leadActions';
import { truncate } from 'fs/promises';
import { auth } from '@clerk/nextjs/server';
import { createAppointmentWorkflow } from '~/app/_actions/transactionOrchestrator';
import { updateAppointmentStatusesByTime, testAppointmentStatusUpdate } from '~/app/_actions/appointmentStatusUpdateAction';
  
const APPOINTMENT_STATUSES = {
  upcoming: { icon: ClockIcon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  done: { icon: CheckCircleIcon, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  missed: { icon: ExclamationCircleIcon, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  cancelled: { icon: XCircleIcon, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
};

// Generate timeslots for display (10 AM to 8 PM)
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 10; hour <= 20; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    const displayTime = hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
    slots.push({ time, displayTime, hour });
  }
  return slots;
};

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [allAppointments, setAllAppointments] = useState<AppointmentWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['upcoming', 'done']);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick create modal state
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateData, setQuickCreateData] = useState({
    date: '',
    timeSlot: '',
    leadName: '',
    phoneNumber: '',
    allowOverbook: true
  });

  // Status update state
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [statusUpdateResults, setStatusUpdateResults] = useState<any>(null);

  // TODO: Get this from user context/auth - for now assuming retail user
  const isRetailUser = true; // This should come from your auth/user context

  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const timeSlots = generateTimeSlots();

  // Fetch data only when date range or view changes (not on search/filter changes)
  useEffect(() => {
    void fetchAppointmentData();
  }, [currentDate, viewMode]);

  // Separate effect for search that only triggers after debounce
  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) {
      // Only refetch if the debounced search is different and not empty
      if (debouncedSearchQuery.trim()) {
        void fetchAppointmentData();
      }
    }
  }, [debouncedSearchQuery]);

  const fetchAppointmentData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = viewMode === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfDay(currentDate);
      const endDate = viewMode === 'week' ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfDay(currentDate);

      const filters = {
        startDate,
        endDate,
        // Don't filter by status or search in the API call - we'll do it client-side for better UX
        status: ['upcoming', 'done', 'missed', 'cancelled'], // Fetch all statuses
        sortBy: 'start_datetime'
      };

      const fetchedAppointments = await fetchAppointments(filters);
      setAllAppointments(fetchedAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode]);

  // Filter appointments client-side for immediate response
  const filteredAppointments = useMemo(() => {
    let filtered = allAppointments;

    // Filter by status
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(apt => selectedStatuses.includes(apt.status));
    }

    // Filter by search query
    if (debouncedSearchQuery.trim()) {
      const searchTerm = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(apt => 
        (apt.lead?.full_name?.toLowerCase().includes(searchTerm) ?? false) ||
        (apt.lead?.phone_number?.toLowerCase().includes(searchTerm) ?? false) ||
        (apt.notes?.toLowerCase().includes(searchTerm) ?? false) ||
        (apt.lead?.email?.toLowerCase().includes(searchTerm) ?? false)
      );
    }

    return filtered;
  }, [allAppointments, selectedStatuses, debouncedSearchQuery]);

  const handleQuickCreate = (date: Date, timeSlot: string) => {
    setQuickCreateData({
      date: format(date, 'yyyy-MM-dd'),
      timeSlot: timeSlot,
      leadName: '',
      phoneNumber: '',
      allowOverbook: false
    });
    setShowQuickCreate(true);
  };

  // Handle appointment status updates
  const handleStatusUpdate = async (thresholdHours = 2.5) => {
    setStatusUpdateLoading(true);
    setStatusUpdateResults(null);
    
    try {
      console.log('🔄 Triggering appointment status update...');
      const result = await updateAppointmentStatusesByTime(thresholdHours);
      
      console.log('✅ Status update result:', result);
      setStatusUpdateResults(result);
      
      // Refresh appointments after update
      if (result.updated > 0) {
        await fetchAppointmentData();
      }
      
    } catch (error) {
      console.error('❌ Error updating appointment statuses:', error);
      setStatusUpdateResults({
        success: false,
        message: 'Failed to update appointment statuses',
        error: (error as Error).message
      });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Test the status update functionality
  const handleTestStatusUpdate = async () => {
    setStatusUpdateLoading(true);
    setStatusUpdateResults(null);
    
    try {
      console.log('🧪 Testing appointment status update...');
      const result = await testAppointmentStatusUpdate();
      
      console.log('✅ Test result:', result);
      setStatusUpdateResults(result);
      
      // Refresh appointments after test
      if (result.updated > 0) {
        await fetchAppointmentData();
      }
      
    } catch (error) {
      console.error('❌ Error testing appointment status update:', error);
      setStatusUpdateResults({
        success: false,
        message: 'Failed to test appointment status update',
        error: (error as Error).message
      });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Step 1: Create the lead first
      // TODO: Replace with your actual createLead function
      const leadData = {
        full_name: quickCreateData.leadName,
        phone_number: quickCreateData.phoneNumber,
        source: 'SEO',
        status: 'new'
      };
      
      const leadResult = await createLead({...leadData, bypassEligibility: true});
     
      if(!leadResult.success || !leadResult.lead) {
        throw new Error('Failed to create lead');
      }
      const leadId = leadResult.lead.id;
      console.log('Creating lead:', leadResult.lead);

      
      // Step 2: Find the appropriate timeslot
      const selectedDate = new Date(quickCreateData.date);
      const timeslots = await fetchAvailableTimeslots(quickCreateData.date);
      const targetSlot = timeslots.find((slot: Timeslot) => slot.start_time === `${quickCreateData.timeSlot}:00`);
      
      if (!targetSlot) {
        throw new Error('Selected timeslot not found');
      }
      
      // Step 3: Check capacity unless overbooking is allowed
      if (!quickCreateData.allowOverbook) {
        const occupiedCount = targetSlot.occupied_count ?? 0;
        const maxCapacity = targetSlot.max_capacity ?? 1;
        if (occupiedCount >= maxCapacity) {
          throw new Error('This timeslot is fully booked. Enable overbooking to proceed.');
        }
      }
      
      // Step 4: Create appointment
      // TODO: Replace with your actual createAppointment function
      const appointmentData = {
        leadId: leadId, 
        timeslotId: targetSlot.id,
        notes: `Quick created by retail user for ${quickCreateData.leadName}`,
        isUrgent: false,
        phone: quickCreateData.phoneNumber
      };
      
      const appointmentResult = await createAppointmentWorkflow(appointmentData);
      if(!appointmentResult.success) {
        throw new Error('Failed to create appointment');
      }
      console.log('Creating appointment:', appointmentResult);
      
      // Step 5: Success feedback and refresh
      setShowQuickCreate(false);
      
      // Refresh the appointments data
      await fetchAppointmentData();
      console.log('Appointment result:', appointmentResult);

      window.open(`/dashboard/appointments/${appointmentResult.results?.[0]?.result?.data?.appointment?.id}`, '_blank');
    } catch (error) {
      console.error('Error creating quick appointment:', error);
      alert(`Failed to create appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get time options for the selected hour
  const getTimeOptions = (baseTimeSlot: string) => {
    const parts = baseTimeSlot.split(':');
    const hourStr = parts[0];
    if (!hourStr) return [];
    
    const hour = parseInt(hourStr);
    const firstHalf = `${hour.toString().padStart(2, '0')}:00`;
    const secondHalf = `${hour.toString().padStart(2, '0')}:30`;
    
    return [
      { value: firstHalf, label: format(parseISO(`2000-01-01T${firstHalf}:00`), 'h:mm a') },
      { value: secondHalf, label: format(parseISO(`2000-01-01T${secondHalf}:00`), 'h:mm a') }
    ];
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : addDays(currentDate, -1));
    }
  };

  // Get appointments for a specific time slot, including those that span multiple slots
  const getAppointmentsForTimeSlot = (date: Date, timeSlot: string) => {
    return filteredAppointments.filter(apt => {
      const aptStartDate = new Date(apt.start_datetime);
      const aptEndDate = new Date(apt.end_datetime);
      
      // Check if this appointment is on the same day
      if (!isSameDay(aptStartDate, date)) return false;
      
      const slotStart = new Date(`${format(date, 'yyyy-MM-dd')}T${timeSlot}:00`);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // Add 1 hour

      // console.log(JSON.stringify(apt), aptStartDate, aptEndDate, slotStart, slotEnd);
      
      // Check if appointment overlaps with this time slot
      // An appointment overlaps if it starts before the slot ends AND ends after the slot starts
      return (
        slotStart <= aptStartDate && aptEndDate <= slotEnd
      );
    });
  };

  const getDateRange = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      return [currentDate];
    }
  };

  const formatDateHeader = (date: Date) => {
    if (viewMode === 'week') {
      return format(date, 'EEE d');
    } else {
      return format(date, 'EEEE, MMMM d, yyyy');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = APPOINTMENT_STATUSES[status as keyof typeof APPOINTMENT_STATUSES];
    if (!statusConfig) return null;

    const Icon = statusConfig.icon;
    return (
      <Icon className={`h-4 w-4 ${statusConfig.color}`} />
    );
  };

  const renderAppointmentCard = (appointment: AppointmentWithLead) => {
    const statusConfig = APPOINTMENT_STATUSES[appointment.status as keyof typeof APPOINTMENT_STATUSES];
    const startTime = format(new Date(appointment.start_datetime), 'h:mm a');
    const endTime = format(new Date(appointment.end_datetime), 'h:mm a');

    const handleAppointmentClick = (e: React.MouseEvent) => {
      const url = `/dashboard/appointments/${appointment.id}`;
      window.open(url, '_blank');
    };

    return (
      <div
        key={appointment.id}
        onClick={handleAppointmentClick}
        onAuxClick={(e) => {
          if (e.button === 1) { // Middle mouse button
            e.preventDefault();
            window.open(`/dashboard/appointments/${appointment.id}`, '_blank');
          }
        }}
        className={`
          mb-1 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-xs shadow-sm
          ${statusConfig?.bg ?? 'bg-gray-50'} 
          ${statusConfig?.border ?? 'border-gray-200'} 
          border-l-3 hover:shadow-md hover:-translate-y-0.5 group relative w-full max-w-full overflow-x-hidden
        `}
        title={`${appointment.lead?.full_name ?? 'Unknown Lead'} - ${startTime} to ${endTime}\nClick to open details`}
      >
        {/* Lead Name with Status Indicator */}
        <div className="flex items-center justify-between w-full mb-1">
          <span className="font-semibold text-gray-900 truncate text-xs leading-tight flex-1 min-w-0">
            {appointment.lead?.full_name ?? 'Unknown Lead'}
          </span>
          <div className="flex-shrink-0 ml-1">
            {getStatusBadge(appointment.status)}
          </div>
        </div>

        {/* Time Display */}
        <div className="text-gray-600 text-xs font-medium truncate w-full mb-1">
          {startTime}
        </div>

        {/* Phone Number */}
        {appointment.lead?.phone_number && (
          <div className="text-gray-500 text-xs truncate w-full font-medium">
            {appointment.lead.phone_number}
          </div>
        )}
      </div>
    );
  };

  const dates = getDateRange();

  if (loading) {
    return (
      <div className="max-w-full mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-gray-500">Loading appointments...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600 mt-1">Manage and view your appointment schedule</p>
        </div>
        
        {/* Status Update Controls */}
        <div className="flex gap-3">
          {/* <button
            onClick={() => handleStatusUpdate(2.5)}
            disabled={statusUpdateLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {statusUpdateLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Updating...
              </>
            ) : (
              <>
                <ClockIcon className="h-4 w-4" />
                Update Status (2.5h)
              </>
            )}
          </button> */}
          
          {/* <button
            onClick={handleTestStatusUpdate}
            disabled={statusUpdateLoading}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {statusUpdateLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Testing...
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="h-4 w-4" />
                Test Update
              </>
            )}
          </button> */}
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">Filter by Status</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(APPOINTMENT_STATUSES).map(([status, config]) => (
                <label 
                  key={status} 
                  className={`flex items-center px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                    selectedStatuses.includes(status)
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStatuses([...selectedStatuses, status]);
                      } else {
                        setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                      }
                    }}
                    className="sr-only"
                  />
                  <config.icon className={`h-4 w-4 mr-2 ${config.color}`} />
                  <span className="capitalize text-sm font-medium">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">Search Appointments</label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, phone, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {searchQuery !== debouncedSearchQuery && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin h-3 w-3 border border-gray-300 rounded-full border-t-blue-500"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Update Results */}
      {statusUpdateResults && (
        <div className={`mb-6 p-4 rounded-xl border ${
          statusUpdateResults.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {statusUpdateResults.success ? '✅ Status Update Complete' : '❌ Status Update Failed'}
              </h3>
              <p className="mb-2">{statusUpdateResults.message}</p>
              
              {statusUpdateResults.success && statusUpdateResults.results && statusUpdateResults.results.length > 0 && (
                <div className="mt-3">
                  <h4 className="font-medium mb-2">Updated Appointments:</h4>
                  <div className="space-y-1">
                    {statusUpdateResults.results.map((result: any, index: number) => (
                      <div key={index} className="text-sm bg-white p-2 rounded border">
                        <span className="font-medium">{result.leadName}</span> - 
                        Appointment: {result.oldAppointmentStatus} → {result.newAppointmentStatus} | 
                        Lead: {result.oldLeadStatus} → {result.newLeadStatus} | 
                        Reason: {result.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {statusUpdateResults.success && (
                <div className="mt-2 text-sm">
                  📊 Processed: {statusUpdateResults.processed} | Updated: {statusUpdateResults.updated}
                  <br />
                  📅 Today (Singapore): {statusUpdateResults.todaySingapore}
                  <br />
                  ⏰ Threshold: {statusUpdateResults.thresholdHours} hours
                </div>
              )}
            </div>
            
            <button
              onClick={() => setStatusUpdateResults(null)}
              className="text-gray-500 hover:text-gray-700 ml-4"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        {/* Date Navigation */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigateDate('prev')}
            className="p-2.5 rounded-lg hover:bg-white hover:shadow-sm border border-gray-200 transition-all"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          
          <div className="font-semibold text-xl text-gray-900 px-4">
            {viewMode === 'week' 
              ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
              : format(currentDate, 'MMMM d, yyyy')
            }
          </div>
          
          <button 
            onClick={() => navigateDate('next')}
            className="p-2.5 rounded-lg hover:bg-white hover:shadow-sm border border-gray-200 transition-all"
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-600" />
          </button>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium transition-colors ml-3"
          >
            Today
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-lg shadow-sm">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
              viewMode === 'day' 
                ? 'bg-white shadow-sm text-blue-700' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Day View
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
              viewMode === 'week' 
                ? 'bg-white shadow-sm text-blue-700' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Week View
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header Row */}
            <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `140px repeat(${dates.length}, 1fr)` }}>
              <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-r border-gray-200 font-semibold text-gray-800">
                Time
              </div>
              {dates.map((date) => (
                <div 
                  key={date.toISOString()} 
                  className={`p-4 bg-gradient-to-r border-r border-gray-200 text-center font-semibold ${
                    isToday(date) 
                      ? 'from-blue-50 to-blue-100 text-blue-800' 
                      : 'from-gray-50 to-gray-100 text-gray-700'
                  }`}
                >
                  {formatDateHeader(date)}
                  {isToday(date) && (
                    <div className="text-xs text-blue-600 font-medium mt-1">Today</div>
                  )}
                </div>
              ))}
            </div>

            {/* Time Slot Rows */}
            {timeSlots.map((slot) => (
              <div 
                key={slot.time} 
                className="grid border-b border-gray-100 hover:bg-gray-25 transition-colors"
                style={{ gridTemplateColumns: `140px repeat(${dates.length}, 1fr)` }}
              >
                <div className="p-4 bg-gray-50 border-r border-gray-200 text-sm font-semibold text-gray-700">
                  {slot.displayTime}
                </div>
                {dates.map((date) => {
                  const appointmentsInSlot = getAppointmentsForTimeSlot(date, slot.time);
                  return (
                    <div 
                      key={`${date.toISOString()}-${slot.time}`}
                      className="p-2 border-r border-gray-100 min-h-[70px] w-full max-w-full overflow-x-hidden hover:bg-gray-25 transition-colors group"
                      style={{ width: '100%' }}
                    >
                      {appointmentsInSlot.map(appointment => renderAppointmentCard(appointment))}
                      
                      {/* Quick Create Button for Retail Users - Hidden by default, shown on hover */}
                      {isRetailUser && (
                        <button
                          onClick={() => handleQuickCreate(date, slot.time)}
                          className="w-full mt-1 p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-25 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out transform translate-y-1 group-hover:translate-y-0"
                          title="Quick create appointment"
                        >
                          <PlusIcon className="h-4 w-4 mx-auto mb-1" />
                          <div>Add Appointment</div>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredAppointments.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm mt-6 border border-gray-100">
          <CalendarIcon className="mx-auto h-16 w-16 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No appointments found</h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            {searchQuery 
              ? 'Try adjusting your search terms or filters to find what you are looking for.' 
              : 'No appointments are scheduled for this time period. Schedule some appointments to see them here.'}
          </p>
        </div>
      )}

      {/* Results Summary */}
      {(searchQuery || selectedStatuses.length < 4) && (
        <div className="mt-6 text-sm text-gray-600 text-center bg-blue-50 border border-blue-200 rounded-lg py-3 px-4">
          <span className="font-medium">Showing {filteredAppointments.length} of {allAppointments.length} appointments</span>
          {searchQuery && <span className="text-blue-700"> matching {searchQuery}</span>}
        </div>
      )}

      {/* Quick Create Modal */}
      {showQuickCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Create Appointment</h3>
            
            <form onSubmit={handleQuickCreateSubmit}>
              {/* Date and Time Display */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900">
                  {format(parseISO(`${quickCreateData.date}T00:00:00`), 'EEEE, MMMM d, yyyy')}
                </div>
              </div>

              {/* Time Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Appointment Time *
                </label>
                <select
                  value={quickCreateData.timeSlot}
                  onChange={(e) => setQuickCreateData(prev => ({ ...prev, timeSlot: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {getTimeOptions(quickCreateData.timeSlot).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Choose between first half or second half of the hour</p>
              </div>

              {/* Lead Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead Name *
                </label>
                <input
                  type="text"
                  required
                  value={quickCreateData.leadName}
                  onChange={(e) => setQuickCreateData(prev => ({ ...prev, leadName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter lead name"
                />
              </div>

              {/* Phone Number */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={quickCreateData.phoneNumber}
                  onChange={(e) => setQuickCreateData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter phone number"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowQuickCreate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
