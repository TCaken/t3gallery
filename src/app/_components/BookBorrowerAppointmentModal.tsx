"use client";

import { useState, useEffect } from "react";
import { createBorrowerAppointment } from "~/app/_actions/borrowerAppointments";
import { fetchAvailableTimeslots, type Timeslot } from "~/app/_actions/appointmentAction";
import { useUser } from "@clerk/nextjs";
import { 
  XMarkIcon, 
  CalendarIcon, 
  ClockIcon,
  ExclamationTriangleIcon 
} from "@heroicons/react/24/outline";
import { format, addDays } from "date-fns";

interface BookBorrowerAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrowerId: number;
  borrowerName: string;
  onSuccess?: () => void;
}

export default function BookBorrowerAppointmentModal({
  isOpen,
  onClose,
  borrowerId,
  borrowerName,
  onSuccess
}: BookBorrowerAppointmentModalProps) {
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTimeslot, setSelectedTimeslot] = useState<number | null>(null);
  const [appointmentType, setAppointmentType] = useState<string>("reloan_consultation");
  const [notes, setNotes] = useState<string>("");
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTimeslots, setLoadingTimeslots] = useState(false);
  const [error, setError] = useState<string>("");

  // Initialize with tomorrow's date
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    setSelectedDate(tomorrowStr ?? "");
  }, []);

  // Fetch timeslots when date changes
  useEffect(() => {
    if (selectedDate) {
      void fetchTimeslots(selectedDate);
    }
  }, [selectedDate]);

  const fetchTimeslots = async (date: string) => {
    setLoadingTimeslots(true);
    setSelectedTimeslot(null);
    try {
      const slots = await fetchAvailableTimeslots(date);
      setTimeslots(slots);
    } catch (error) {
      console.error("Error fetching timeslots:", error);
      setTimeslots([]);
    } finally {
      setLoadingTimeslots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedDate || !selectedTimeslot || !user?.id) {
      setError("Please fill in all required fields");
      return;
    }

    const selectedSlot = timeslots.find(slot => slot.id === selectedTimeslot);
    if (!selectedSlot) {
      setError("Selected timeslot not found");
      return;
    }

    setLoading(true);
    try {
      // Create start and end datetime
      const startDateTime = new Date(`${selectedDate}T${selectedSlot.start_time}`);
      const endDateTime = new Date(`${selectedDate}T${selectedSlot.end_time}`);

      const result = await createBorrowerAppointment({
        borrower_id: borrowerId,
        agent_id: user.id, // Auto-assign to current user
        appointment_type: appointmentType,
        notes: notes.trim() || undefined, // Optional notes
        start_datetime: startDateTime,
        end_datetime: endDateTime,
      });

      if (result.success) {
        onSuccess?.();
        onClose();
        // Reset form
        setSelectedDate("");
        setSelectedTimeslot(null);
        setAppointmentType("reloan_consultation");
        setNotes("");
      } else {
        setError("Failed to create appointment");
      }
    } catch (error) {
      console.error("Error creating appointment:", error);
      setError(error instanceof Error ? error.message : "Failed to create appointment");
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    return format(new Date(dateStr), "EEEE, MMMM d, yyyy");
  };

  const generateDateOptions = () => {
    const dates = [];
    const startDate = new Date();
    for (let i = 1; i <= 14; i++) { // Next 14 days
      const date = addDays(startDate, i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push({
        value: dateStr ?? "",
        label: format(date, "EEE, MMM d")
      });
    }
    return dates;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Book Appointment</h2>
            <p className="text-sm text-gray-600 mt-1">
              Scheduling appointment for <span className="font-medium">{borrowerName}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Will be assigned to: {user?.firstName} {user?.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="h-4 w-4 inline mr-1" />
              Select Date *
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Choose a date...</option>
              {generateDateOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedDate && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDisplayDate(selectedDate)}
              </p>
            )}
          </div>

          {/* Timeslot Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              Select Time *
            </label>
            {loadingTimeslots ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-pulse text-gray-500">Loading available times...</div>
              </div>
            ) : timeslots.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {timeslots.map(slot => {
                  const isFull = (slot.occupied_count ?? 0) >= (slot.max_capacity ?? 1);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={isFull}
                      onClick={() => !isFull && setSelectedTimeslot(slot.id)}
                      className={`
                        p-3 border rounded-lg text-left transition-colors
                        ${selectedTimeslot === slot.id
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                          : isFull
                            ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }
                      `}
                    >
                      <div className="font-medium text-sm">
                        {format(new Date(`2000-01-01T${slot.start_time}`), 'h:mm a')} - 
                        {format(new Date(`2000-01-01T${slot.end_time}`), 'h:mm a')}
                      </div>
                      <div className="text-xs mt-1">
                        <span className={isFull ? 'text-red-500' : 'text-green-600'}>
                          {slot.occupied_count ?? 0}/{slot.max_capacity ?? 1} booked
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : selectedDate ? (
              <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                No available timeslots for this date
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400 bg-gray-50 rounded-lg">
                Please select a date first
              </div>
            )}
          </div>

          {/* Appointment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Appointment Type
            </label>
            <select
              value={appointmentType}
              onChange={(e) => setAppointmentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="reloan_consultation">Reloan Consultation</option>
              <option value="follow_up">Follow Up</option>
              <option value="documentation">Documentation</option>
              <option value="payment_discussion">Payment Discussion</option>
              <option value="general">General Meeting</option>
            </select>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any relevant notes for this appointment..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedDate || !selectedTimeslot || loading}
              className={`
                px-4 py-2 rounded-lg text-white font-medium transition-colors
                ${(!selectedDate || !selectedTimeslot || loading)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                }
              `}
            >
              {loading ? 'Creating...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 