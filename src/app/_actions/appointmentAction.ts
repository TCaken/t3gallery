"use server";

import { db } from "~/server/db";
import { 
  appointments, 
  timeslots, 
  leads, 
  appointment_timeslots, 
  calendar_settings, 
  calendar_exceptions 
} from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { 
  eq, 
  and, 
  gte, 
  lte, 
  desc, 
  sql, 
  like, 
  or, 
  between,
  isNull,
  not
} from "drizzle-orm";
import { 
  format, 
  startOfDay, 
  endOfDay, 
  addDays, 
  addMinutes, 
  parseISO, 
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isWeekend
} from 'date-fns';

// Types
export type Timeslot = typeof timeslots.$inferSelect;
export type CalendarSetting = typeof calendar_settings.$inferSelect;
export type AppointmentWithLead = typeof appointments.$inferSelect & {
  lead: typeof leads.$inferSelect;
};

/**
 * Check if a lead has an active appointment
 */
export async function checkExistingAppointment(leadId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    const existingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.lead_id, leadId),
          eq(appointments.status, 'upcoming')
        )
      );
    
    return { 
      hasAppointment: existingAppointments.length > 0,
      appointment: existingAppointments.length > 0 ? existingAppointments[0] : null
    };
  } catch (error) {
    console.error("Error checking existing appointment:", error);
    return { hasAppointment: false, appointment: null };
  }
}

/**
 * Fetch available timeslots for a specific date
 */
export async function fetchAvailableTimeslots(date: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    // Convert string date to Date object for database query
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Get all timeslots for the selected date
    const availableSlots = await db
      .select()
      .from(timeslots)
      .where(
        and(
          eq(timeslots.date, selectedDate),
          eq(timeslots.is_disabled, false)
        )
      );
    
    return availableSlots;
  } catch (error) {
    console.error("Error fetching timeslots:", error);
    return [];
  }
}

/**
 * Create a new appointment (without updating lead status)
 */
