"use client";

import { useState, useEffect } from 'react';
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
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { fetchAppointments } from '~/app/_actions/appointmentAction';
import { format, parseISO, addDays, startOfDay, endOfDay } from 'date-fns';

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  useEffect(() => {
    const fetchAppointmentData = async () => {
      setLoading(true);
      try {
        let filters: any = {};
        
        if (activeFilter === 'today') {
          filters.date = new Date();
          filters.view = 'day';
        } else if (activeFilter === 'upcoming') {
          filters.view = 'upcoming';
        } else if (activeFilter === 'past') {
          filters.view = 'past';
        } else if (activeFilter === 'search' && searchQuery.trim() !== '') {
          filters.searchQuery = searchQuery;
        }
        
        const fetchedAppointments = await fetchAppointments(filters);
        setAppointments(fetchedAppointments);
        setFilteredAppointments(fetchedAppointments);
      } catch (error) {
        console.error("Error fetching appointments:", error);
      } finally {
        setLoading(false);
      }
    };
    
    void fetchAppointmentData();
  }, [activeFilter, searchQuery, selectedDate]);
  
  const handleStatusChange = async (appointmentId: number, newStatus: string) => {
    try {
      // Call the update status function
      // This would be implemented in the appointmentAction.ts file
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        // Update the local state
        setAppointments(prev => 
          prev.map(app => 
            app.id === appointmentId ? { ...app, status: newStatus } : app
          )
        );
      }
    } catch (error) {
      console.error("Error updating appointment status:", error);
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
      case 'done':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      case 'missed':
        return <ExclamationCircleIcon className="h-5 w-5 text-gray-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
    }
  };
  
  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return format(date, 'EEE, MMM d, yyyy');
  };
  
  const formatTime = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return format(date, 'h:mm a');
  };
  
  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'next' 
      ? addDays(selectedDate, 1) 
      : addDays(selectedDate, -1);
    
    setSelectedDate(newDate);
    setActiveFilter('custom');
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Appointments</h1>
        
        <div className="flex items-center space-x-2">
          <button 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
            onClick={() => router.push('/dashboard/leads')}
          >
            <PlusIcon className="h-5 w-5" />
            <span>Schedule New</span>
          </button>

          <button
            className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-200"
            onClick={() => router.push('/dashboard/appointments/settings')}
          >
            <CalendarIcon className="h-5 w-5" />
            <span>Settings</span>
          </button>
        </div>
      </div>
      
      {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveFilter('today')}
            className={`px-3 py-1.5 text-sm rounded-md ${
              activeFilter === 'today' 
                ? 'bg-white shadow-sm text-blue-700' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveFilter('upcoming')}
            className={`px-3 py-1.5 text-sm rounded-md ${
              activeFilter === 'upcoming' 
                ? 'bg-white shadow-sm text-blue-700' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveFilter('past')}
            className={`px-3 py-1.5 text-sm rounded-md ${
              activeFilter === 'past' 
                ? 'bg-white shadow-sm text-blue-700' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Past
          </button>
        </div>
        
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search appointments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      {/* Date navigator - visible when filter is 'today' or 'custom' */}
      {(activeFilter === 'today' || activeFilter === 'custom') && (
        <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
          <button 
            onClick={() => navigateDay('prev')}
            className="p-1 rounded-full hover:bg-gray-200"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-700" />
          </button>
          
          <div className="font-medium text-gray-900">
            {formatDate(selectedDate)}
          </div>
          
          <button 
            onClick={() => navigateDay('next')}
            className="p-1 rounded-full hover:bg-gray-200"
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      )}
      
      {/* Appointments list */}
      {filteredAppointments.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredAppointments.map((appointment) => (
              <li key={appointment.id}>
                <div 
                  className="block hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/dashboard/appointments/${appointment.id}`)}
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="mr-4">
                          {getStatusIcon(appointment.status)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-600 truncate">
                            {appointment.lead.first_name} {appointment.lead.last_name}
                          </p>
                          <p className="flex items-center text-sm text-gray-500">
                            <span>{appointment.lead.phone_number}</span>
                            {appointment.is_urgent && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                <ExclamationCircleIcon className="h-3 w-3 mr-1" />
                                Urgent
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex flex-col items-end">
                        <p className="text-sm text-gray-900">
                          {formatDate(appointment.start_datetime)}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {formatTime(appointment.start_datetime)} - {formatTime(appointment.end_datetime)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeFilter === 'search' 
              ? 'Try adjusting your search criteria.' 
              : 'Get started by scheduling an appointment with a lead.'}
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push('/dashboard/leads')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Schedule New Appointment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
