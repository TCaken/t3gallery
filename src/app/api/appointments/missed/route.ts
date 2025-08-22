'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { appointments, leads } from '~/server/db/schema';
import { eq, and, or, gte, lte } from 'drizzle-orm';

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
    
    // Validate API key (you can add your actual validation logic here)
    const validApiKey = process.env.WORKATO_API_KEY;
    if (apiKey !== validApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      }, { status: 403 });
    }
    
    // Parse request body for additional parameters
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }
    
    // Extract today's date from request body
    const { todaysDate } = requestBody;
    
    console.log('🔍 Missed appointments API called with:', { 
      todaysDate, 
      apiKey: apiKey ? "***" + String(apiKey).slice(-4) : undefined 
    });
    
    // Use provided date or default to today
    let targetDate: string;
    
    if (todaysDate) {
      // Handle different date formats - extract just the date part
      if (todaysDate.includes('T')) {
        // If it's an ISO string, extract just the date part
        targetDate = todaysDate.split('T')[0] ?? '';
      } else {
        // If it's already just a date string
        targetDate = todaysDate;
      }
    } else {
      // Default to today
      targetDate = new Date().toISOString().split('T')[0] ?? '';
    }
    
    // Ensure we have a valid date
    if (!targetDate || targetDate.length !== 10) {
      targetDate = new Date().toISOString().split('T')[0] ?? '';
    }
    
    console.log('📅 Parsed target date:', targetDate);
    
    // Create date range for the entire day (GMT+8)
    // Since the date is already in GMT+8, we'll create a range from start to end of day
    const startOfDay = new Date(`${targetDate}T00:00:00+08:00`);
    const endOfDay = new Date(`${targetDate}T23:59:59+08:00`);
    
    console.log('📅 Querying appointments for date range:', {
      targetDate,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    });
    
    try {
        // Query lead appointments with lead details in a single JOIN query
        const missedAppointmentsWithDetails = await db
          .select({
            // Appointment details
            appointment_id: appointments.id,
            appointment_date: appointments.start_datetime,
            appointment_time: appointments.start_datetime,
            status: appointments.status,
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
              gte(appointments.start_datetime, startOfDay),
              lte(appointments.start_datetime, endOfDay),
              or(
                eq(appointments.status, 'missed')
                // eq(appointments.status, 'cancelled')
              )
            )
          );
        
        console.log(`📊 Found ${missedAppointmentsWithDetails.length} missed/cancelled appointments for ${targetDate}`);
        
        // Format the data for response
        const formattedAppointments = missedAppointmentsWithDetails.map((appointment) => {
          // Format appointment time
          const appointmentTime = appointment.appointment_time 
            ? new Date(appointment.appointment_time).toLocaleTimeString('en-SG', { 
                timeZone: 'Asia/Singapore',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })
            : 'Unknown';
          
          return {
            appointment_id: appointment.appointment_id,
            appointment_date: targetDate,
            appointment_time: appointmentTime,
            status: appointment.status,
            notes: appointment.notes ?? 'No notes',
            lead_id: appointment.lead_id,
            lead_name: appointment.lead_name ?? 'Unknown',
            lead_phone: appointment.lead_phone ?? 'Unknown',
            created_at: appointment.created_at?.toISOString()
          };
        });
        
        // Send WhatsApp reminders for missed appointments
        const whatsappResults = [];
        try {
          if (formattedAppointments.length > 0) {
            console.log('📱 Sending WhatsApp reminders for missed appointments...');
            
            // Import the WhatsApp function
            const { sendMissedAppointmentReminder } = await import('~/app/_actions/whatsappActions');
            
            // Send reminders one by one for each missed appointment
            for (const appointment of formattedAppointments) {
              try {
                console.log(`📱 Sending reminder for appointment ${appointment.appointment_id} to ${appointment.lead_name}`);
                
                // Skip if no valid phone number
                if (!appointment.lead_phone || appointment.lead_phone === 'Unknown') {
                  console.warn(`⚠️ Skipping appointment ${appointment.appointment_id} - no valid phone number`);
                  whatsappResults.push({
                    appointment_id: appointment.appointment_id,
                    lead_name: appointment.lead_name,
                    status: 'skipped',
                    reason: 'No valid phone number'
                  });
                  continue;
                }
                
                // Send the reminder
                const reminderResult = await sendMissedAppointmentReminder(
                  appointment.lead_phone,
                  appointment.lead_name
                );
                
                whatsappResults.push({
                  appointment_id: appointment.appointment_id,
                  lead_name: appointment.lead_name,
                  status: reminderResult.success ? 'success' : 'failed',
                  reason: reminderResult.success ? 'Reminder sent successfully' : reminderResult.error,
                  whatsappResult: reminderResult
                });
                
                if (reminderResult.success) {
                  console.log(`✅ Reminder sent successfully for ${appointment.lead_name}`);
                } else {
                  console.error(`❌ Failed to send reminder for ${appointment.lead_name}:`, reminderResult.error);
                }
                
              } catch (error) {
                console.error(`❌ Error processing appointment ${appointment.appointment_id}:`, error);
                whatsappResults.push({
                  appointment_id: appointment.appointment_id,
                  lead_name: appointment.lead_name,
                  status: 'error',
                  reason: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
                });
              }
            }
            
            // Calculate WhatsApp summary
            const successful = whatsappResults.filter(r => r.status === 'success').length;
            const failed = whatsappResults.filter(r => r.status === 'failed').length;
            const skipped = whatsappResults.filter(r => r.status === 'skipped').length;
            const errors = whatsappResults.filter(r => r.status === 'error').length;
            
            console.log(`📊 WhatsApp reminders completed:`, {
              total: whatsappResults.length,
              successful,
              failed,
              skipped,
              errors
            });
            
          }
        } catch (whatsappError) {
          console.error('❌ Error in WhatsApp reminder process:', whatsappError);
          whatsappResults.push({
            status: 'error',
            reason: `System error: ${whatsappError instanceof Error ? whatsappError.message : 'Unknown error'}`
          });
        }
        
        // Calculate summary statistics
        const totalMissed = formattedAppointments.filter((apt) => apt.status === 'missed').length;
        const totalCancelled = formattedAppointments.filter((apt) => apt.status === 'cancelled').length;
        const totalProcessed = formattedAppointments.length;
        
        return NextResponse.json({
          success: true,
          message: `Missed appointments data for ${targetDate}`,
          data: {
            processedCount: totalProcessed,
            successCount: totalProcessed,
            errorCount: 0,
            currentDate: targetDate,
            singaporeTime: new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
            missedAppointments: formattedAppointments,
            whatsappReminders: whatsappResults,
            summary: {
              totalMissed,
              totalCancelled,
              totalProcessed,
              rescheduledCount: 0, // You can add this logic if needed
              followUpRequired: totalProcessed // All missed/cancelled appointments need follow-up
            },
            queryInfo: {
              dateRange: {
                start: startOfDay.toISOString(),
                end: endOfDay.toISOString()
              },
              totalFound: totalProcessed
            }
          }
        }, { status: 200 });
      } catch (dbError) {
      console.error('❌ Database error while querying appointments:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Error in missed appointments API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Missed Appointments API',
    description: 'POST to this endpoint to get missed appointments data for today',
    authentication: 'Requires x-api-key or apikey header with valid WORKATO_API_KEY',
    usage: 'POST /api/appointments/missed',
    bodyParameters: {
      todaysDate: 'Optional: Date in YYYY-MM-DD format (defaults to today)'
    },
    example: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'your_api_key_here'
      },
      body: {
        todaysDate: '2024-01-15'
      }
    },
    response: {
      success: true,
      data: {
        missedAppointments: 'Array of missed/cancelled appointments',
        whatsappReminders: 'Array of WhatsApp reminder results for each appointment',
        summary: 'Summary statistics',
        queryInfo: 'Query execution details'
      }
    }
  }, { status: 200 });
}