export async function createAppointment(data: {
  leadId: number;
  timeslotId: number;
  notes: string;
  isUrgent: boolean;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    // First check if lead already has an active appointment
    const { hasAppointment } = await checkExistingAppointment(data.leadId);
    if (hasAppointment) {
      return { 
        success: false, 
        message: "This lead already has an active appointment. Please cancel it before creating a new one."
      };
    }
    
    // Get the selected timeslot to determine start and end times
    const [selectedSlot] = await db
      .select()
      .from(timeslots)
      .where(eq(timeslots.id, data.timeslotId));
    
    if (!selectedSlot) {
      return { success: false, message: "Selected timeslot not found" };
    }
    
    // Check if the timeslot is already at capacity
    const occupiedCount = selectedSlot.occupied_count ?? 0;
    const maxCapacity = selectedSlot.max_capacity ?? 1;
    if (occupiedCount >= maxCapacity) {
      return { success: false, message: "This timeslot is already fully booked" };
    }

    // Use a transaction to ensure all operations succeed or fail together
    return await db.transaction(async (tx) => {
      // Create the appointment
      const [newAppointment] = await tx
        .insert(appointments)
        .values({
          lead_id: data.leadId,
          agent_id: userId,
          status: 'upcoming',
          notes: data.notes,
          start_datetime: new Date(`${format(selectedSlot.date, 'yyyy-MM-dd')}T${selectedSlot.start_time}`),
          end_datetime: new Date(`${format(selectedSlot.date, 'yyyy-MM-dd')}T${selectedSlot.end_time}`),
          created_at: new Date(),
          created_by: userId
        })
        .returning();

      if (!newAppointment) {
        throw new Error("Failed to create appointment");
      }

      // Create the appointment_timeslot relationship
      await tx
        .insert(appointment_timeslots)
        .values({
          appointment_id: newAppointment.id,
          timeslot_id: data.timeslotId,
          primary: true
        });
      
      // Update the timeslot occupied count
      await tx
        .update(timeslots)
        .set({
          occupied_count: occupiedCount + 1,
          updated_at: new Date(),
          updated_by: userId
        })
        .where(eq(timeslots.id, data.timeslotId));
      
      // Note: Lead status update is now handled separately by updateLead function
      
      return { success: true, appointment: newAppointment };
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return { success: false, message: "Failed to create appointment" };
  }
}

/**
 * Cancel an appointment and update lead status
 */
export async function cancelAppointment(appointmentId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    // Get the appointment to be cancelled along with its associated timeslot
    const appointmentToCancel = await db
      .select({
        appointment: appointments,
        timeslot_id: appointment_timeslots.timeslot_id
      })
      .from(appointments)
      .leftJoin(
        appointment_timeslots, 
        eq(appointments.id, appointment_timeslots.appointment_id)
      )
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    
    if (appointmentToCancel.length === 0) {
      return { success: false, message: "Appointment not found" };
    }
    
    const leadId = appointmentToCancel[0].appointment.lead_id;
    
    // Update appointment status
    await db
      .update(appointments)
      .set({
        status: 'cancelled',
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(appointments.id, appointmentId));
    
    // Decrease the occupied count for the associated timeslot
    if (appointmentToCancel[0].timeslot_id) {
      const timeslotId = appointmentToCancel[0].timeslot_id;
      
      // Get current timeslot
      const [currentTimeslot] = await db
        .select()
        .from(timeslots)
        .where(eq(timeslots.id, timeslotId));
      
      if (currentTimeslot && currentTimeslot.occupied_count > 0) {
        await db
          .update(timeslots)
          .set({
            occupied_count: currentTimeslot.occupied_count - 1,
            updated_at: new Date(),
            updated_by: userId
          })
          .where(eq(timeslots.id, timeslotId));
      }
    }
    
    // Update lead status back to "new"
    await db
      .update(leads)
      .set({
        status: 'assigned',
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(leads.id, leadId));
    
    return { success: true };
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    return { success: false, message: "Failed to cancel appointment" };
  }
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(appointmentId: number, newStatus: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    // Get the appointment to be updated
    const [appointmentToUpdate] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    
    if (!appointmentToUpdate) {
      return { success: false, message: "Appointment not found" };
    }
    
    const leadId = appointmentToUpdate.lead_id;
    
    // Validate the new status
    const validStatuses = ['upcoming', 'done', 'missed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return { 
        success: false, 
        message: "Invalid status. Must be one of: upcoming, done, missed, cancelled" 
      };
    }
    
    // Update appointment status
    await db
      .update(appointments)
      .set({
        status: newStatus,
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(appointments.id, appointmentId));
    
    // Update lead status based on appointment status
    let leadStatus: string;
    
    switch (newStatus) {
      case 'done':
        leadStatus = 'done'; // Lead becomes a customer when appointment is done
        break;
      case 'upcoming':
        leadStatus = 'booked'; // Lead is booked when appointment is upcoming
        break;
      case 'missed':
        leadStatus = 'follow_up'; // Lead needs follow up when they missed appointment
        break;
      case 'cancelled':
        leadStatus = 'open'; // Lead goes back to open when appointment is cancelled
        break;
      default:
        leadStatus = 'open';
    }
    
    // Update the lead status
    await db
      .update(leads)
      .set({
        status: leadStatus,
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(leads.id, leadId));
    
    return { success: true };
  } catch (error) {
    console.error("Error updating appointment status:", error);
    return { success: false, message: "Failed to update appointment status" };
  }
}

/**
 * Fetch appointments with various filtering options
 */
export async function fetchAppointments(filters: {
  date?: Date;
  view?: string;
  searchQuery?: string;
  status?: string[];
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    let query = db
      .select({
        appointment: appointments,
        lead: leads
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id));
    
    // Apply date range filter (new method)
    if (filters.startDate && filters.endDate) {
      query = query.where(
        and(
          gte(appointments.start_datetime, filters.startDate),
          lte(appointments.start_datetime, filters.endDate)
        )
      );
    }
    // Apply single date filter (old method for backward compatibility)
    else if (filters.date && filters.view === 'day') {
      const dayStart = startOfDay(filters.date);
      const dayEnd = endOfDay(filters.date);
      
      query = query.where(
        and(
          gte(appointments.start_datetime, dayStart),
          lte(appointments.start_datetime, dayEnd)
        )
      );
    } else if (filters.view === 'upcoming') {
      // Only get appointments in the future
      query = query.where(gte(appointments.start_datetime, new Date()));
    } else if (filters.view === 'past') {
      // Only get appointments in the past
      query = query.where(lte(appointments.start_datetime, new Date()));
    }
    
    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      const statusConditions = filters.status.map(status => 
        eq(appointments.status, status)
      );
      query = query.where(or(...statusConditions));
    }
    
    // Apply search filter
    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      query = query.where(
        or(
          like(leads.full_name, searchTerm),
          like(leads.phone_number, searchTerm),
          like(leads.email, searchTerm),
          like(appointments.notes, searchTerm)
        )
      );
    }
    
    // Apply sorting
    if (filters.sortBy === 'start_datetime') {
      query = query.orderBy(appointments.start_datetime);
    } else {
      query = query.orderBy(desc(appointments.start_datetime));
    }
    
    const results = await query;
    
    // Transform results into the expected format
    return results.map(item => ({
      ...item.appointment,
      lead: item.lead
    })) as AppointmentWithLead[];
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return [];
  }
}

/**
 * Get a single appointment by ID
 */
export async function getAppointmentById(appointmentId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    const result = await db
      .select({
        appointment: appointments,
        lead: leads
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    
    if (result.length === 0) {
      return { success: false, message: "Appointment not found" };
    }
    
    return { 
      success: true, 
      appointment: {
        ...result[0].appointment,
        lead: result[0].lead
      } as AppointmentWithLead
    };
  } catch (error) {
    console.error("Error fetching appointment:", error);
    return { success: false, message: "Failed to fetch appointment" };
  }
}

/**
 * Create calendar settings
 */
export async function createCalendarSettings(data: {
  name: string;
  workingDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  dailyStartTime: string; // Format: "HH:MM:SS"
  dailyEndTime: string; // Format: "HH:MM:SS"
  slotDurationMinutes: number;
  defaultMaxCapacity: number;
  timezone?: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    const [settings] = await db.insert(calendar_settings).values({
      name: data.name,
      working_days: data.workingDays,
      daily_start_time: data.dailyStartTime,
      daily_end_time: data.dailyEndTime,
      slot_duration_minutes: data.slotDurationMinutes,
      default_max_capacity: data.defaultMaxCapacity,
      timezone: data.timezone ?? 'UTC',
      created_by: userId,
      created_at: new Date()
    }).returning();
    
    return { success: true, settings };
  } catch (error) {
    console.error("Error creating calendar settings:", error);
    return { 
      success: false, 
      message: `Failed to create calendar settings: ${(error as Error).message}` 
    };
  }
}

/**
 * Generate timeslots based on calendar settings
 */
export async function generateTimeslots(data: {
  calendarSettingId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    // Get calendar settings
    const [settings] = await db.select()
      .from(calendar_settings)
      .where(eq(calendar_settings.id, data.calendarSettingId))
      .limit(1);
    
    if (!settings) {
      return { success: false, message: "Calendar settings not found" };
    }
    
    const start = parseISO(data.startDate);
    const end = parseISO(data.endDate);
    
    // Get all days in the date range
    const daysInRange = eachDayOfInterval({ start, end });
    
    // Get exceptions (holidays, etc.)
    const exceptions = await db.select()
      .from(calendar_exceptions)
      .where(
        and(
          gte(calendar_exceptions.date, start),
          lte(calendar_exceptions.date, end)
        )
      );
    
    const workingDays = settings.working_days as number[] ?? [1, 2, 3, 4, 5]; // Default Mon-Fri
    const slotDuration = settings.slot_duration_minutes ?? 60; // Default 1 hour
    const startTime = settings.daily_start_time ?? '09:00:00'; // Default 9 AM
    const endTime = settings.daily_end_time ?? '17:00:00'; // Default 5 PM
    const maxCapacity = settings.default_max_capacity ?? 1;
    
    // Helper function to check if a date is a holiday/exception
    const isException = (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return exceptions.some(exc => 
        format(exc.date, 'yyyy-MM-dd') === dateStr && exc.is_closed
      );
    };
    
    // Generate timeslots for each working day
    const timeslotsToCreate = [];
    
    for (const day of daysInRange) {
      const dayOfWeek = day.getDay(); // 0-6, 0 is Sunday
      
      // Skip if not a working day or is an exception
      if (!workingDays.includes(dayOfWeek) || isException(day)) {
        continue;
      }
      
      // Create slots for this day
      let currentTime = parseISO(`${format(day, 'yyyy-MM-dd')}T${startTime}`);
      const endTimeForDay = parseISO(`${format(day, 'yyyy-MM-dd')}T${endTime}`);
      
      while (currentTime < endTimeForDay) {
        const slotEndTime = addMinutes(currentTime, slotDuration);
        
        if (slotEndTime <= endTimeForDay) {
          timeslotsToCreate.push({
            date: day,
            start_time: format(currentTime, 'HH:mm:ss'),
            end_time: format(slotEndTime, 'HH:mm:ss'),
            max_capacity: maxCapacity,
            calendar_setting_id: settings.id,
            created_by: userId,
            created_at: new Date()
          });
        }
        
        currentTime = slotEndTime;
      }
    }
    
    // Insert all generated timeslots
    if (timeslotsToCreate.length > 0) {
      const result = await db.insert(timeslots).values(timeslotsToCreate).returning();
      return { 
        success: true, 
        count: result.length,
        message: `Generated ${result.length} timeslots successfully`
      };
    } else {
      return { 
        success: false, 
        count: 0, 
        message: "No valid timeslots to generate in the given date range"
      };
    }
  } catch (error) {
    console.error("Error generating timeslots:", error);
    return { 
      success: false, 
      message: `Failed to generate timeslots: ${(error as Error).message}` 
    };
  }
}
