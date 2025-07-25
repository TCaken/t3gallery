"use server";

import { db } from "~/server/db";
import { 
  appointments, 
  timeslots, 
  leads, 
  appointment_timeslots, 
  calendar_settings, 
  calendar_exceptions,
  users
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
  not,
  asc
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
  agent: typeof users.$inferSelect;
};

// Enhanced appointment type with creator and agent information
export type EnhancedAppointment = {
  id: number;
  lead_id: number;
  agent_id: string;
  status: string;
  loan_status: string | null;
  loan_notes: string | null;
  notes: string | null;
  start_datetime: Date;
  end_datetime: Date;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  creator_name: string;
  creator_email: string | null;
  agent_name: string;
  agent_email: string | null;
  lead_name: string | null;
  lead_status: string | null;
  lead_loan_status: string | null;
  assigned_user_name: string;
  assigned_user_email: string | null;
};

/**
 * Check if a lead has an active appointment
 */
export async function checkExistingAppointment(leadId: number, overrideUserId?: string) {
  // Support API key authentication
  let userId: string;
  
  if (overrideUserId) {
    userId = overrideUserId;
  } else {
    // Fall back to Clerk authentication if no override provided
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Not authenticated");
    userId = clerkUserId;
  }
  
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
export async function fetchAvailableTimeslots(date: string, overrideUserId?: string) {
  // Support API key authentication
  let userId: string;
  
  if (overrideUserId) {
    userId = overrideUserId;
  } else {
    // Fall back to Clerk authentication if no override provided
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Not authenticated");
    userId = clerkUserId;
  }
  
  try {
    // Convert string date to the format the database expects (YYYY-MM-DD)
    // Don't create a Date object to avoid timezone issues
    const selectedDateString = date; // Input should already be in YYYY-MM-DD format
    
    console.log('🔍 Fetching timeslots for date:', selectedDateString);
    
    // Get all timeslots for the selected date, ordered by start time
    const availableSlots = await db
      .select()
      .from(timeslots)
      .where(
        and(
          eq(timeslots.date, selectedDateString), // Use string directly
          eq(timeslots.is_disabled, false)
        )
      )
      .orderBy(timeslots.start_time); // Sort by start time in ascending order
    
    console.log('🔍 Found timeslots:', availableSlots.length);
    
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
  overrideUserId?: string; // Add support for API key authentication
}) {
  // Support API key authentication
  let userId: string;
  
  // console.log('🔍 Creating appointment with overrideUserId:', data.overrideUserId);
  console.log("Input data:", data);
  if(data.overrideUserId) {
    console.log("Override user ID:", data.overrideUserId);
  }
  else{
    console.log("No override user ID");
  }
  if (data.overrideUserId) {
    userId = data.overrideUserId;
  } else {
    // Fall back to Clerk authentication if no override provided
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Not authenticated");
    userId = clerkUserId;
  }
  
  try {
    // First check if lead already has an active appointment
    const { hasAppointment } = await checkExistingAppointment(data.leadId, data.overrideUserId);
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
    console.log('🔍 Occupied count:', occupiedCount);
    // const maxCapacity = selectedSlot.max_capacity ?? 1;
    // if (occupiedCount >= maxCapacity) {
    //   return { success: false, message: "This timeslot is already fully booked" };
    // }

    // Use a transaction to ensure all operations succeed or fail together
    return await db.transaction(async (tx) => {
      // Get the lead to access its source
      const [lead] = await tx
        .select({
          source: leads.source
        })
        .from(leads)
        .where(eq(leads.id, data.leadId));
      
      if (!lead) {
        throw new Error("Lead not found");
      }
      
      // Create appointment datetime strings and convert to UTC properly
      const slotDate = typeof selectedSlot.date === 'string' ? selectedSlot.date : format(selectedSlot.date, 'yyyy-MM-dd');
      const startTimeString = `${slotDate}T${selectedSlot.start_time}`;
      const endTimeString = `${slotDate}T${selectedSlot.end_time}`;
      
      console.log('🕐 Creating appointment with timezone conversion:');
      console.log('Slot date:', slotDate);
      console.log('Start time string (SGT):', startTimeString);
      console.log('End time string (SGT):', endTimeString);
      console.log('Lead source:', lead.source);
      
      // Parse as Singapore time and convert to UTC
      // Method 1: Manual timezone conversion (SGT = UTC+8)
      const startSGT = new Date(startTimeString);
      const endSGT = new Date(endTimeString);
      
      // Convert to UTC by subtracting 8 hours (Singapore offset)
      const startUTC = new Date(startSGT.getTime() - (8 * 60 * 60 * 1000));
      const endUTC = new Date(endSGT.getTime() - (8 * 60 * 60 * 1000));
      
      console.log('Start SGT:', startSGT.toISOString());
      console.log('Start UTC (for DB):', startUTC.toISOString());
      console.log('End SGT:', endSGT.toISOString());
      console.log('End UTC (for DB):', endUTC.toISOString());
      
      // Create the appointment with lead source
      const [newAppointment] = await tx
        .insert(appointments)
        .values({
          lead_id: data.leadId,
          agent_id: userId,
          status: 'upcoming',
          notes: data.notes,
          lead_source: lead.source, // Capture the lead source when appointment is created
          start_datetime: startUTC,
          end_datetime: endUTC,
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
      
      // Send appointment data to webhook ONLY if appointment is for today (Singapore time)
      try {
        // Get today's date in Singapore timezone (UTC+8)
        const now = new Date();
        const singaporeOffset = 8 * 60; // 8 hours in minutes
        const singaporeTime = new Date(now.getTime() + (singaporeOffset * 60 * 1000));
        const todaySingapore = singaporeTime.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Get appointment date (already in YYYY-MM-DD format)
        const appointmentDate = slotDate;
        
        console.log('🕐 Webhook date check:');
        console.log('Today (Singapore):', todaySingapore);
        console.log('Appointment date:', appointmentDate);
        
        // Only send webhook if appointment is for today
        if (appointmentDate === todaySingapore) {
          console.log('✅ Appointment is for today, sending webhook...');
          const { sendAppointmentToWebhook } = await import('./appointmentWebhookActions');
          
          const webhookResult = await sendAppointmentToWebhook(data.leadId, {
            appointmentDate: slotDate,
            appointmentTime: selectedSlot.start_time,
            appointmentType: "Consultation",
            notes: data.notes
          });
          
          if (webhookResult?.success) {
            console.log('✅ Appointment data sent to webhook successfully');
          } else {
            console.error('❌ Failed to send appointment data to webhook:', webhookResult?.error);
            // Don't fail the appointment creation if webhook fails
          }
        } else {
          console.log('ℹ️ Appointment is NOT for today, skipping webhook');
        }
      } catch (webhookError) {
        console.error('❌ Error calling webhook:', webhookError);
        // Don't fail the appointment creation if webhook fails
      }
      
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
export async function cancelAppointment(appointmentId: number, overrideUserId?: string) {
  // Support API key authentication
  let userId: string;
  
  if (overrideUserId) {
    userId = overrideUserId;
  } else {
    // Fall back to Clerk authentication if no override provided
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Not authenticated");
    userId = clerkUserId;
  }
  
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
    
    if (appointmentToCancel.length === 0 || !appointmentToCancel[0]) {
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
      
      if (currentTimeslot && (currentTimeslot.occupied_count ?? 0) > 0) {
        await db
          .update(timeslots)
          .set({
            occupied_count: (currentTimeslot.occupied_count ?? 0) - 1,
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
export async function updateAppointmentStatus(appointmentId: number, newStatus: string, overrideUserId?: string) {
  // Support API key authentication
  let userId: string;
  
  if (overrideUserId) {
    userId = overrideUserId;
  } else {
    // Fall back to Clerk authentication if no override provided
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Not authenticated");
    userId = clerkUserId;
  }
  
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
    // Build all where conditions first
    const conditions = [];
    
    console.log("Filters: " + JSON.stringify(filters));
    
    // Date range filter
    if (filters.startDate && filters.endDate) {
      console.log("Applying date range filter");
      conditions.push(
        and(
          gte(appointments.start_datetime, filters.startDate),
          lte(appointments.start_datetime, filters.endDate)
        )
      );
    }
    // Single date filter (backward compatibility)
    else if (filters.date && filters.view === 'day') {
      const dayStart = startOfDay(filters.date);
      const dayEnd = endOfDay(filters.date);
      conditions.push(
        and(
          gte(appointments.start_datetime, dayStart),
          lte(appointments.start_datetime, dayEnd)
        )
      );
    } else if (filters.view === 'upcoming') {
      conditions.push(gte(appointments.start_datetime, new Date()));
    } else if (filters.view === 'past') {
      conditions.push(lte(appointments.start_datetime, new Date()));
    }
    
    // Status filter
    if (filters.status && filters.status.length > 0) {
      const statusConditions = filters.status.map(status => 
        eq(appointments.status, status)
      );
      conditions.push(or(...statusConditions));
    }
    
    // Search filter
    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      conditions.push(
        or(
          like(leads.full_name, searchTerm),
          like(leads.phone_number, searchTerm),
          like(leads.email, searchTerm),
          like(appointments.notes, searchTerm)
        )
      );
    }

    // Build complete query in one chain
    let finalQuery = db
      .select({
        appointment: appointments,
        lead: leads,
        agent: users
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .leftJoin(users, eq(appointments.agent_id, users.id));

    // Apply all conditions
    if (conditions.length > 0) {
      finalQuery = finalQuery.where(and(...conditions));
    }

    // Apply sorting
    if (filters.sortBy === 'start_datetime') {
      finalQuery = finalQuery.orderBy(appointments.start_datetime);
    } else {
      finalQuery = finalQuery.orderBy(desc(appointments.start_datetime));
    }
    
    const results = await finalQuery;
    
    // Transform results into the expected format
    return results.map(item => ({
      ...item.appointment,
      lead: item.lead,
      agent: item.agent
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
}, overrideUserId?: string) {
  // Support API key authentication
  let userId: string;
  
  if (overrideUserId) {
    userId = overrideUserId;
  } else {
    // Fall back to Clerk authentication if no override provided
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Not authenticated");
    userId = clerkUserId;
  }
  
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
}, overrideUserId?: string) {
  // Support API key authentication
  let userId: string;
  
  if (overrideUserId) {
    userId = overrideUserId;
  } else {
    // Fall back to Clerk authentication if no override provided
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Not authenticated");
    userId = clerkUserId;
  }
  
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

/**
 * Get appointments for a specific lead
 */
export async function getAppointmentsForLead(leadId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    const results = await db
      .select({
        // Appointment fields - only what we need
        id: appointments.id,
        lead_id: appointments.lead_id,
        agent_id: appointments.agent_id,
        status: appointments.status,
        loan_status: appointments.loan_status,
        loan_notes: appointments.loan_notes,
        notes: appointments.notes,
        start_datetime: appointments.start_datetime,
        end_datetime: appointments.end_datetime,
        created_at: appointments.created_at,
        updated_at: appointments.updated_at,
        created_by: appointments.created_by,
        updated_by: appointments.updated_by,
        
        // Agent information (assigned user) 
        agent_first_name: sql<string | null>`agent_user.first_name`,
        agent_last_name: sql<string | null>`agent_user.last_name`,
        agent_email: sql<string | null>`agent_user.email`,
        
        // Creator information
        creator_first_name: sql<string | null>`creator_user.first_name`,
        creator_last_name: sql<string | null>`creator_user.last_name`, 
        creator_email: sql<string | null>`creator_user.email`,
        
        // Lead basic info (for context)
        lead_name: leads.full_name,
        lead_status: leads.status,
        lead_loan_status: leads.loan_status,
        
        // Lead assigned user info
        assigned_user_first_name: sql<string | null>`assigned_user.first_name`,
        assigned_user_last_name: sql<string | null>`assigned_user.last_name`,
        assigned_user_email: sql<string | null>`assigned_user.email`
      })
      .from(appointments)
      .innerJoin(leads, eq(appointments.lead_id, leads.id))
      .leftJoin(sql`${users} as agent_user`, sql`${appointments.agent_id} = agent_user.id`)
      .leftJoin(sql`${users} as creator_user`, sql`${appointments.created_by} = creator_user.id`)
      .leftJoin(sql`${users} as assigned_user`, sql`${leads.assigned_to} = assigned_user.id`)
      .where(eq(appointments.lead_id, leadId))
      .orderBy(desc(appointments.created_at));
    
    console.log('Appointments query results:', results);
    
    return { 
      success: true, 
      appointments: results.map(row => ({
        id: row.id,
        lead_id: row.lead_id,
        agent_id: row.agent_id,
        status: row.status,
        loan_status: row.loan_status,
        loan_notes: row.loan_notes,
        notes: row.notes,
        start_datetime: row.start_datetime,
        end_datetime: row.end_datetime,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
        updated_by: row.updated_by,
        
        // Computed agent info (who created the appointment)
        agent_name: row.agent_first_name && row.agent_last_name 
          ? `${row.agent_first_name} ${row.agent_last_name}` 
          : (row.agent_first_name ?? row.agent_last_name) ?? 'Unknown',
        agent_email: row.agent_email,
        
        // Computed creator info (who created the appointment)
        creator_name: row.creator_first_name && row.creator_last_name 
          ? `${row.creator_first_name} ${row.creator_last_name}` 
          : (row.creator_first_name ?? row.creator_last_name) ?? 'Unknown',
        creator_email: row.creator_email,
        
        // Lead context
        lead_name: row.lead_name,
        lead_status: row.lead_status,
        lead_loan_status: row.lead_loan_status,
        
        // Lead assigned user info (who the lead is assigned to)
        assigned_user_name: row.assigned_user_first_name && row.assigned_user_last_name 
          ? `${row.assigned_user_first_name} ${row.assigned_user_last_name}` 
          : (row.assigned_user_first_name ?? row.assigned_user_last_name) ?? 'Unassigned',
        assigned_user_email: row.assigned_user_email
      }))
    };
  } catch (error) {
    console.error("Error fetching appointments for lead:", error);
    return { success: false, message: "Failed to fetch appointments", appointments: [] };
  }
}

/**
 * Find nearest available timeslot for a given date
 */
export async function findNearestAvailableTimeslot(targetDate: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    // Get current time in Singapore timezone (UTC+8)
    const now = new Date();
    const singaporeTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const currentTimeString = singaporeTime.toTimeString().split(' ')[0]; // HH:mm:ss format
    
    console.log(`🕐 Finding nearest timeslot for ${targetDate} at current time: ${currentTimeString}`);
    
    // Try to find timeslots for the target date first
    const availableSlots = await db
      .select()
      .from(timeslots)
      .where(
        and(
          eq(timeslots.date, targetDate),
          eq(timeslots.is_disabled, false)
        )
      )
      .orderBy(asc(timeslots.start_time));

    // Filter slots with available capacity (allow overbooking by commenting out)
    // availableSlots = availableSlots.filter(slot => 
    //   (slot.occupied_count ?? 0) < (slot.max_capacity ?? 1)
    // );

    if (availableSlots.length > 0) {
      // Check if target date is today
      const todayStr = singaporeTime.toISOString().split('T')[0];
      
      if (targetDate === todayStr) {
        // For today, find the nearest timeslot to current time
        const futureSlots = availableSlots.filter(slot => {
          return slot.start_time >= currentTimeString;
        });
        
        if (futureSlots.length > 0) {
          // Return the earliest future slot
          console.log(`✅ Found ${futureSlots.length} future slots, returning earliest: ${futureSlots[0]?.start_time}`);
          return { success: true, timeslot: futureSlots[0] };
        } else {
          // No future slots today, find the closest past slot (for testing/debugging)
          const pastSlots = availableSlots.filter(slot => slot.start_time < currentTimeString);
          if (pastSlots.length > 0) {
            // Return the latest past slot (closest to current time)
            const closestPastSlot = pastSlots[pastSlots.length - 1];
            console.log(`⚠️ No future slots today, returning closest past slot: ${closestPastSlot?.start_time}`);
            return { success: true, timeslot: closestPastSlot };
          }
        }
      } else {
        // For future dates, return the earliest slot
        console.log(`📅 Future date (${targetDate}), returning earliest slot: ${availableSlots[0]?.start_time}`);
        return { success: true, timeslot: availableSlots[0] };
      }
    }

    // If no slots available today, try next few days
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + i);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const futureSlots = await db
        .select()
        .from(timeslots)
        .where(
          and(
            eq(timeslots.date, futureDateStr),
            eq(timeslots.is_disabled, false)
          )
        )
        .orderBy(asc(timeslots.start_time));

      const availableFutureSlots = futureSlots.filter(slot => 
        (slot.occupied_count ?? 0) < (slot.max_capacity ?? 1)
      );

      if (availableFutureSlots.length > 0) {
        return { success: true, timeslot: availableFutureSlots[0] };
      }
    }

    return { success: false, message: "No available timeslots found" };
  } catch (error) {
    console.error("Error finding nearest timeslot:", error);
    return { success: false, message: "Failed to find available timeslot" };
  }
}

/**
 * Move appointment to a different timeslot
 */
export async function moveAppointmentToTimeslot(appointmentId: number, newTimeslotId: number, overrideUserId?: string) {
  // Support API key authentication
  let userId: string;
  
  if (overrideUserId) {
    userId = overrideUserId;
  } else {
    // Fall back to Clerk authentication if no override provided
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Not authenticated");
    userId = clerkUserId;
  }
  
  try {
    return await db.transaction(async (tx) => {
      // Get current appointment details
      const currentAppt = await tx
        .select({
          appointment: appointments,
          timeslot_id: appointment_timeslots.timeslot_id
        })
        .from(appointments)
        .leftJoin(appointment_timeslots, eq(appointments.id, appointment_timeslots.appointment_id))
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (currentAppt.length === 0) {
        throw new Error('Appointment not found');
      }

      const oldTimeslotId = currentAppt[0]?.timeslot_id;

      // Get new timeslot details
      const newTimeslot = await tx
        .select()
        .from(timeslots)
        .where(eq(timeslots.id, newTimeslotId))
        .limit(1);

      if (newTimeslot.length === 0) {
        throw new Error('New timeslot not found');
      }

      const slot = newTimeslot[0];
      if (!slot) {
        throw new Error('Invalid timeslot data');
      }
      
      // Update appointment times
      const slotDate = typeof slot.date === 'string' ? slot.date : format(slot.date, 'yyyy-MM-dd');
      const startTimeString = `${slotDate}T${slot.start_time}`;
      const endTimeString = `${slotDate}T${slot.end_time}`;
      
      const startSGT = new Date(startTimeString);
      const endSGT = new Date(endTimeString);
      const startUTC = new Date(startSGT.getTime() - (8 * 60 * 60 * 1000));
      const endUTC = new Date(endSGT.getTime() - (8 * 60 * 60 * 1000));

      await tx
        .update(appointments)
        .set({
          start_datetime: startUTC,
          end_datetime: endUTC,
          updated_at: new Date(),
          updated_by: userId
        })
        .where(eq(appointments.id, appointmentId));

      // Update timeslot relationships
      if (oldTimeslotId) {
        // Remove old relationship and decrease old timeslot count
        await tx
          .delete(appointment_timeslots)
          .where(
            and(
              eq(appointment_timeslots.appointment_id, appointmentId),
              eq(appointment_timeslots.timeslot_id, oldTimeslotId)
            )
          );

        await tx
          .update(timeslots)
          .set({
            occupied_count: Math.max(0, (slot.occupied_count ?? 0) - 1),
            updated_at: new Date()
          })
          .where(eq(timeslots.id, oldTimeslotId));
      }

      // Create new relationship and increase new timeslot count
      await tx
        .insert(appointment_timeslots)
        .values({
          appointment_id: appointmentId,
          timeslot_id: newTimeslotId,
          primary: true
        });

      await tx
        .update(timeslots)
        .set({
          occupied_count: (slot.occupied_count ?? 0) + 1,
          updated_at: new Date()
        })
        .where(eq(timeslots.id, newTimeslotId));

      return { success: true };
    });
  } catch (error) {
    console.error("Error moving appointment:", error);
    return { success: false, message: "Failed to move appointment" };
  }
}
