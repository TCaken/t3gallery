"use server";

import { db } from "~/server/db";
import { 
  borrower_appointments, 
  borrowers,
  borrower_appointment_timeslots,
  timeslots,
  users,
  logs,
  borrower_actions
} from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Types for borrower appointment operations
export type CreateBorrowerAppointmentInput = {
  borrower_id: number;
  agent_id: string;
  appointment_type?: string;
  notes?: string;
  lead_source?: string;
  start_datetime: Date;
  end_datetime: Date;
  timeslot_ids?: number[];
};

export type UpdateBorrowerAppointmentInput = Partial<Omit<CreateBorrowerAppointmentInput, 'borrower_id'>> & {
  id: number;
  status?: string;
  loan_status?: string;
  loan_notes?: string;
};

export type BorrowerAppointmentFilters = {
  borrower_id?: number;
  agent_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

// Log borrower appointment action helper
async function logBorrowerAppointmentAction(
  appointmentId: number,
  borrowerId: number,
  action: string,
  description: string,
  userId: string,
  actionType = "appointment"
) {
  try {
    // Log to borrower_actions table
    await db.insert(borrower_actions).values({
      borrower_id: borrowerId,
      user_id: userId,
      action_type: actionType,
      content: description,
      timestamp: new Date(),
      created_by: userId,
    });

    // Log to main logs table
    await db.insert(logs).values({
      description,
      entity_type: "borrower_appointment",
      entity_id: appointmentId.toString(),
      action,
      performed_by: userId,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error logging borrower appointment action:", error);
  }
}

// Create borrower appointment
export async function createBorrowerAppointment(input: CreateBorrowerAppointmentInput) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Validate that borrower exists
    const borrower = await db
      .select()
      .from(borrowers)
      .where(eq(borrowers.id, input.borrower_id))
      .limit(1);

    if (borrower.length === 0) {
      throw new Error("Borrower not found");
    }

    // Check for existing upcoming appointments
    const existingUpcomingAppointments = await db
      .select()
      .from(borrower_appointments)
      .where(
        and(
          eq(borrower_appointments.borrower_id, input.borrower_id),
          sql`${borrower_appointments.status} IN ('upcoming', 'scheduled')`
        )
      );

    if (existingUpcomingAppointments.length > 0) {
      throw new Error("This borrower already has an upcoming appointment. Please cancel the existing appointment first.");
    }

    // Validate that agent exists
    const agent = await db
      .select()
      .from(users)
      .where(eq(users.id, input.agent_id))
      .limit(1);

    if (agent.length === 0) {
      throw new Error("Agent not found");
    }

    // Create the appointment
    const result = await db
      .insert(borrower_appointments)
      .values({
        borrower_id: input.borrower_id,
        agent_id: input.agent_id,
        status: "upcoming",
        appointment_type: input.appointment_type ?? "reloan_consultation",
        notes: input.notes,
        lead_source: input.lead_source ?? "", // Set the correct source for borrower appointments
        start_datetime: input.start_datetime,
        end_datetime: input.end_datetime,
        created_by: userId,
        created_at: new Date(),
      })
      .returning();

    const newAppointment = result[0];
    if (!newAppointment) {
      throw new Error("Failed to create appointment");
    }

    // Update borrower status to "booked" when appointment is created
    await db
      .update(borrowers)
      .set({
        status: "booked",
        updated_by: userId,
        updated_at: new Date()
      })
      .where(eq(borrowers.id, input.borrower_id));

    // Link appointment to timeslots if provided
    if (input.timeslot_ids && input.timeslot_ids.length > 0) {
      const timeslotLinks = input.timeslot_ids.map((timeslot_id) => ({
        borrower_appointment_id: newAppointment.id,
        timeslot_id,
        primary: true
      }));

      await db.insert(borrower_appointment_timeslots).values(timeslotLinks);

      // Update timeslot occupied count
      for (const timeslot_id of input.timeslot_ids) {
        await db
          .update(timeslots)
          .set({
            occupied_count: sql`${timeslots.occupied_count} + 1`,
            updated_at: new Date()
          })
          .where(eq(timeslots.id, timeslot_id));
      }
    }

    // Log the action
    await logBorrowerAppointmentAction(
      newAppointment.id,
      input.borrower_id,
      "create",
      `Created appointment for ${borrower[0]?.full_name ?? 'Unknown Borrower'} with ${agent[0]?.first_name ?? ''} ${agent[0]?.last_name ?? ''}`.trim(),
      userId,
      "appointment"
    );

    // Send appointment data to webhook ONLY if appointment is for today (Singapore time)
    try {
      // Get today's date in Singapore timezone (UTC+8)
      const now = new Date();
      const singaporeOffset = 8 * 60; // 8 hours in minutes
      const singaporeTime = new Date(now.getTime() + (singaporeOffset * 60 * 1000));
      const todaySingapore = singaporeTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Get appointment date
      const appointmentDate = input.start_datetime.toISOString().split('T')[0];
      
      console.log('🕐 Borrower appointment webhook date check:');
      console.log('Today (Singapore):', todaySingapore);
      console.log('Appointment date:', appointmentDate);
      
      // Only send webhook if appointment is for today
      if (appointmentDate === todaySingapore) {
        console.log('✅ Borrower appointment is for today, sending webhook...');
        
        const timeComponents = input.start_datetime.toTimeString().split(' ');
        const appointmentTime = timeComponents[0] ?? "00:00:00"; // HH:MM:SS
        
        const webhookResult = await sendBorrowerAppointmentToWebhook(input.borrower_id, {
          appointmentDate: appointmentDate,
          appointmentTime: appointmentTime,
          appointmentType: input.appointment_type ?? "reloan_consultation",
          notes: input.notes ?? ""
        });
        
        if (webhookResult.success) {
          console.log('✅ Borrower appointment data sent to webhook successfully');
        } else {
          console.error('❌ Failed to send borrower appointment data to webhook:', webhookResult.error);
          // Don't fail the appointment creation if webhook fails
        }
      } else {
        console.log('ℹ️ Borrower appointment is NOT for today, skipping webhook');
      }
    } catch (webhookError) {
      console.error('❌ Error calling borrower appointment webhook:', webhookError);
      // Don't fail the appointment creation if webhook fails
    }

    revalidatePath("/dashboard/borrowers");
    revalidatePath(`/dashboard/borrowers/${input.borrower_id}`);
    revalidatePath("/dashboard/appointments");

    return { success: true, data: newAppointment };

  } catch (error) {
    console.error("Error creating borrower appointment:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to create borrower appointment");
  }
}

// Get borrower appointments with filters
export async function getBorrowerAppointments(filters: BorrowerAppointmentFilters = {}) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const {
      borrower_id,
      agent_id,
      status,
      limit = 50,
      offset = 0
    } = filters;

    // Build query conditions
    const conditions = [];
    if (borrower_id) {
      conditions.push(eq(borrower_appointments.borrower_id, borrower_id));
    }
    if (agent_id) {
      conditions.push(eq(borrower_appointments.agent_id, agent_id));
    }
    if (status) {
      conditions.push(eq(borrower_appointments.status, status));
    }

    // Get appointments with borrower and agent details
    const appointments = await db
      .select({
        id: borrower_appointments.id,
        borrower_id: borrower_appointments.borrower_id,
        agent_id: borrower_appointments.agent_id,
        status: borrower_appointments.status,
        appointment_type: borrower_appointments.appointment_type,
        loan_status: borrower_appointments.loan_status,
        loan_notes: borrower_appointments.loan_notes,
        notes: borrower_appointments.notes,
        lead_source: borrower_appointments.lead_source,
        start_datetime: borrower_appointments.start_datetime,
        end_datetime: borrower_appointments.end_datetime,
        created_at: borrower_appointments.created_at,
        updated_at: borrower_appointments.updated_at,
        created_by: borrower_appointments.created_by,
        borrower_name: borrowers.full_name,
        borrower_phone: borrowers.phone_number,
        agent_first_name: users.first_name,
        agent_last_name: users.last_name,
        agent_email: users.email,
      })
      .from(borrower_appointments)
      .leftJoin(borrowers, eq(borrower_appointments.borrower_id, borrowers.id))
      .leftJoin(users, eq(borrower_appointments.agent_id, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(borrower_appointments.start_datetime))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(borrower_appointments)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalCount = totalCountResult[0]?.count ?? 0;

    return {
      success: true,
      data: appointments,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    };

  } catch (error) {
    console.error("Error fetching borrower appointments:", error);
    throw new Error("Failed to fetch borrower appointments");
  }
}

