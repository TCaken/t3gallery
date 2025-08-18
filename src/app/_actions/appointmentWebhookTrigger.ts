'use server';


import { db } from "~/server/db";
import { appointments, leads } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, sql, and, gte, lte } from "drizzle-orm";

export async function triggerTodayAppointmentWebhooks(apiKey?: string) {
  try {
    let userId: string | null = null;
    
    // Check for API key authentication first
    if (apiKey) {
      const workatoApiKey = process.env.WORKATO_API_KEY;
      if (apiKey === workatoApiKey) {
        userId = 'api_key_authenticated'; // Use a placeholder for API key auth
        console.log('🔑 API key authentication successful');
      } else {
        return { success: false, error: "Invalid API key" };
      }
    } else {
      // Fall back to Clerk authentication
      const { userId: clerkUserId } = await auth();
      if (!clerkUserId) {
        return { success: false, error: "Not authenticated - requires either valid API key or user authentication" };
      }
      userId = clerkUserId;
      console.log('👤 Clerk authentication successful');
    }

    // Get current date in UTC+8 (Singapore time)
    const now = new Date();
    const singaporeTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours to UTC
    const todayDateString = singaporeTime.toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    // Create start and end of day in Singapore time, then convert to UTC for DB query
    const startOfDaySingapore = new Date(`${todayDateString}T00:00:00`);
    const endOfDaySingapore = new Date(`${todayDateString}T23:59:59`);
    
    // Convert Singapore times to UTC for database query (subtract 8 hours)
    const startOfDayUTC = new Date(startOfDaySingapore.getTime() - (8 * 60 * 60 * 1000));
    const endOfDayUTC = new Date(endOfDaySingapore.getTime() - (8 * 60 * 60 * 1000));
    
    console.log('🕐 Current Singapore time:', singaporeTime.toISOString());
    console.log('📅 Looking for appointments on date:', todayDateString);
    console.log('🌅 Start of day (Singapore):', startOfDaySingapore.toISOString());
    console.log('🌅 Start of day (UTC for DB):', startOfDayUTC.toISOString());
    console.log('🌆 End of day (Singapore):', endOfDaySingapore.toISOString());
    console.log('🌆 End of day (UTC for DB):', endOfDayUTC.toISOString());

    // Fetch all appointments for today using UTC time range
    const todayAppointments = await db
      .select({
        id: appointments.id,
        leadId: appointments.lead_id,
        startDatetime: appointments.start_datetime,
        endDatetime: appointments.end_datetime,
        status: appointments.status,
        notes: appointments.notes,
        leadName: leads.full_name,
        leadPhone: leads.phone_number
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .where(
        // Filter appointments that start within today's date range in Singapore time
        and(
          gte(appointments.start_datetime, startOfDayUTC),
          lte(appointments.start_datetime, endOfDayUTC),
          eq(appointments.status, 'upcoming')
        )
      );

    console.log(`📋 Found ${todayAppointments.length} appointments for today`);

    if (todayAppointments.length === 0) {
      return {
        success: true,
        message: `No appointments found for today (${todayDateString})`,
        processedCount: 0,
        appointments: []
      };
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each appointment
    for (const appointment of todayAppointments) {
      try {
        console.log(`🔄 Processing appointment ID: ${appointment.id} for lead: ${appointment.leadName}`);
        
        // Import the webhook functions
        const { sendAppointmentToWebhook } = await import('./appointmentWebhookActions');
        const { sendAppointmentWhatsAppReminder } = await import('./whatsappActions');
        
        // Extract date and time from datetime
        const appointmentDate = appointment.startDatetime.toISOString().split('T')[0]; // YYYY-MM-DD
        const appointmentTime = appointment.startDatetime.toTimeString().split(' ')[0]; // HH:MM:SS

        // Send to Workato webhook
        const webhookResult = await sendAppointmentToWebhook(appointment.leadId, {
          appointmentDate: appointmentDate,
          appointmentTime: appointmentTime,
          appointmentType: "Consultation",
          notes: appointment.notes ?? ""
        });

        // Send WhatsApp reminder to customer (don't stop if this fails)
        let whatsappResult = null;
        try {
          // Only send WhatsApp if we have valid phone number
          if (appointment.leadPhone && appointment.leadPhone.trim() !== '') {
            whatsappResult = await sendAppointmentWhatsAppReminder(
              appointment.leadName ?? 'Customer',
              appointment.leadPhone as string,
              appointmentDate,
              appointmentTime,
              "Consultation"
            );
            
            if (whatsappResult?.success) {
              console.log(`✅ WhatsApp reminder sent for appointment ${appointment.id}`);
            } else {
              console.log(`⚠️ WhatsApp reminder failed for appointment ${appointment.id}: ${whatsappResult?.error ?? 'Unknown error'}`);
            }
          } else {
            console.log(`⚠️ Skipping WhatsApp reminder for appointment ${appointment.id}: No phone number`);
          }
        } catch (whatsappError) {
          console.log(`⚠️ WhatsApp reminder error for appointment ${appointment.id}:`, whatsappError);
          // Don't stop the process, continue with other appointments
        }

        if (webhookResult?.success) {
          successCount++;
          results.push({
            appointmentId: appointment.id,
            leadName: appointment.leadName,
            leadPhone: appointment.leadPhone,
            startTime: appointmentTime,
            status: 'success',
            message: 'Webhook sent successfully'
          });
          console.log(`✅ Webhook sent for appointment ${appointment.id}`);
        } else {
          errorCount++;
          results.push({
            appointmentId: appointment.id,
            leadName: appointment.leadName,
            leadPhone: appointment.leadPhone,
            startTime: appointmentTime,
            status: 'error',
            message: webhookResult?.error ?? 'Unknown error'
          });
          console.log(`❌ Failed to send webhook for appointment ${appointment.id}: ${webhookResult?.error}`);
        }
      } catch (error) {
        errorCount++;
        const appointmentTime = appointment.startDatetime.toTimeString().split(' ')[0]; // HH:MM:SS
        results.push({
          appointmentId: appointment.id,
          leadName: appointment.leadName,
          leadPhone: appointment.leadPhone,
          startTime: appointmentTime,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`❌ Error processing appointment ${appointment.id}:`, error);
      }
    }

    return {
      success: true,
      message: `Processed ${todayAppointments.length} appointments: ${successCount} successful, ${errorCount} failed`,
      processedCount: todayAppointments.length,
      successCount,
      errorCount,
      currentDate: todayDateString,
      singaporeTime: singaporeTime.toISOString(),
      appointments: results,
      authenticatedBy: userId === 'api_key_authenticated' ? 'API Key' : 'User Session'
    };

  } catch (error) {
    console.error('❌ Error in triggerTodayAppointmentWebhooks:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 