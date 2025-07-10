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
  UsersIcon,
  PhoneIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import { createAppointment, fetchAppointments, type AppointmentWithLead } from '~/app/_actions/appointmentAction';
import { fetchAvailableTimeslots, type Timeslot } from '~/app/_actions/appointmentAction';
import { getBorrowerAppointments } from '~/app/_actions/borrowerAppointments';
import { format, parseISO, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, isToday } from 'date-fns';
import { createLead } from '~/app/_actions/leadActions';
import { truncate } from 'fs/promises';
import { auth } from '@clerk/nextjs/server';
import { createAppointmentWorkflow } from '~/app/_actions/transactionOrchestrator';
import { updateAppointmentStatusesByTime, testAppointmentStatusUpdate } from '~/app/_actions/appointmentStatusUpdateAction';

// Borrower appointment type (from getBorrowerAppointments)
type BorrowerAppointmentData = Awaited<ReturnType<typeof getBorrowerAppointments>>['data'][0];

// Unified appointment type for calendar display
type UnifiedAppointment = {
  id: number;
  status: string;
  start_datetime: Date;
  end_datetime: Date;
  notes?: string | null;
  loan_status?: string | null;
  loan_notes?: string | null;
  created_at?: Date;
  updated_at?: Date | null;
  created_by?: string | null;
  updated_by?: string | null;
  type: 'lead' | 'borrower';
  // Lead-specific fields
  lead?: {
    id: number;
    full_name: string;
    phone_number: string;
    email?: string | null;
  } | null;
  // Borrower-specific fields
  borrower?: {
    id: number;
    name: string;
    phone: string;
  } | null;
  // Agent information (unified from both types)
  agent?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null;
  agent_name?: string;
  agent_email?: string;
};