// Get single borrower appointment
export async function getBorrowerAppointment(id: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Get appointment with borrower and agent details
    const appointments = await db
      .select({
        id: borrower_appointments.id,
        borrower_id: borrower_appointments.borrower_id,
        agent_id: borrower_appointments.agent_id,
        status: borrower_appointments.status,
        appointment_type: borrower_appointments.appointment_type,
        loan_status: borrower_appointments.loan_status,
        loan_notes: borrower_appointments.loan_notes,
        notes: borrower_appointments.notes,
        lead_source: borrower_appointments.lead_source,
        start_datetime: borrower_appointments.start_datetime,
        end_datetime: borrower_appointments.end_datetime,
        created_at: borrower_appointments.created_at,
        updated_at: borrower_appointments.updated_at,
        borrower_name: borrowers.full_name,
        borrower_phone: borrowers.phone_number,
        borrower_email: borrowers.email,
        agent_first_name: users.first_name,
        agent_last_name: users.last_name,
        agent_email: users.email,
      })
      .from(borrower_appointments)
      .leftJoin(borrowers, eq(borrower_appointments.borrower_id, borrowers.id))
      .leftJoin(users, eq(borrower_appointments.agent_id, users.id))
      .where(eq(borrower_appointments.id, id))
      .limit(1);

    if (appointments.length === 0) {
      throw new Error("Appointment not found");
    }

    return { success: true, data: appointments[0] };

  } catch (error) {
    console.error("Error fetching borrower appointment:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch borrower appointment");
  }
}

