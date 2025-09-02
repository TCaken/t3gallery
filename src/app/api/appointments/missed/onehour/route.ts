'use server';

import { NextRequest, NextResponse } from 'next/server';
import { sendMissedAppointmentAfterOneHourReminder } from '~/app/_actions/whatsappActions';
import { db } from '~/server/db';
import { appointments, leads } from '~/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key') ?? request.headers.get('apikey');
    
    // Check if API key is provided
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key is required',
        message: 'Please provide x-api-key or apikey in headers'
      }, { status: 401 });
    }
    
    // Validate API key
    const validApiKey = process.env.WORKATO_API_KEY;
    if (apiKey !== validApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      }, { status: 403 });
    }
    
    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }
    
    // Extract parameters
    const { currentTime } = requestBody;
    
    console.log('🔔 One hour missed appointment reminder API called with:', { 
      currentTime,
      currentTimeType: typeof currentTime,
      requestBody,
      apiKey: apiKey ? "***" + String(apiKey).slice(-4) : undefined 
    });
    
    // Use provided time or default to current time
    let targetTime: Date;
    if (currentTime && typeof currentTime === 'string' && currentTime.trim() !== '') {
      console.log('📅 Using provided currentTime:', currentTime);
      targetTime = new Date(currentTime);
      
      // Validate the date
      if (isNaN(targetTime.getTime())) {
        console.warn('⚠️ Invalid date provided, falling back to current time');
        targetTime = new Date();
      }
    } else {
      console.log('📅 No valid currentTime provided, using current server time');
      targetTime = new Date();
    }
    
    console.log('📅 Final targetTime:', targetTime.toISOString());
    
    // Convert to Singapore time (UTC+8) for time calculations
    const singaporeTime = new Date(targetTime.getTime());
    
    // Extract date from the ORIGINAL input time (not Singapore time)
    // This ensures we get the correct date from your input
    const targetDate = targetTime.toISOString().split('T')[0] ?? '';
    
    console.log('📅 Processing for date:', targetDate);
    console.log('🕐 Original input time (UTC):', targetTime.toISOString());
    console.log('🕐 Singapore time:', singaporeTime.toISOString());
    
    // Calculate time thresholds (1 hour and 1.5 hours ago from Singapore time)
    const oneHourAgo = new Date(singaporeTime.getTime() - (1 * 60 * 60 * 1000));
    const oneAndHalfHourAgo = new Date(singaporeTime.getTime() - (1.5 * 60 * 60 * 1000));
    
    console.log('⏰ Time thresholds:', {
      oneHourAgo: oneHourAgo.toISOString(),
      oneAndHalfHourAgo: oneAndHalfHourAgo.toISOString()
    });
    
    // Fetch upcoming appointments from today that are already late by 1-1.5 hours
    const lateAppointments = await db
      .select({
        appointment_id: appointments.id,
        appointment_date: appointments.start_datetime,
        appointment_time: appointments.start_datetime,
        status: appointments.status,
        updated_at: appointments.updated_at,
        notes: appointments.notes,
        created_at: appointments.created_at,
        // Lead details
        lead_id: leads.id,
        lead_name: leads.full_name,
        lead_phone: leads.phone_number
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .where(
        and(
          // Status is still upcoming (not yet marked as missed)
          eq(appointments.status, 'upcoming'),
          // Start datetime is already late by 1-1.5 hours
          sql`${appointments.start_datetime} <= ${oneAndHalfHourAgo.toISOString()}`,
          sql`${appointments.start_datetime} >= ${oneHourAgo.toISOString()}`,
          // Has lead phone number
          sql`${leads.phone_number} IS NOT NULL`
        )
      );
    
    console.log(`📋 Found ${lateAppointments.length} upcoming appointments that are already late by 1-1.5 hours`);
    
    // If no late appointments found, return early
    if (lateAppointments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No upcoming appointments found that are already late by 1-1.5 hours',
        data: {
          targetDate,
          currentTime: currentTime,
          originalInputTime: targetTime.toISOString(),
          singaporeTime: singaporeTime.toISOString(),
          oneHourAgo: oneHourAgo.toISOString(),
          oneAndHalfHourAgo: oneAndHalfHourAgo.toISOString(),
          eligibleAppointments: 0,
          remindersSent: 0
        }
      }, { status: 200 });
    }
    
    // Send reminders to each eligible customer
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const appointment of lateAppointments) {
      try {
        console.log(`📱 Sending one-hour reminder for late appointment ${appointment.appointment_id}:`, {
          customerName: appointment.lead_name ?? 'Customer',
          phoneNumber: appointment.lead_phone,
          appointmentTime: appointment.appointment_time,
          status: appointment.status
        });
        
        // Send the WhatsApp reminder
        const result = await sendMissedAppointmentAfterOneHourReminder(
          appointment.lead_phone!,
          appointment.lead_name ?? 'Customer'
        );
        
        if (result.success) {
          successCount++;
          console.log(`✅ Reminder sent successfully for late appointment ${appointment.appointment_id}`);
        } else {
          failureCount++;
          console.error(`❌ Failed to send reminder for late appointment ${appointment.appointment_id}:`, result.error);
        }
        
        results.push({
          appointmentId: appointment.appointment_id,
          customerName: appointment.lead_name ?? 'Customer',
          phoneNumber: appointment.lead_phone,
          appointmentTime: appointment.appointment_time,
          status: appointment.status,
          success: result.success,
          error: result.error ?? null,
          whatsappResponse: result.whatsappResponse ?? null
        });
        
      } catch (error) {
        failureCount++;
        console.error(`❌ Error processing late appointment ${appointment.appointment_id}:`, error);
        results.push({
          appointmentId: appointment.appointment_id,
          customerName: appointment.lead_name ?? 'Customer',
          phoneNumber: appointment.lead_phone,
          appointmentTime: appointment.appointment_time,
          status: appointment.status,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          whatsappResponse: null
        });
      }
    }
    
    console.log(`📊 Reminder summary: ${successCount} successful, ${failureCount} failed`);
    
    return NextResponse.json({
      success: true,
      message: `One hour reminders sent for late upcoming appointments`,
      data: {
        targetDate,
        currentTime: currentTime,
        originalInputTime: targetTime.toISOString(),
        singaporeTime: singaporeTime.toISOString(),
        oneHourAgo: oneHourAgo.toISOString(),
        oneAndHalfHourAgo: oneAndHalfHourAgo.toISOString(),
        eligibleAppointments: lateAppointments.length,
        remindersSent: successCount,
        remindersFailed: failureCount,
        results
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Error in one hour missed appointment reminder API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

// GET method for testing/health check
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'One hour missed appointment reminder API is running',
    endpoint: '/api/appointments/missed/onehour',
    method: 'POST',
    requiredHeaders: ['x-api-key or apikey'],
    body: {
      currentTime: 'string (optional, ISO format, defaults to current time)'
    },
    functionality: 'Fetches missed appointments from today and sends one-hour reminders to customers whose appointments were missed between 1-1.5 hours ago'
  }, { status: 200 });
}