const APPOINTMENT_STATUSES = {
  upcoming: { icon: ClockIcon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  done: { icon: CheckCircleIcon, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  missed: { icon: ExclamationCircleIcon, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  cancelled: { icon: XCircleIcon, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
};

// Function to get display status (shows "TUR" instead of "done")
const getDisplayStatus = (status: string): string => {
  return status === 'done' ? 'TUR' : status;
};

// Generate timeslots for display (10 AM to 8 PM)
const generateTimeSlots = () => {
  const slots = [];
  slots.push({ time: '10:30', displayTime: '10:30 AM', hour: 10 });
  for (let hour = 11; hour <= 19; hour++) {
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

interface StatusUpdateResult {
  success: boolean;
  message: string;
  processed?: number;
  updated?: number;
  todaySingapore?: string;  
  thresholdHours?: number;
  results?: Array<{
    leadName: string;
    oldAppointmentStatus: string;
    newAppointmentStatus: string;
    oldLeadStatus: string;
    newLeadStatus: string;
    reason: string;
  }>;
  error?: string;
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [allAppointments, setAllAppointments] = useState<UnifiedAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['upcoming', 'done', 'missed']);
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
  const [statusUpdateResults, setStatusUpdateResults] = useState<StatusUpdateResult | null>(null);

  // Hover modal state
  const [hoveredAppointment, setHoveredAppointment] = useState<UnifiedAppointment | null>(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });

  // TODO: Get this from user context/auth - for now assuming retail user
  const isRetailUser = true; // This should come from your auth/user context

  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const timeSlots = generateTimeSlots();

  // Fetch data when date range, view changes, or when search query changes
  useEffect(() => {
    void fetchAppointmentData();
  }, [currentDate, viewMode]);

  // We don't need a separate effect for search since we do client-side filtering
  // This removes potential race conditions and data mismatches

  const fetchAppointmentData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = viewMode === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfDay(currentDate);
      const endDate = viewMode === 'week' ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfDay(currentDate);

      // Fetch lead appointments
      const leadFilters = {
        startDate,
        endDate,
        status: ['upcoming', 'done', 'missed', 'cancelled'],
        sortBy: 'start_datetime'
      };
      
      const fetchedLeadAppointments = await fetchAppointments(leadFilters);

      // Fetch borrower appointments
      const borrowerAppointmentsResult = await getBorrowerAppointments({
        limit: 1000 // Get all borrower appointments, we'll filter by date client-side
      });

      // Convert lead appointments to unified format
      const unifiedLeadAppointments: UnifiedAppointment[] = fetchedLeadAppointments.map(apt => ({
        id: apt.id,
        status: apt.status,
        start_datetime: new Date(apt.start_datetime),
        end_datetime: new Date(apt.end_datetime),
        notes: apt.notes,
        loan_status: apt.loan_status,
        loan_notes: apt.loan_notes,
        created_at: apt.created_at,
        updated_at: apt.updated_at,
        created_by: apt.created_by,
        updated_by: apt.updated_by,
        type: 'lead' as const,
        lead: apt.lead ? {
          id: apt.lead.id,
          full_name: apt.lead.full_name ?? 'Unknown Lead',
          phone_number: apt.lead.phone_number,
          email: apt.lead.email
        } : null,
        borrower: null,
        agent: apt.agent ? {
          id: apt.agent.id,
          first_name: apt.agent.first_name ?? undefined,
          last_name: apt.agent.last_name ?? undefined,
          email: apt.agent.email ?? undefined
        } : null,
        agent_name: apt.agent?.first_name && apt.agent?.last_name ? 
          `${apt.agent.first_name} ${apt.agent.last_name}` : undefined,
        agent_email: apt.agent?.email ?? undefined
      }));

      // Convert borrower appointments to unified format and filter by date range
      const unifiedBorrowerAppointments: UnifiedAppointment[] = 
        (borrowerAppointmentsResult.success && borrowerAppointmentsResult.data ? 
          borrowerAppointmentsResult.data : [])
        .filter(apt => {
          const aptDate = new Date(apt.start_datetime);
          return aptDate >= startDate && aptDate <= endDate;
        })
        .map(apt => ({
          id: apt.id,
          status: apt.status,
          start_datetime: new Date(apt.start_datetime),
          end_datetime: new Date(apt.end_datetime),
          notes: apt.notes,
          loan_status: apt.loan_status,
          loan_notes: apt.loan_notes,
          created_at: apt.created_at,
          updated_at: apt.updated_at,
          created_by: apt.created_by,
          updated_by: undefined,
          type: 'borrower' as const,
          lead: null,
          borrower: {
            id: apt.borrower_id,
            name: apt.borrower_name ?? 'Unknown Borrower',
            phone: apt.borrower_phone ?? ''
          },
          agent: apt.agent_first_name && apt.agent_last_name ? {
            id: apt.agent_id,
            first_name: apt.agent_first_name,
            last_name: apt.agent_last_name,
            email: apt.agent_email ?? undefined
          } : null,
          agent_name: apt.agent_first_name && apt.agent_last_name ? 
            `${apt.agent_first_name} ${apt.agent_last_name}` : undefined,
          agent_email: apt.agent_email ?? undefined
        }));

      // Combine both types of appointments
      const allUnifiedAppointments = [...unifiedLeadAppointments, ...unifiedBorrowerAppointments];
      
      // Sort by start time
      allUnifiedAppointments.sort((a, b) => 
        a.start_datetime.getTime() - b.start_datetime.getTime()
      );

      setAllAppointments(allUnifiedAppointments);
      console.log(`Fetched ${unifiedLeadAppointments.length} lead appointments and ${unifiedBorrowerAppointments.length} borrower appointments`);
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
      filtered = filtered.filter(apt => {
        // Search in lead data
        if (apt.type === 'lead' && apt.lead) {
          const fieldsToSearch = [
            apt.lead.full_name,
            apt.lead.phone_number,
            apt.lead.email,
            apt.notes
          ];
          return fieldsToSearch.some(field => field?.toLowerCase().includes(searchTerm));
        }
        // Search in borrower data
        if (apt.type === 'borrower' && apt.borrower) {
          const fieldsToSearch = [
            apt.borrower.name,
            apt.borrower.phone,
            apt.notes
          ];
          return fieldsToSearch.some(field => field?.toLowerCase().includes(searchTerm));
        }
        return false;
      });
    }
    console.log("All appointments: " + allAppointments.length);
    console.log("Filtered appointments: " + filtered.length);

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
      
      console.log('Timeslots:', timeslots);
      console.log('Target slot:', targetSlot);
      console.log('Quick create data:', quickCreateData.timeSlot);

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

      // window.open(`/dashboard/appointments/${appointmentResult.results?.[0]?.result?.data?.appointment?.id}`, '_blank');
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
    console.log(hourStr, 'hourStr');
    
    const hour = parseInt(hourStr);
    if(hour === 10) {
      return [
        { value: '10:30', label: format(parseISO(`2000-01-01T10:30:00`), 'h:mm a') }
      ];
    }
    else if(hour === 19) {
      console.log(hour, '19:00');
      return [
        { value: '19:00', label: format(parseISO(`2000-01-01T19:00:00`), 'h:mm a') }
      ];
    }
    else {
      const firstHalf = `${hour.toString().padStart(2, '0')}:00`;
      const secondHalf = `${hour.toString().padStart(2, '0')}:30`;
      console.log(hour, firstHalf, secondHalf);
    
      return [
        { value: firstHalf, label: format(parseISO(`2000-01-01T${firstHalf}:00`), 'h:mm a') },
        { value: secondHalf, label: format(parseISO(`2000-01-01T${secondHalf}:00`), 'h:mm a') }
      ];
    }
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
      
      // Determine slot duration based on the time
      let slotEnd: Date;
      if (timeSlot === '10:30') {
        // 10:30 AM slot is 30 minutes (10:30 - 11:00)
        slotEnd = new Date(`${format(date, 'yyyy-MM-dd')}T11:00:00`);
      } else {
        // All other slots are 1 hour
        slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      }

      // Check if appointment starts within this specific time slot
      // An appointment belongs to a slot if it starts within the slot's time range
      return (
        aptStartDate >= slotStart && aptStartDate < slotEnd
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

  const renderAppointmentCard = (appointment: UnifiedAppointment) => {
    const statusConfig = APPOINTMENT_STATUSES[appointment.status as keyof typeof APPOINTMENT_STATUSES];
    const startTime = format(new Date(appointment.start_datetime), 'h:mm a');
    const endTime = format(new Date(appointment.end_datetime), 'h:mm a');
    // console.log("Appointment: " + JSON.stringify(appointment), "Start datetime: " + startTime, "End datetime: " + endTime);

    const handleAppointmentClick = (e: React.MouseEvent) => {
      if (appointment.type === 'lead' && appointment.lead?.id) {
        router.push(`/dashboard/leads/${appointment.lead.id}/appointment`);
      } else if (appointment.type === 'borrower' && appointment.borrower?.id) {
        router.push(`/dashboard/borrowers/${appointment.borrower.id}/appointments`);
      }
    };

    const handleMouseEnter = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const modalWidth = 320; // w-80 = 320px
      const modalHeight = 400; // Estimated max height
      const padding = 10; // Padding from edges
      
      // Calculate optimal position
      let x = rect.left + rect.width + padding; // Default: right side
      let y = rect.top; // Default: align with top
      
      // Check horizontal boundaries
      if (x + modalWidth > window.innerWidth - padding) {
        // Not enough space on right, show on left
        x = rect.left - modalWidth - padding;
        
        // If still doesn't fit on left, position to stay within viewport
        if (x < padding) {
          x = window.innerWidth - modalWidth - padding;
        }
      }
      
      // Check vertical boundaries
      if (y + modalHeight > window.innerHeight - padding) {
        // Position above if not enough space below
        y = rect.bottom - modalHeight;
        
        // If still doesn't fit above, center vertically in viewport
        if (y < padding) {
          y = Math.max(padding, (window.innerHeight - modalHeight) / 2);
        }
      }
      
      // Ensure position is never negative or outside viewport
      x = Math.max(padding, Math.min(x, window.innerWidth - modalWidth - padding));
      y = Math.max(padding, Math.min(y, window.innerHeight - modalHeight - padding));
      
      setModalPosition({ x, y });
      setHoveredAppointment(appointment);
      console.log("Hovered appointment: " + JSON.stringify(appointment));
    };

    const handleMouseLeave = () => {
      setHoveredAppointment(null);
    };

    return (
      <div
        key={appointment.id}
        onClick={handleAppointmentClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onAuxClick={(e) => {
          if (e.button === 1) { // Middle mouse button
            e.preventDefault();
            router.push(`/dashboard/appointments/${appointment.id}`);
          }
        }}
        className={`
          mb-1 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-xs shadow-sm
          ${statusConfig?.bg ?? 'bg-gray-50'} 
          ${statusConfig?.border ?? 'border-gray-200'} 
          border-l-3 hover:shadow-md hover:-translate-y-0.5 group relative w-full max-w-full overflow-x-hidden
        `}
        title={`${
          appointment.type === 'lead' 
            ? appointment.lead?.full_name ?? 'Unknown Lead'
            : appointment.borrower?.name ?? 'Unknown Borrower'
        } - ${startTime} to ${endTime}\nClick to open details`}
      >
        {/* Name with Status Indicator and Type Badge */}
        <div className="flex items-center justify-between w-full mb-1">
          <div className="flex items-center flex-1 min-w-0">
            <span className="font-semibold text-gray-900 truncate text-xs leading-tight">
              {appointment.type === 'lead' 
                ? appointment.lead?.full_name ?? 'Unknown Lead'
                : appointment.borrower?.name ?? 'Unknown Borrower'
              }
            </span>
            {/* Type Badge */}
            <span className={`ml-1 px-1 py-0.5 rounded text-xs font-bold ${
              appointment.type === 'lead' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-purple-100 text-purple-800'
            }`}>
              {appointment.type === 'lead' ? 'New' : 'Reloan'}
            </span>
          </div>
          <div className="flex-shrink-0 ml-1">
            {getStatusBadge(appointment.status)}
          </div>
        </div>

        {/* Time Display */}
        <div className="text-gray-600 text-xs font-medium truncate w-full mb-1">
          {startTime}
        </div>

        {/* Agent Information for Borrower Appointments */}
        {/* {appointment.type === 'borrower' && appointment.agent_name && (
          <div className="text-gray-500 text-xs truncate w-full mb-1">
            Agent: {appointment.agent_name}
          </div>
        )} */}

        {/* Loan Status for TUR Appointments */}
        {appointment.status === 'done' && appointment.loan_status && (
          <div className="text-xs font-medium mb-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
              appointment.loan_status === 'P' ? 'bg-green-100 text-green-800' :
              appointment.loan_status === 'PRS' ? 'bg-blue-100 text-blue-800' :
              appointment.loan_status === 'RS' ? 'bg-yellow-100 text-yellow-800' :
              appointment.loan_status === 'R' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {appointment.loan_status}
            </span>
          </div>
        )}

        {/* Phone Number */}
        {appointment.type === 'lead' && appointment.lead?.phone_number && (
          <div className="text-gray-500 text-xs truncate w-full font-medium">
            {appointment.lead.phone_number}
          </div>
        )}
        {appointment.type === 'borrower' && appointment.borrower?.phone && (
          <div className="text-gray-500 text-xs truncate w-full font-medium">
            +65{appointment.borrower.phone}
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
                  <span className="capitalize text-sm font-medium">{getDisplayStatus(status)}</span>
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
                    {statusUpdateResults.results.map((result, index: number) => (
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

      {/* Enhanced Statistics Breakdown */}
      {filteredAppointments.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(() => {
              const newLoanAppointments = filteredAppointments.filter(apt => apt.type === 'lead');
              const reloanAppointments = filteredAppointments.filter(apt => apt.type === 'borrower');
              const totalAgents = new Set(filteredAppointments.map(apt => apt.agent_name).filter(Boolean)).size;
              const turAppointments = filteredAppointments.filter(apt => apt.status === 'done');
              
              return (
                <>
                  {/* New Loan Appointments */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <UserIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-sm font-medium text-gray-600">New Loan Appointments</p>
                        <div className="flex items-baseline">
                          <p className="text-2xl font-bold text-gray-900">{newLoanAppointments.length}</p>
                          <p className="ml-2 text-sm font-medium text-blue-600">
                            {filteredAppointments.length > 0 ? Math.round((newLoanAppointments.length / filteredAppointments.length) * 100) : 0}%
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">of total appointments</p>
                      </div>
                    </div>
                  </div>

                  {/* Reloan Appointments */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <UsersIcon className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-sm font-medium text-gray-600">Reloan Appointments</p>
                        <div className="flex items-baseline">
                          <p className="text-2xl font-bold text-gray-900">{reloanAppointments.length}</p>
                          <p className="ml-2 text-sm font-medium text-purple-600">
                            {filteredAppointments.length > 0 ? Math.round((reloanAppointments.length / filteredAppointments.length) * 100) : 0}%
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">of total appointments</p>
                      </div>
                    </div>
                  </div>

                  {/* TUR Completed */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <CheckCircleIcon className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-sm font-medium text-gray-600">TUR Completed</p>
                        <div className="flex items-baseline">
                          <p className="text-2xl font-bold text-gray-900">{turAppointments.length}</p>
                          <p className="ml-2 text-sm font-medium text-green-600">
                            {filteredAppointments.length > 0 ? Math.round((turAppointments.length / filteredAppointments.length) * 100) : 0}%
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">completion rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Active Agents */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <div className="p-2 bg-orange-50 rounded-lg">
                        <UsersIcon className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-sm font-medium text-gray-600">Active Agents</p>
                        <div className="flex items-baseline">
                          <p className="text-2xl font-bold text-gray-900">{totalAgents}</p>
                          <p className="ml-2 text-sm font-medium text-orange-600">agents</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">contributing to appointments</p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Appointment Type Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Appointment Type Analysis</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* New Loan Appointments */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="text-md font-medium text-blue-800 mb-4 flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  New Loan Appointments
                </h4>
                <div className="space-y-3">
                  {Object.entries(APPOINTMENT_STATUSES).map(([status, config]) => {
                    const newLoanAppointments = filteredAppointments.filter(apt => apt.type === 'lead');
                    const count = newLoanAppointments.filter(apt => apt.status === status).length;
                    const percentage = newLoanAppointments.length > 0 ? Math.round((count / newLoanAppointments.length) * 100) : 0;
                    
                    if (count === 0) return null;
                    
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <config.icon className={`h-4 w-4 mr-2 ${config.color}`} />
                          <span className="capitalize font-medium text-gray-700">{getDisplayStatus(status)}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${config.color.replace('text-', 'bg-').replace('-600', '-500')}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 w-6 text-right">{count}</span>
                          <span className="text-xs text-gray-500 w-8 text-right">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reloan Appointments */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="text-md font-medium text-purple-800 mb-4 flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                  Reloan Appointments
                </h4>
                <div className="space-y-3">
                  {Object.entries(APPOINTMENT_STATUSES).map(([status, config]) => {
                    const reloanAppointments = filteredAppointments.filter(apt => apt.type === 'borrower');
                    const count = reloanAppointments.filter(apt => apt.status === status).length;
                    const percentage = reloanAppointments.length > 0 ? Math.round((count / reloanAppointments.length) * 100) : 0;
                    
                    if (count === 0) return null;
                    
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <config.icon className={`h-4 w-4 mr-2 ${config.color}`} />
                          <span className="capitalize font-medium text-gray-700">{getDisplayStatus(status)}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${config.color.replace('text-', 'bg-').replace('-600', '-500')}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 w-6 text-right">{count}</span>
                          <span className="text-xs text-gray-500 w-8 text-right">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* TUR Loan Status Breakdown */}
          {filteredAppointments.filter(apt => apt.status === 'done').length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">TUR Appointments - Loan Status</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* New Loan TUR */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="text-md font-medium text-green-800 mb-4 flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    New Loan TUR Results
                  </h4>
                  <div className="space-y-3">
                    {[
                      { status: 'P', label: 'Done', color: 'text-green-600 bg-green-500' },
                      { status: 'PRS', label: 'Customer Rejected', color: 'text-blue-600 bg-blue-500' },
                      { status: 'RS', label: 'Rejected with Special Reason', color: 'text-yellow-600 bg-yellow-500' },
                      { status: 'R', label: 'Rejected', color: 'text-red-600 bg-red-500' }
                    ].map(({ status, label, color }) => {
                      const newLoanTur = filteredAppointments.filter(apt => apt.status === 'done' && apt.type === 'lead');
                      const count = newLoanTur.filter(apt => apt.loan_status === status).length;
                      const percentage = newLoanTur.length > 0 ? Math.round((count / newLoanTur.length) * 100) : 0;
                      
                      if (count === 0) return null;
                      
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${color.split(' ')[1]}`}></div>
                            <span className="font-medium text-gray-700">{status} - {label}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={color.split(' ')[1]}
                                style={{ width: `${percentage}%`, height: '100%', borderRadius: '9999px' }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 w-6 text-right">{count}</span>
                            <span className="text-xs text-gray-500 w-8 text-right">{percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reloan TUR */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="text-md font-medium text-purple-800 mb-4 flex items-center">
                    <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                    Reloan TUR Results
                  </h4>
                  <div className="space-y-3">
                    {[
                      { status: 'P', label: 'Done', color: 'text-green-600 bg-green-500' },
                      { status: 'PRS', label: 'Customer Rejected', color: 'text-blue-600 bg-blue-500' },
                      { status: 'RS', label: 'Rejected with Special Reason', color: 'text-yellow-600 bg-yellow-500' },
                      { status: 'R', label: 'Rejected', color: 'text-red-600 bg-red-500' }
                    ].map(({ status, label, color }) => {
                      const reloanTur = filteredAppointments.filter(apt => apt.status === 'done' && apt.type === 'borrower');
                      const count = reloanTur.filter(apt => apt.loan_status === status).length;
                      const percentage = reloanTur.length > 0 ? Math.round((count / reloanTur.length) * 100) : 0;
                      
                      if (count === 0) return null;
                      
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${color.split(' ')[1]}`}></div>
                            <span className="font-medium text-gray-700">{status} - {label}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={color.split(' ')[1]}
                                style={{ width: `${percentage}%`, height: '100%', borderRadius: '9999px' }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 w-6 text-right">{count}</span>
                            <span className="text-xs text-gray-500 w-8 text-right">{percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent Performance Analysis */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Agent Performance Analysis</h3>
            
            <div className="space-y-6">
              {(() => {
                const agentStats: Record<string, {
                  name: string;
                  email: string | null;
                  newLoan: {
                    total: number;
                    statuses: Record<string, number>;
                    loanStatuses: Record<string, number>;
                  };
                  reloan: {
                    total: number;
                    statuses: Record<string, number>;
                    loanStatuses: Record<string, number>;
                  };
                }> = {};
                
                // Collect stats by agent and appointment type
                filteredAppointments.forEach(apt => {
                  const agentName = apt.agent_name ?? 
                    (apt.agent?.first_name && apt.agent?.last_name ? 
                      `${apt.agent.first_name} ${apt.agent.last_name}` : 
                      'Unknown Agent');
                  const agentEmail = apt.agent_email ?? apt.agent?.email ?? '';
                  
                  agentStats[agentName] ??= {
                    name: agentName,
                    email: agentEmail,
                    newLoan: { total: 0, statuses: {}, loanStatuses: {} },
                    reloan: { total: 0, statuses: {}, loanStatuses: {} }
                  };
                  
                  const appointmentType = apt.type === 'lead' ? 'newLoan' : 'reloan';
                  agentStats[agentName][appointmentType].total++;
                  agentStats[agentName][appointmentType].statuses[apt.status] = 
                    (agentStats[agentName][appointmentType].statuses[apt.status] ?? 0) + 1;
                  
                  if (apt.status === 'done' && apt.loan_status) {
                    agentStats[agentName][appointmentType].loanStatuses[apt.loan_status] = 
                      (agentStats[agentName][appointmentType].loanStatuses[apt.loan_status] ?? 0) + 1;
                  }
                });

                return Object.values(agentStats)
                  .sort((a, b) => (b.newLoan.total + b.reloan.total) - (a.newLoan.total + a.reloan.total))
                  .map(agent => (
                    <div key={agent.name} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                            <UserIcon className="h-5 w-5 mr-2 text-blue-600" />
                            {agent.name}
                          </h4>
                          {agent.email && (
                            <p className="text-sm text-gray-500 mt-1">{agent.email}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-gray-900">{agent.newLoan.total + agent.reloan.total}</span>
                          <p className="text-sm text-gray-500">total appointments</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* New Loan Performance */}
                        <div className="border-l-4 border-blue-500 pl-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-md font-semibold text-blue-800 flex items-center">
                              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                              New Loan Appointments
                            </h5>
                            <span className="text-lg font-bold text-blue-600">{agent.newLoan.total}</span>
                          </div>
                          
                          {agent.newLoan.total > 0 && (
                            <div className="space-y-2">
                              {Object.entries(APPOINTMENT_STATUSES).map(([status, config]) => {
                                const count = agent.newLoan.statuses[status] ?? 0;
                                const percentage = agent.newLoan.total > 0 ? Math.round((count / agent.newLoan.total) * 100) : 0;
                                
                                if (count === 0) return null;
                                
                                return (
                                  <div key={status} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center">
                                      <config.icon className={`h-3 w-3 mr-1 ${config.color}`} />
                                      <span className="capitalize">{getDisplayStatus(status)}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <div className="w-10 bg-gray-200 rounded-full h-1.5">
                                        <div 
                                          className={`h-1.5 rounded-full ${config.color.replace('text-', 'bg-').replace('-600', '-500')}`}
                                          style={{ width: `${percentage}%` }}
                                        ></div>
                                      </div>
                                      <span className="font-medium w-4 text-right">{count}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* New Loan TUR Results */}
                              {Object.keys(agent.newLoan.loanStatuses).length > 0 && (
                                <div className="mt-3 pt-2 border-t border-gray-200">
                                  <p className="text-xs font-medium text-gray-600 mb-2">TUR Results:</p>
                                  {[
                                    { status: 'P', label: 'Done', color: 'bg-green-500' },
                                    { status: 'PRS', label: 'Customer Rejected', color: 'bg-blue-500' },
                                    { status: 'RS', label: 'Rejected with Special Reason', color: 'bg-yellow-500' },
                                    { status: 'R', label: 'Rejected', color: 'bg-red-500' }
                                  ].map(({ status, label, color }) => {
                                    const count = agent.newLoan.loanStatuses[status] ?? 0;
                                    if (count === 0) return null;
                                    
                                    return (
                                      <div key={status} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center">
                                          <div className={`w-2 h-2 rounded-full mr-1 ${color}`}></div>
                                          <span>{status}</span>
                                        </div>
                                        <span className="font-medium">{count}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Reloan Performance */}
                        <div className="border-l-4 border-purple-500 pl-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-md font-semibold text-purple-800 flex items-center">
                              <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                              Reloan Appointments
                            </h5>
                            <span className="text-lg font-bold text-purple-600">{agent.reloan.total}</span>
                          </div>
                          
                          {agent.reloan.total > 0 && (
                            <div className="space-y-2">
                              {Object.entries(APPOINTMENT_STATUSES).map(([status, config]) => {
                                const count = agent.reloan.statuses[status] ?? 0;
                                const percentage = agent.reloan.total > 0 ? Math.round((count / agent.reloan.total) * 100) : 0;
                                
                                if (count === 0) return null;
                                
                                return (
                                  <div key={status} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center">
                                      <config.icon className={`h-3 w-3 mr-1 ${config.color}`} />
                                      <span className="capitalize">{getDisplayStatus(status)}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <div className="w-10 bg-gray-200 rounded-full h-1.5">
                                        <div 
                                          className={`h-1.5 rounded-full ${config.color.replace('text-', 'bg-').replace('-600', '-500')}`}
                                          style={{ width: `${percentage}%` }}
                                        ></div>
                                      </div>
                                      <span className="font-medium w-4 text-right">{count}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* Reloan TUR Results */}
                              {Object.keys(agent.reloan.loanStatuses).length > 0 && (
                                <div className="mt-3 pt-2 border-t border-gray-200">
                                  <p className="text-xs font-medium text-gray-600 mb-2">TUR Results:</p>
                                  {[
                                    { status: 'P', label: 'Done', color: 'bg-green-500' },
                                    { status: 'PRS', label: 'Customer Rejected', color: 'bg-blue-500' },
                                    { status: 'RS', label: 'Rejected with Special Reason', color: 'bg-yellow-500' },
                                    { status: 'R', label: 'Rejected', color: 'bg-red-500' }
                                  ].map(({ status, label, color }) => {
                                    const count = agent.reloan.loanStatuses[status] ?? 0;
                                    if (count === 0) return null;
                                    
                                    return (
                                      <div key={status} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center">
                                          <div className={`w-2 h-2 rounded-full mr-1 ${color}`}></div>
                                          <span>{status}</span>
                                        </div>
                                        <span className="font-medium">{count}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
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
                  onChange={(e) => {
                    console.log("quickCreateData", quickCreateData);
                    setQuickCreateData(prev => ({ ...prev, timeSlot: e.target.value }));
                  }}
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
                  onChange={(e) => {
                    console.log("quickCreateData", quickCreateData);
                    setQuickCreateData(prev => ({ ...prev, leadName: e.target.value }));
                  }}
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
                  onChange={(e) => {
                    console.log("quickCreateData", quickCreateData);
                    setQuickCreateData(prev => ({ ...prev, phoneNumber: e.target.value }));
                  }}
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

      {/* Hover Modal for Appointment Details */}
      {hoveredAppointment && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 max-h-108 overflow-y-auto"
          style={{
            left: modalPosition.x,
            top: modalPosition.y,
          }}
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h4 className="font-semibold text-gray-900">Appointment Details</h4>
              <div className="flex items-center">
                {getStatusBadge(hoveredAppointment.status)}
                <span className="ml-2 text-sm font-medium capitalize text-gray-700">
                  {getDisplayStatus(hoveredAppointment.status)}
                </span>
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">
                {hoveredAppointment.type === 'lead' ? 'Lead Information' : 'Borrower Information'}
              </h5>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Name:</span> {
                  hoveredAppointment.type === 'lead' 
                    ? hoveredAppointment.lead?.full_name ?? 'Unknown'
                    : hoveredAppointment.borrower?.name ?? 'Unknown'
                }</div>
                <div><span className="font-medium">Type:</span> 
                  <span className={`ml-1 px-2 py-1 rounded text-xs font-bold ${
                    hoveredAppointment.type === 'lead' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {hoveredAppointment.type === 'lead' ? 'Lead' : 'Borrower'}
                  </span>
                </div>
                {(() => {
                  const getPhoneNumber = () => {
                    if (hoveredAppointment.type === 'lead') {
                      return hoveredAppointment.lead?.phone_number;
                    }
                    if (hoveredAppointment.type === 'borrower') {
                      return hoveredAppointment.borrower?.phone;
                    }
                    return null;
                  };
                  
                  const phoneNumber = getPhoneNumber();
                  if (!phoneNumber) return null;
                  
                  return (
                    <div className="flex items-center">
                      <PhoneIcon className="h-3 w-3 mr-1" />
                      <span>{phoneNumber}</span>
                    </div>
                  );
                })()}
                {hoveredAppointment.type === 'lead' && hoveredAppointment.lead?.email && (
                  <div><span className="font-medium">Email:</span> {hoveredAppointment.lead.email}</div>
                )}
              </div>
            </div>

            {/* Appointment Time */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Schedule</h5>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Date:</span> {format(new Date(hoveredAppointment.start_datetime), 'EEEE, MMMM d, yyyy')}</div>
                <div><span className="font-medium">Time:</span> {format(new Date(hoveredAppointment.start_datetime), 'h:mm a')} - {format(new Date(hoveredAppointment.end_datetime), 'h:mm a')}</div>
              </div>
            </div>

            {/* Creator Information */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Booked By</h5>
              <div className="text-sm space-y-1">
                                                 <div className="flex items-center">
                  <UserIcon className="h-3 w-3 mr-1" />
                  <span>{hoveredAppointment.agent_name ?? 
                    (hoveredAppointment.agent?.first_name && hoveredAppointment.agent?.last_name ? 
                      `${hoveredAppointment.agent.first_name} ${hoveredAppointment.agent.last_name}` : 
                      'Unknown Agent')}</span>
                </div>
                <div className="text-gray-500">
                  {hoveredAppointment.created_at ? format(new Date(hoveredAppointment.created_at), 'MMM d, yyyy h:mm a') : 'Unknown date'}
                </div>
              </div>
            </div>

            {/* Loan Status for TUR Appointments */}
            {hoveredAppointment.status === 'done' && hoveredAppointment.loan_status && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-1">Loan Status</h5>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-sm font-bold ${
                    hoveredAppointment.loan_status === 'P' ? 'bg-green-100 text-green-800' :
                    hoveredAppointment.loan_status === 'PRS' ? 'bg-blue-100 text-blue-800' :
                    hoveredAppointment.loan_status === 'RS' ? 'bg-yellow-100 text-yellow-800' :
                    hoveredAppointment.loan_status === 'R' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {hoveredAppointment.loan_status}
                  </span>
                  <span className="text-sm text-gray-600">
                    {hoveredAppointment.loan_status === 'P' ? 'Done' :
                     hoveredAppointment.loan_status === 'PRS' ? 'Customer Rejected' :
                     hoveredAppointment.loan_status === 'RS' ? 'Rejected With Special Reason' :
                     hoveredAppointment.loan_status === 'R' ? 'Rejected' :
                     'Unknown Status'}
                  </span>
                </div>
                {hoveredAppointment.loan_notes && (
                  <div className="mt-1 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    <span className="font-medium">Notes:</span> {hoveredAppointment.loan_notes}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {hoveredAppointment.notes && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-1">Notes</h5>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {hoveredAppointment.notes}
                </div>
              </div>
            )}

            {/* Action Button */}
            {/* <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => router.push(`/dashboard/leads/${hoveredAppointment.lead?.id}/appointment`)}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                View Full Details
              </button>
            </div> */}
          </div>
        </div>
      )}
    </div>
  );
}