// Update borrower appointment
export async function updateBorrowerAppointment(input: UpdateBorrowerAppointmentInput) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const { id, timeslot_ids, ...updateData } = input;

    // Check if appointment exists
    const existingAppointment = await db
      .select()
      .from(borrower_appointments)
      .where(eq(borrower_appointments.id, id))
      .limit(1);

    if (existingAppointment.length === 0) {
      throw new Error("Appointment not found");
    }

    const oldAppointment = existingAppointment[0];
    if (!oldAppointment) {
      throw new Error("Appointment not found");
    }

    // Build update object with only provided fields
    const fieldsToUpdate: Partial<typeof borrower_appointments.$inferInsert> = {
      updated_by: userId,
      updated_at: new Date()
    };

    // Add provided fields to update
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] !== undefined) {
        (fieldsToUpdate as any)[key] = updateData[key as keyof typeof updateData];
      }
    });

    // Handle date fields
    if (updateData.start_datetime) fieldsToUpdate.start_datetime = updateData.start_datetime;
    if (updateData.end_datetime) fieldsToUpdate.end_datetime = updateData.end_datetime;

    // Update the appointment
    const result = await db
      .update(borrower_appointments)
      .set(fieldsToUpdate)
      .where(eq(borrower_appointments.id, id))
      .returning();

    const updatedAppointment = result[0];
    if (!updatedAppointment) {
      throw new Error("Failed to update appointment");
    }

    // Handle timeslot updates if provided
    if (timeslot_ids && Array.isArray(timeslot_ids)) {
      // Remove existing timeslot associations
      const oldTimeslots = await db
        .select({ timeslot_id: borrower_appointment_timeslots.timeslot_id })
        .from(borrower_appointment_timeslots)
        .where(eq(borrower_appointment_timeslots.borrower_appointment_id, id));

      // Delete old associations
      await db
        .delete(borrower_appointment_timeslots)
        .where(eq(borrower_appointment_timeslots.borrower_appointment_id, id));

      // Decrement occupied count for old timeslots
      for (const oldSlot of oldTimeslots) {
        await db
          .update(timeslots)
          .set({
            occupied_count: sql`GREATEST(${timeslots.occupied_count} - 1, 0)`,
            updated_at: new Date()
          })
          .where(eq(timeslots.id, oldSlot.timeslot_id));
      }

      // Add new timeslot associations if any
      if (timeslot_ids.length > 0) {
        const timeslotLinks = timeslot_ids.map((timeslot_id: number) => ({
          borrower_appointment_id: id,
          timeslot_id,
          primary: true
        }));

        await db.insert(borrower_appointment_timeslots).values(timeslotLinks);

        // Increment occupied count for new timeslots
        for (const timeslot_id of timeslot_ids) {
          await db
            .update(timeslots)
            .set({
              occupied_count: sql`${timeslots.occupied_count} + 1`,
              updated_at: new Date()
            })
            .where(eq(timeslots.id, timeslot_id));
        }
      }
    }

    // Track what changed for logging
    const changes: string[] = [];
    Object.keys(updateData).forEach(key => {
      const oldValue = (oldAppointment as any)[key];
      const newValue = updateData[key as keyof typeof updateData];
      if (oldValue !== newValue) {
        changes.push(`${key}: ${oldValue} → ${newValue}`);
      }
    });

    // Log the update
    await logBorrowerAppointmentAction(
      id,
      oldAppointment.borrower_id,
      "update",
      `Updated appointment. Changes: ${changes.join(", ")}`,
      userId,
      "appointment"
    );

    revalidatePath("/dashboard/borrowers");
    revalidatePath(`/dashboard/borrowers/${oldAppointment.borrower_id}`);
    revalidatePath("/dashboard/appointments");

    return { success: true, data: updatedAppointment };

  } catch (error) {
    console.error("Error updating borrower appointment:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update borrower appointment");
  }
}

