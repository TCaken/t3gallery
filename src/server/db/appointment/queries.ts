import "server-only";

import { db } from "~/server/db";
import { appointments, timeslots, leads, appointment_timeslots } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, gte, lte, desc, like, or } from "drizzle-orm";
import { format, startOfDay, endOfDay} from 'date-fns';

// Type for returned appointments with lead information
export type AppointmentWithLead = typeof appointments.$inferSelect & {
  lead: typeof leads.$inferSelect;
};

/**
 * Check if a lead has an active appointment
 */
export async function checkExistingAppointment(leadId: number) {
  const user = await auth();
  if (!user.userId) throw new Error("Not authenticated");
  
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
  const user = await auth();
  if (!user.userId) throw new Error("Not authenticated");
  
  try {
    // Convert string date to Date object for database query
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Get all timeslots for the selected date
    const availableSlots = await db
      .select()
      .from(timeslots)
      .where(eq(timeslots.date, selectedDate));
    
    return availableSlots;
  } catch (error) {
    console.error("Error fetching timeslots:", error);
    return [];
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
  agentId?: string;
}) {
  const user = await auth();
  if (!user.userId) throw new Error("Not authenticated");
  
  try {
    let query = db
      .select({
        appointment: appointments,
        lead: leads
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .orderBy(desc(appointments.start_datetime));
    
    // Apply date filter
    if (filters.date && filters.view === 'day') {
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
    
    // Filter by agent/user
    if (filters.agentId) {
      query = query.where(eq(appointments.agent_id, filters.agentId));
    }
    
    // Apply search filter
    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      query = query.where(
        or(
          like(leads.first_name, searchTerm),
          like(leads.last_name, searchTerm),
          like(leads.phone_number, searchTerm),
          like(leads.email, searchTerm),
          like(appointments.notes, searchTerm)
        )
      );    
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
 * Fetch a single appointment by ID
 */
export async function getAppointmentById(appointmentId: number) {
  const user = await auth();
  if (!user.userId) throw new Error("Not authenticated");
  
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
 * Create a new appointment
 */
export async function createAppointment(data: {
  leadId: number;
  timeslotId: number;
  notes: string;
  isUrgent: boolean;
}) {
  const user = await auth();
  if (!user.userId) throw new Error("Not authenticated");
  
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
    if (selectedSlot.occupied_count >= selectedSlot.max_capacity) {
      return { success: false, message: "This timeslot is already fully booked" };
    }
    
    // Create the appointment
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        lead_id: data.leadId,
        agent_id: user.userId,
        status: 'upcoming',
        notes: data.notes,
        is_urgent: data.isUrgent,
        start_datetime: new Date(`${format(selectedSlot.date, 'yyyy-MM-dd')}T${selectedSlot.start_time}`),
        end_datetime: new Date(`${format(selectedSlot.date, 'yyyy-MM-dd')}T${selectedSlot.end_time}`),
        created_at: new Date(),
        created_by: user.userId
      })
      .returning();
    
    // Create appointment_timeslot relationship
    await db
      .insert(appointment_timeslots)
      .values({
        appointment_id: newAppointment.id,
        timeslot_id: data.timeslotId,
        primary: true
      });
    
    // Update the timeslot occupied count
    await db
      .update(timeslots)
      .set({
        occupied_count: (selectedSlot.occupied_count ?? 0) + 1,
        updated_at: new Date(),
        updated_by: user.userId
      })
      .where(eq(timeslots.id, data.timeslotId));
    
    return { success: true, appointment: newAppointment };
  } catch (error) {
    console.error("Error creating appointment:", error);
    return { success: false, message: "Failed to create appointment" };
  }
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(appointmentId: number, newStatus: string) {
  const user = await auth();
  if (!user.userId) throw new Error("Not authenticated");
  
  try {
    // Get the appointment to be updated
    const [appointmentToUpdate] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    
    if (!appointmentToUpdate) {
      return { success: false, message: "Appointment not found" };
    }
    
    // Update appointment status
    await db
      .update(appointments)
      .set({
        status: newStatus,
        updated_at: new Date(),
        updated_by: user.userId
      })
      .where(eq(appointments.id, appointmentId));
    
    return { success: true };
  } catch (error) {
    console.error("Error updating appointment status:", error);
    return { success: false, message: "Failed to update appointment status" };
  }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(appointmentId: number) {
  const user = await auth();
  if (!user.userId) throw new Error("Not authenticated");
  
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
    
    // Update appointment status
    await db
      .update(appointments)
      .set({
        status: 'cancelled',
        updated_at: new Date(),
        updated_by: user.userId
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
            updated_by: user.userId
          })
          .where(eq(timeslots.id, timeslotId));
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    return { success: false, message: "Failed to cancel appointment" };
  }
}

/**
 * Reschedule an appointment to a new timeslot
 */
export async function rescheduleAppointment(appointmentId: number, newTimeslotId: number) {
  const user = await auth();
  if (!user.userId) throw new Error("Not authenticated");
  
  try {
    // Get the appointment to be rescheduled along with its associated timeslot
    const appointmentToReschedule = await db
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
    
    if (appointmentToReschedule.length === 0) {
      return { success: false, message: "Appointment not found" };
    }
    
    // Get the new timeslot
    const [newTimeslot] = await db
      .select()
      .from(timeslots)
      .where(eq(timeslots.id, newTimeslotId));
    
    if (!newTimeslot) {
      return { success: false, message: "New timeslot not found" };
    }
    
    // Check if the new timeslot is already at capacity
    if (newTimeslot.occupied_count >= newTimeslot.max_capacity) {
      return { success: false, message: "The new timeslot is already fully booked" };
    }
    
    // Update appointment times
    await db
      .update(appointments)
      .set({
        start_datetime: new Date(`${format(newTimeslot.date, 'yyyy-MM-dd')}T${newTimeslot.start_time}`),
        end_datetime: new Date(`${format(newTimeslot.date, 'yyyy-MM-dd')}T${newTimeslot.end_time}`),
        updated_at: new Date(),
        updated_by: user.userId
      })
      .where(eq(appointments.id, appointmentId));
    
    // Update the appointment_timeslots relationship
    const oldTimeslotId = appointmentToReschedule[0].timeslot_id;
    
    if (oldTimeslotId) {
      // Delete old relationship
      await db
        .delete(appointment_timeslots)
        .where(
          and(
            eq(appointment_timeslots.appointment_id, appointmentId),
            eq(appointment_timeslots.timeslot_id, oldTimeslotId)
          )
        );
      
      // Decrease the occupied count for the old timeslot
      const [oldTimeslot] = await db
        .select()
        .from(timeslots)
        .where(eq(timeslots.id, oldTimeslotId));
      
      if (oldTimeslot && oldTimeslot.occupied_count > 0) {
        await db
          .update(timeslots)
          .set({
            occupied_count: oldTimeslot.occupied_count - 1,
            updated_at: new Date(),
            updated_by: user.userId
          })
          .where(eq(timeslots.id, oldTimeslotId));
      }
    }
    
    // Create new relationship
    await db
      .insert(appointment_timeslots)
      .values({
        appointment_id: appointmentId,
        timeslot_id: newTimeslotId,
        primary: true
      });
    
    // Increase the occupied count for the new timeslot
    await db
      .update(timeslots)
      .set({
        occupied_count: (newTimeslot.occupied_count ?? 0) + 1,
        updated_at: new Date(),
        updated_by: user.userId
      })
      .where(eq(timeslots.id, newTimeslotId));
    
    return { success: true };
  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    return { success: false, message: "Failed to reschedule appointment" };
  }
}