// Delete borrower appointment
export async function deleteBorrowerAppointment(id: number) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Check if appointment exists
    const existingAppointment = await db
      .select()
      .from(borrower_appointments)
      .where(eq(borrower_appointments.id, id))
      .limit(1);

    if (existingAppointment.length === 0) {
      throw new Error("Appointment not found");
    }

    const appointment = existingAppointment[0];
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Get associated timeslots before deletion
    const timeslots_to_free = await db
      .select({ timeslot_id: borrower_appointment_timeslots.timeslot_id })
      .from(borrower_appointment_timeslots)
      .where(eq(borrower_appointment_timeslots.borrower_appointment_id, id));

    // Delete the appointment (this will cascade to timeslot associations)
    await db
      .delete(borrower_appointments)
      .where(eq(borrower_appointments.id, id));

    // Decrement occupied count for freed timeslots
    for (const slot of timeslots_to_free) {
      await db
        .update(timeslots)
        .set({
          occupied_count: sql`GREATEST(${timeslots.occupied_count} - 1, 0)`,
          updated_at: new Date()
        })
        .where(eq(timeslots.id, slot.timeslot_id));
    }

    // Log the deletion
    await logBorrowerAppointmentAction(
      id,
      appointment.borrower_id,
      "delete",
      `Deleted appointment for appointment ID: ${id}`,
      userId,
      "appointment"
    );

    revalidatePath("/dashboard/borrowers");
    revalidatePath(`/dashboard/borrowers/${appointment.borrower_id}`);
    revalidatePath("/dashboard/appointments");

    return { success: true, message: "Borrower appointment deleted successfully" };

  } catch (error) {
    console.error("Error deleting borrower appointment:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to delete borrower appointment");
  }
}

// Update appointment status (quick action)
export async function updateBorrowerAppointmentStatus(id: number, status: string, notes?: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const existingAppointment = await db
      .select()
      .from(borrower_appointments)
      .where(eq(borrower_appointments.id, id))
      .limit(1);

    if (existingAppointment.length === 0) {
      throw new Error("Appointment not found");
    }

    const appointment = existingAppointment[0];
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const updateData: Partial<typeof borrower_appointments.$inferInsert> = {
      status,
      updated_by: userId,
      updated_at: new Date()
    };

    if (notes) {
      updateData.notes = notes;
    }

    const result = await db
      .update(borrower_appointments)
      .set(updateData)
      .where(eq(borrower_appointments.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error("Failed to update appointment status");
    }

    // Update borrower status based on appointment status change
    let borrowerStatus = appointment.status; // Keep existing status by default
    
    if (status === 'done') {
      borrowerStatus = 'done'; // Mark borrower as done when appointment is completed
    } else if (status === 'missed' || status === 'cancelled') {
      borrowerStatus = 'follow_up'; // Set to follow-up for missed/cancelled appointments
    }
    
    // Update borrower status if it should change
    if (borrowerStatus !== appointment.status) {
      await db
        .update(borrowers)
        .set({
          status: borrowerStatus,
          updated_by: userId,
          updated_at: new Date()
        })
        .where(eq(borrowers.id, appointment.borrower_id));
    }

    // Log the status change
    await logBorrowerAppointmentAction(
      id,
      appointment.borrower_id,
      "status_update",
      `Updated appointment status to: ${status}${notes ? `. Notes: ${notes}` : ""}`,
      userId,
      "appointment"
    );

    revalidatePath("/dashboard/borrowers");
    revalidatePath(`/dashboard/borrowers/${appointment.borrower_id}`);
    revalidatePath("/dashboard/appointments");

    return { success: true, data: result[0] };

  } catch (error) {
    console.error("Error updating appointment status:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update appointment status");
  }
}

// Send borrower appointment data to webhook (similar to lead appointments)
async function sendBorrowerAppointmentToWebhook(borrowerId: number, appointmentData: {
  appointmentDate: string;
  appointmentTime: string;
  appointmentType?: string;
  notes?: string;
}) {
  try {
    console.log('Sending borrower appointment to webhook for borrower:', borrowerId);
    
    // Fetch borrower data from database
    const borrower = await db
      .select()
      .from(borrowers)
      .where(eq(borrowers.id, borrowerId))
      .limit(1);

    if (borrower.length === 0) {
      return {
        success: false,
        error: "Borrower not found"
      };
    }

    const borrowerData = borrower[0];
    if (!borrowerData) {
      return {
        success: false,
        error: "Borrower data not found"
      };
    }

    // Helper function to format date as DD-MM-YYYY
    const formatAppointmentDate = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      } catch {
        return dateStr;
      }
    };

    // Helper function to mask phone number
    const maskPhoneNumber = (phone: string) => {
      if (!phone) return "";
      // Remove any non-digits and get last 4 digits
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length >= 5) {
        const lastFive = cleaned.slice(-5);
        return `***${lastFive}`;
      }
      return phone;
    };

    // Format the borrower name
    const formattedName = borrowerData.full_name ? `${borrowerData.full_name.toUpperCase()}` : "";
    const cleanPhoneNumber = borrowerData.phone_number?.replace(/^\+65/, '') ?? "";
    const maskedPhone = maskPhoneNumber(borrowerData.phone_number ?? "");

    // Map borrower data to webhook format (similar to lead webhook but for Re Loan)
    const webhookData = {
      "Lead ID": `B${borrowerId}`, // Prefix with B for borrower
      "Full Name": formattedName,
      "Mobile Number": cleanPhoneNumber,
      "H/P": maskedPhone,
      "Email Address": borrowerData.email ?? "",
      "Loan Amount Applying?": "", // Will be filled during appointment
      "Monthly Income": borrowerData.average_monthly_income ?? "",
      "Your Employment Specialisation": borrowerData.current_employer ?? "",
      "Employment Type": borrowerData.current_employer ?? "",
      "What is the purpose of the Loan?": "Re Loan - 再贷款", // Keep as New Loan as requested
      "Place of Residence": borrowerData.residential_status ?? "",
      
      // Appointment specific data  
      "Appointment Date": formatAppointmentDate(appointmentData.appointmentDate),
      "Appointment Time": appointmentData.appointmentTime,
      "Appointment Type": appointmentData.appointmentType ?? "Reloan Consultation",
      "Created At": formatAppointmentDate(new Date().toISOString()),
      
      // Default values for required fields
      "Manual": "Yes",
      "Reason for manual": "Borrower appointment booking from CRM",
      "Loan Portal Applied": "CRM",
      "New or Reloan?": "Re Loan - 再贷款", // Keep as New Loan as requested
      "Are you a Declared Bankruptcy at the time of this loan application?": "No",
      "**Declaration - 声明 **": "Agreed",
      
      // Fields that might need manual input later
      UW: "",
      RM: "",
      Group: "",
      Code: "",
      "Please choose your nationality or Work Pass": borrowerData.residential_status ?? "",
      "Last 4 digits of the NRIC (including the alphabet)": "",
      "Marital Status": "",
      "Which year is your bankruptcy discharge?": "",
      "What is your work designation?": "",
      "For how long have you been working in this company?": "",
      "Number of Room HDB Flat": "",
      "How many Moneylender Company do you currently have outstanding loan?": "0",
    };

    // Send to Workato webhook (same endpoint as lead appointments)
    const webhookUrl = process.env.WORKATO_CREATE_APPOINTMENT_WEBHOOK_URL ?? '';
    if(!webhookUrl) {
      console.error('❌ WORKATO_CREATE_APPOINTMENT_WEBHOOK_URL is not set');
      return {
        success: false,
        error: "Webhook URL not configured"
      };
    }

    console.log('Sending borrower data to webhook:', webhookData);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Borrower appointment webhook response:', result);

    return {
      success: true,
      message: "Borrower appointment data sent to webhook successfully",
      webhookResponse: result
    };

  } catch (error) {
    console.error('Error sending borrower appointment to webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send borrower appointment to webhook"
    };
  }
} 