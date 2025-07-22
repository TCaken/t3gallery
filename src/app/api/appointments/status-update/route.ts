/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { appointments, leads, borrower_appointments, borrowers, timeslots, appointment_timeslots, borrower_appointment_timeslots } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, gte, lte, isNull, desc, asc } from "drizzle-orm";
import { format, addHours } from 'date-fns';
import { updateLead, createLead } from "~/app/_actions/leadActions";
import { createAppointment } from "~/app/_actions/appointmentAction";
import { createBorrowerAppointment } from "~/app/_actions/borrowerAppointments";

// Types for Excel data structure (based on the provided JSON)
interface ExcelRow {
  row_number: number;
  col_Date: string;
  col_UW: string;
  col_RM: string;
  col_Group: string;
  col_Code: string;
  "col_Loan Portal Applied": string;
  col_Manual: string;
  "col_Reason for manual": string;
  "col_Full Name": string;
  "col_Mobile Number": string;
  "col_H/P": string;
  "col_New or Reloan? ": string;
  col_RS: string;
  "col_RS -Detailed": string;
  "col_Please choose your nationality or Work Pass ": string;
  "col_Last 4 digits of the NRIC (including the alphabet)": string;
  "col_Marital Status": string;
  "col_Your Employment Specialisation": string;
  "col_Email Address": string;
  "col_Monthly Income": string;
  "col_Loan Amount Applying?": string;
  "col_Are you a Declared Bankruptcy at the time of this loan application?": string;
  "col_Which year is your bankruptcy discharge?": string;
  "col_What is your work designation?": string;
  "col_For how long have you been working in this company?": string;
  "col_Place of Residence": string;
  "col_Number of Room HDB Flat": string;
  "col_What is the purpose of the Loan?": string;
  "col_How many Moneylender Company do you currently have outstanding loan?": string;
  "col_**Declaration - 声明 ** ": string;
  "col_Employment Type": string;
  [key: string]: unknown; // For other Excel columns
}

interface ExcelData {
  rows: ExcelRow[];
  spreadsheet_id: string;
  spreadsheet_name: string;
  sheet: string;
}

// Processing modes
type ProcessingMode = 'realtime' | 'end_of_day';

// Helper function to find lead by phone number
async function findLeadByPhone(phoneNumber: string) {
  const cleanPhone = phoneNumber.replace(/^\+65/, '').replace(/\D/g, '');
  
  const foundLead = await db
    .select()
    .from(leads)
    .where(eq(leads.phone_number, `+65${cleanPhone}`))
    .limit(1);
  
  return foundLead.length > 0 ? foundLead[0] : null;
}

// Helper function to find nearest available timeslot
async function findNearestTimeslot(targetDate: string) {
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

  // Return first slot regardless of capacity (allow overbooking)
  if (availableSlots.length > 0) {
    return availableSlots[0];
  }

  // If no slots available today, try next few days
  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + i);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    if (futureDateStr) {
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

      if (futureSlots.length > 0) {
        return futureSlots[0];
      }
    }
  }

  return null; // No available slots found
}

// Helper function to check if appointment turned up (UW field filled)
function checkAppointmentAttendance(row: ExcelRow): boolean {
  const uwField = row.col_UW?.toString().trim();
  return !!(uwField && uwField.length > 0 && uwField.toLowerCase() !== 'n/a');
}

// Helper function to find borrower by phone number
async function findBorrowerByPhone(phoneNumber: string) {
  const cleanPhone = phoneNumber.replace(/^\+65/, '').replace(/\D/g, '');
  
  const foundBorrower = await db
    .select()
    .from(borrowers)
    .where(eq(borrowers.phone_number, `+65${cleanPhone}`))
    .limit(1);
  
  return foundBorrower.length > 0 ? foundBorrower[0] : null;
}

// Helper function to move appointment to new timeslot
async function moveAppointmentToTimeslot(appointmentId: number, newTimeslotId: number, userId: string) {
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
}

// Helper function to move borrower appointment to new timeslot
async function moveBorrowerAppointmentToTimeslot(appointmentId: number, newTimeslotId: number, userId: string) {
  return await db.transaction(async (tx) => {
    // Get current borrower appointment details
    const currentAppt = await tx
      .select({
        appointment: borrower_appointments,
        timeslot_id: borrower_appointment_timeslots.timeslot_id
      })
      .from(borrower_appointments)
      .leftJoin(borrower_appointment_timeslots, eq(borrower_appointments.id, borrower_appointment_timeslots.borrower_appointment_id))
      .where(eq(borrower_appointments.id, appointmentId))
      .limit(1);

    if (currentAppt.length === 0) {
      throw new Error('Borrower appointment not found');
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
    
    // Update borrower appointment times
    const slotDate = typeof slot.date === 'string' ? slot.date : format(slot.date, 'yyyy-MM-dd');
    const startTimeString = `${slotDate}T${slot.start_time}`;
    const endTimeString = `${slotDate}T${slot.end_time}`;
    
    const startSGT = new Date(startTimeString);
    const endSGT = new Date(endTimeString);
    const startUTC = new Date(startSGT.getTime() - (8 * 60 * 60 * 1000));
    const endUTC = new Date(endSGT.getTime() - (8 * 60 * 60 * 1000));

    await tx
      .update(borrower_appointments)
      .set({
        start_datetime: startUTC,
        end_datetime: endUTC,
        updated_at: new Date(),
        updated_by: userId
      })
      .where(eq(borrower_appointments.id, appointmentId));

    // Update timeslot relationships
    if (oldTimeslotId) {
      // Remove old relationship and decrease old timeslot count
      await tx
        .delete(borrower_appointment_timeslots)
        .where(
          and(
            eq(borrower_appointment_timeslots.borrower_appointment_id, appointmentId),
            eq(borrower_appointment_timeslots.timeslot_id, oldTimeslotId)
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
      .insert(borrower_appointment_timeslots)
      .values({
        borrower_appointment_id: appointmentId,
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
}

export async function POST(request: NextRequest) {
  try {
    // Get request parameters - handle both JSON and form data from Workato
    let excelData: ExcelData | undefined;
    let thresholdHours = 3;
    let processingMode: ProcessingMode = 'realtime';
    let apiKey: string | undefined;
    let agentUserId: string | undefined;
    
    const contentType = request.headers.get('content-type') ?? '';
    
    if (contentType.includes('application/json')) {
      // Handle JSON format
      try {
        const body = await request.json() as { 
          excelData?: ExcelData; 
          thresholdHours?: number;
          mode?: ProcessingMode;
          api_key?: string;
          agent_user_id?: string;
        };
        excelData = body.excelData;
        thresholdHours = body.thresholdHours ?? 3;
        processingMode = body.mode ?? 'realtime';
        apiKey = body.api_key;
        agentUserId = body.agent_user_id;
      } catch (jsonError) {
        console.error('❌ JSON parsing failed:', jsonError);
        return NextResponse.json({
          error: "Invalid JSON format",
          details: (jsonError as Error).message
        }, { status: 400 });
      }
    } else {
      // Handle form-encoded data from Workato
      try {
        const formData = await request.formData();
        
        // Try different possible field names that Workato might use
        let rowsData = null;
        
        // Check for 'rows' field
        const rowsField = formData.get('rows');
        if (rowsField && typeof rowsField === 'string') {
          rowsData = rowsField;
        }
        
        // Check for 'excelData' field
        const excelDataField = formData.get('excelData');
        if (excelDataField && typeof excelDataField === 'string') {
          try {
            const parsed = JSON.parse(excelDataField);
            if (parsed.rows) {
              rowsData = JSON.stringify(parsed.rows);
            }
          } catch (e) {
            rowsData = excelDataField;
          }
        }
        
        // Check for direct JSON in body (sometimes Workato sends this way)
        if (!rowsData) {
          const bodyText = await request.text();
          
          try {
            // Try to parse the entire body as JSON
            const parsed = JSON.parse(bodyText);
            if (parsed.rows) {
              rowsData = JSON.stringify(parsed.rows);
            } else if (Array.isArray(parsed)) {
              rowsData = JSON.stringify(parsed);
            }
          } catch (e) {
          }
        }
        
        if (rowsData) {
          const rows = JSON.parse(rowsData);
          
          excelData = {
            rows: Array.isArray(rows) ? rows : [rows],
            spreadsheet_id: (formData.get('spreadsheet_id') as string) ?? 'workato',
            spreadsheet_name: (formData.get('spreadsheet_name') as string) ?? 'Workato Import',
            sheet: (formData.get('sheet') as string) ?? 'Sheet1'
          };
          
          const thresholdParam = formData.get('thresholdHours');
          if (thresholdParam && typeof thresholdParam === 'string') {
            thresholdHours = parseFloat(thresholdParam) || 3;
          }

          const modeParam = formData.get('mode');
          if (modeParam && typeof modeParam === 'string') {
            processingMode = (modeParam as ProcessingMode) ?? 'realtime';
          }

          // Get API key and agent user ID from form data
          const apiKeyParam = formData.get('api_key');
          if (apiKeyParam && typeof apiKeyParam === 'string') {
            apiKey = apiKeyParam;
          }

          const agentUserIdParam = formData.get('agent_user_id');
          if (agentUserIdParam && typeof agentUserIdParam === 'string') {
            agentUserId = agentUserIdParam;
          }
          
          console.log('✅ Successfully parsed form data');
          console.log(`📊 Found ${excelData.rows.length} rows`);
        } else {
          return NextResponse.json({
            error: "No data found in request",
            help: "Workato should send 'rows' parameter with Excel data",
            receivedFields: Array.from(formData.keys())
          }, { status: 400 });
        }
        
      } catch (formError) {
        console.error('❌ Form parsing failed:', formError);
        
        // Last resort: try to get from URL parameters
        try {
          const url = new URL(request.url);
          const rowsParam = url.searchParams.get('rows');
          
          if (rowsParam) {
            const decodedRows = decodeURIComponent(rowsParam);
            const rows = JSON.parse(decodedRows);
            excelData = {
              rows: Array.isArray(rows) ? rows : [rows],
              spreadsheet_id: url.searchParams.get('spreadsheet_id') ?? 'url-param',
              spreadsheet_name: url.searchParams.get('spreadsheet_name') ?? 'URL Parameters',
              sheet: url.searchParams.get('sheet') ?? 'Sheet1'
            };
            thresholdHours = parseFloat(url.searchParams.get('thresholdHours') ?? '3');
            processingMode = (url.searchParams.get('mode') as ProcessingMode) ?? 'realtime';
            apiKey = url.searchParams.get('api_key') ?? undefined;
            agentUserId = url.searchParams.get('agent_user_id') ?? undefined;
          } else {
            throw new Error('No rows parameter found');
          }
        } catch (urlError) {
          console.error('❌ URL parameter parsing also failed:', urlError);
          return NextResponse.json({
            error: "Failed to parse request data",
            details: `Form Error: ${(formError as Error).message}, URL Error: ${(urlError as Error).message}`,
            help: "Please check Workato configuration. Expected 'rows' parameter with JSON array."
          }, { status: 400 });
        }
      }
    }

    // Validate API key and determine user ID to use
    const envApiKey = process.env.API_KEY;
    let authenticatedUserId = "system-update"; // Default fallback
    let isAuthenticated = false;

    if (apiKey && envApiKey && apiKey === envApiKey) {
      // API key is valid
      isAuthenticated = true;
      if (agentUserId?.trim()) {
        authenticatedUserId = agentUserId.trim();
        console.log(`🔐 API key validated - Using agent user ID: ${authenticatedUserId}`);
      } else {
        console.log(`🔐 API key validated - No agent_user_id provided, using system-update`);
      }
    } else if (apiKey) {
      // API key provided but invalid
      console.log(`❌ Invalid API key provided`);
      return NextResponse.json({
        error: "Invalid API key",
        message: "The provided API key is not valid"
      }, { status: 401 });
    } else {
      // No API key provided - use fallback (for manual testing)
      console.log(`⚠️ No API key provided - Using fallback user ID for manual testing`);
    }

    console.log(`🔄 Starting appointment status update process in ${processingMode} mode...`);
    console.log('⏰ Threshold hours:', thresholdHours);
    console.log(`👤 Using user ID: ${authenticatedUserId} (Authenticated: ${isAuthenticated})`);

    // Get today's date in Singapore timezone (UTC+8)
    const now = new Date();
    const singaporeOffset = 8 * 60; // 8 hours in minutes
    const singaporeTime = new Date(now.getTime() + (singaporeOffset * 60 * 1000));
    const todaySingapore = singaporeTime.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log('📅 Today (Singapore):', todaySingapore);

    // Use authenticated user ID for updates
    const fallbackUserId = authenticatedUserId;

    let processedCount = 0;
    let updatedCount = 0;
    let createdLeadsCount = 0;
    let createdAppointmentsCount = 0;
    let movedAppointmentsCount = 0;
    
    const results: Array<{
      appointmentId: string;
      leadId: string;
      leadName: string;
      oldAppointmentStatus: string;
      newAppointmentStatus: string;
      oldLeadStatus: string;
      newLeadStatus: string;
      reason: string;
      appointmentTime: string;
      timeDiffHours: string;
      action: string;
      error?: string;
    }> = [];

    // Process based on mode
    if (processingMode === 'end_of_day') {
      // END OF DAY MODE: Process all done appointments
      console.log('🌅 Running end-of-day processing...');
      
      // Get all done appointments for today
    const startOfDaySGT = new Date(`${todaySingapore}T00:00:00.000Z`);
    const endOfDaySGT = new Date(`${todaySingapore}T23:59:59.999Z`);
    const startOfDayUTC = new Date(startOfDaySGT.getTime() - (8 * 60 * 60 * 1000));
    const endOfDayUTC = new Date(endOfDaySGT.getTime() - (8 * 60 * 60 * 1000));

      const doneAppointments = await db
      .select({
        appointment: appointments,
        lead: leads
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .where(
        and(
            eq(appointments.status, 'done'),
          gte(appointments.start_datetime, startOfDayUTC),
          lte(appointments.start_datetime, endOfDayUTC)
        )
      );

      console.log(`📋 Found ${doneAppointments.length} done appointments for end-of-day processing`);

      for (const record of doneAppointments) {
        const appointment = record.appointment;
        const lead = record.lead;
        
        if (!lead) continue;

        // Update lead status based on loan status
        if (appointment.loan_status === 'RS') {
          try {
            await updateLead(lead.id, {
              status: 'missed/RS',
              updated_by: fallbackUserId
            });

            results.push({
              appointmentId: appointment.id.toString(),
              leadId: lead.id.toString(),
              leadName: lead.full_name ?? 'Unknown',
              oldAppointmentStatus: appointment.status,
              newAppointmentStatus: appointment.status,
              oldLeadStatus: lead.status,
              newLeadStatus: 'missed/RS',
              reason: 'End-of-day: RS status converted to missed/RS',
              appointmentTime: format(new Date(appointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)), 'yyyy-MM-dd HH:mm'),
              timeDiffHours: 'N/A',
              action: 'end_of_day_update'
            });

            updatedCount++;
          } catch (error) {
            console.error(`❌ Error updating lead ${lead.id} in end-of-day processing:`, error);
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `End-of-day processing completed. Updated ${updatedCount} leads.`,
        mode: processingMode,
        processed: doneAppointments.length,
        updated: updatedCount,
        todaySingapore,
        results,
        authentication: {
          authenticated: isAuthenticated,
          userId: authenticatedUserId,
          apiKeyProvided: !!apiKey
        },
        summary: {
          mode: processingMode,
          doneAppointmentsProcessed: doneAppointments.length,
          leadStatusUpdates: updatedCount,
          errorCount: results.filter(r => r.error).length,
          authenticatedUser: authenticatedUserId,
          isAuthenticated: isAuthenticated
        }
      });
    }

    // REALTIME MODE: Process Excel data and live updates
    console.log('⚡ Running real-time processing...');

    if (!excelData?.rows || excelData.rows.length === 0) {
      return NextResponse.json({
        error: "No Excel data provided for real-time processing",
        help: "Real-time mode requires Excel data with appointment information"
      }, { status: 400 });
    }

    // Process each Excel row
      for (const row of excelData.rows) {
        processedCount++;
        
      try {
        // Parse the timestamp from Excel (which is in GMT+8)
        let excelDate: string;
        try {
          const timestampStr = row.col_Date;
          if (!timestampStr) {
            throw new Error('Empty timestamp');
          }

          // Handle DD/MM/YY or DD/MM/YYYY format
          if (timestampStr.includes('/') || timestampStr.includes('-')) {
            const parts = timestampStr.split(/[\/-]/);
            if (parts.length !== 3) {
              throw new Error('Invalid date format: expected DD/MM/YY or DD/MM/YYYY');
            }

            const [day, month, yearTime] = parts;
            if (!day || !month || !yearTime) {
              throw new Error('Invalid date format: missing day, month, or year');
            }

            const [yearPart] = yearTime.split(' ');
            if (!yearPart) {
              throw new Error('Invalid date format: missing year');
            }

            const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
            excelDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else {
            throw new Error('Unsupported date format');
          }
        } catch (error) {
          console.error(`❌ Error parsing timestamp for row ${row.row_number}:`, error);
          continue;
        }

        // Clean and format the phone number from Excel
        const cleanExcelPhone = row["col_Mobile Number"]?.toString().replace(/\D/g, '');
        if (!cleanExcelPhone) {
          console.log(`⚠️ No phone number found in row ${row.row_number}`);
          continue;
        }

        const formattedPhone = `+65${cleanExcelPhone}`;
        const fullName = row["col_Full Name"]?.toString().trim() || '';
        const loanType = row["col_New or Reloan? "]?.toString().trim() || '';
        
        // Check if appointment turned up (UW field filled)
        const appointmentTurnedUp = checkAppointmentAttendance(row);
        
        // Determine target date for appointment
        const isExcelToday = excelDate === todaySingapore;
        const targetAppointmentDate = isExcelToday ? todaySingapore : excelDate;
        
        console.log(`📅 Processing ${fullName} - Excel date: ${excelDate}, Today: ${todaySingapore}, Target: ${targetAppointmentDate}`);
        
        // Find existing lead by phone number
        const existingLead = await findLeadByPhone(formattedPhone);

        if (!existingLead) {
          // Case A: Lead doesn't exist - create new lead and assign to SEO
          console.log(`🆕 Creating new lead for phone ${cleanExcelPhone}`);
          
          const createLeadResult = await createLead({
            phone_number: formattedPhone,
            full_name: fullName,
            source: 'SEO',
            status: 'new',
            lead_type: loanType.includes('Re Loan') ? 'reloan' : 'new',
            amount: row["col_Loan Amount Applying?"]?.toString() || '',
            email: row["col_Email Address"]?.toString() || '',
            employment_status: row["col_Employment Type"]?.toString() || '',
            loan_purpose: row["col_What is the purpose of the Loan?"]?.toString() || '',
            created_by: authenticatedUserId,
            updated_by: authenticatedUserId,
            bypassEligibility: false // Check eligibility for new leads
          });

          if (createLeadResult.success && createLeadResult.lead) {
            createdLeadsCount++;
            
            // Create appointment for the target date (could be today or future date)
            const nearestTimeslot = await findNearestTimeslot(targetAppointmentDate);
            if (nearestTimeslot) {
              const appointmentResult = await createAppointment({
                leadId: createLeadResult.lead.id,
                timeslotId: nearestTimeslot.id,
                notes: `Auto-created from Google Sheets - ${fullName} (Original date: ${excelDate})`,
                isUrgent: false,
                overrideUserId: authenticatedUserId
              });
        
              if (appointmentResult.success && 'appointment' in appointmentResult && appointmentResult.appointment) {
                createdAppointmentsCount++;
          
                // Update appointment status based on attendance (only if it's for today and attended)
                const appointmentStatus = (isExcelToday && appointmentTurnedUp) ? 'done' : 'upcoming';
                const leadStatus = (isExcelToday && appointmentTurnedUp) ? 'done' : 'booked';
                
                if (isExcelToday && appointmentTurnedUp) {
                  await db.update(appointments)
              .set({
                      status: appointmentStatus,
                updated_by: fallbackUserId
              })
                    .where(eq(appointments.id, appointmentResult.appointment.id));
                    
                  await updateLead(createLeadResult.lead.id, {
                    status: leadStatus,
                    updated_by: fallbackUserId
                  });
          }

                results.push({
                  appointmentId: appointmentResult.appointment.id.toString(),
                  leadId: createLeadResult.lead.id.toString(),
                  leadName: fullName,
                  oldAppointmentStatus: 'none',
                  newAppointmentStatus: appointmentStatus,
                  oldLeadStatus: 'none',
                  newLeadStatus: leadStatus,
                  reason: `New lead created and appointment scheduled for ${targetAppointmentDate}${(isExcelToday && appointmentTurnedUp) ? ' - Marked as attended' : ''}`,
                  appointmentTime: format(new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time), 'yyyy-MM-dd HH:mm'),
                  timeDiffHours: 'N/A',
                  action: 'create_lead_and_appointment'
                });
              }
            }
          }
        } else {
          // Lead exists - check for appointments on the target date
          const targetDateAppointments = await db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.lead_id, existingLead.id),
                gte(appointments.start_datetime, new Date(`${targetAppointmentDate}T00:00:00.000Z`)),
                lte(appointments.start_datetime, new Date(`${targetAppointmentDate}T23:59:59.999Z`))
              )
            );
            
          // Also check for any upcoming appointments on other dates
          const anyUpcomingAppointments = await db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.lead_id, existingLead.id),
                eq(appointments.status, 'upcoming')
              )
            );

          if (targetDateAppointments.length === 0) {
            // No appointment for target date
            
            if (anyUpcomingAppointments.length > 0) {
              // Case C: Has appointment on different date - move it to target date
              const appointmentToMove = anyUpcomingAppointments[0];
              if (appointmentToMove) {
                console.log(`📅 Moving existing appointment for lead ${existingLead.id} to ${targetAppointmentDate}`);
                
                const nearestTimeslot = await findNearestTimeslot(targetAppointmentDate);
                if (nearestTimeslot) {
                  const moveResult = await moveAppointmentToTimeslot(
                    appointmentToMove.id, 
                    nearestTimeslot.id, 
                    fallbackUserId
                  );

                  if (moveResult.success) {
                    movedAppointmentsCount++;
                    
                    // Update status based on attendance (only if moved to today and attended)
                    const appointmentStatus = (isExcelToday && appointmentTurnedUp) ? 'done' : 'upcoming';
                    const leadStatus = (isExcelToday && appointmentTurnedUp) ? 'done' : 'booked';
                    
                    if (isExcelToday && appointmentTurnedUp) {
                      await db.update(appointments)
          .set({ 
                          status: appointmentStatus,
            updated_by: fallbackUserId
          })
                        .where(eq(appointments.id, appointmentToMove.id));
                        
                      await updateLead(existingLead.id, {
                        status: leadStatus,
          updated_by: fallbackUserId
        });
                    }
        
        results.push({
                      appointmentId: appointmentToMove.id.toString(),
                      leadId: existingLead.id.toString(),
                      leadName: fullName,
                      oldAppointmentStatus: appointmentToMove.status,
                      newAppointmentStatus: appointmentStatus,
                      oldLeadStatus: existingLead.status,
                      newLeadStatus: leadStatus,
                      reason: `Appointment moved from ${format(new Date(appointmentToMove.start_datetime), 'yyyy-MM-dd')} to ${targetAppointmentDate}${(isExcelToday && appointmentTurnedUp) ? ' and marked as attended' : ''}`,
                      appointmentTime: format(new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time), 'yyyy-MM-dd HH:mm'),
                      timeDiffHours: 'N/A',
                      action: 'move_appointment'
                    });
                  }
                }
              }
            } else {
              // Case B: Lead exists but no appointment at all - create appointment for target date
              console.log(`📅 Creating appointment for existing lead ${existingLead.id} on ${targetAppointmentDate}`);
              
              const nearestTimeslot = await findNearestTimeslot(targetAppointmentDate);
              if (nearestTimeslot) {
                const appointmentResult = await createAppointment({
                  leadId: existingLead.id,
                  timeslotId: nearestTimeslot.id,
                  notes: `Auto-created from Google Sheets for existing lead - ${fullName} (Original date: ${excelDate})`,
                  isUrgent: false,
                  overrideUserId: authenticatedUserId
                });

                if (appointmentResult.success && 'appointment' in appointmentResult && appointmentResult.appointment) {
                  createdAppointmentsCount++;
                  
                  // Update appointment status based on attendance (only if it's for today and attended)
                  const appointmentStatus = (isExcelToday && appointmentTurnedUp) ? 'done' : 'upcoming';
                  const leadStatus = (isExcelToday && appointmentTurnedUp) ? 'done' : 'booked';
                  
                  if (isExcelToday && appointmentTurnedUp) {
                    await db.update(appointments)
                      .set({ 
                        status: appointmentStatus,
                        updated_by: fallbackUserId 
                      })
                      .where(eq(appointments.id, appointmentResult.appointment.id));
                      
                    await updateLead(existingLead.id, {
                      status: leadStatus,
                      updated_by: fallbackUserId
                    });
                  }

                  results.push({
                    appointmentId: appointmentResult.appointment.id.toString(),
                    leadId: existingLead.id.toString(),
                    leadName: fullName,
                    oldAppointmentStatus: 'none',
                    newAppointmentStatus: appointmentStatus,
                    oldLeadStatus: existingLead.status,
                    newLeadStatus: leadStatus,
                    reason: `Appointment created for existing lead on ${targetAppointmentDate}${(isExcelToday && appointmentTurnedUp) ? ' - Marked as attended' : ''}`,
                    appointmentTime: format(new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time), 'yyyy-MM-dd HH:mm'),
                    timeDiffHours: 'N/A',
                    action: 'create_appointment'
                  });
                }
              }
            }
          } else {
            // Case D: Lead has appointment on target date - update status
            const targetDateAppointment = targetDateAppointments[0];
            
            if (targetDateAppointment && isExcelToday) {
              // Only update if it's today's appointment - for future appointments, just acknowledge
        const code = row.col_Code?.trim().toUpperCase();
              let newAppointmentStatus = targetDateAppointment.status;
              let newLeadStatus = existingLead.status;
        let updateReason = '';

              // Determine status based on attendance and codes
              if (appointmentTurnedUp) {
                newAppointmentStatus = 'done';
                newLeadStatus = 'done';
                updateReason = 'Marked as attended (UW field filled)';
                
                // Update based on code if provided
                if (code) {
        switch (code) {
          case 'P':
                      newLeadStatus = 'done';
                      updateReason += ' - P (Completed)';
            break;
          case 'PRS':
                      newLeadStatus = 'done';
                      updateReason += ' - PRS (Customer Rejected)';
            break;
          case 'RS':
                      newLeadStatus = 'missed/RS';
                      updateReason += ' - RS (Rejected by System)';
            break;
          case 'R':
                      newLeadStatus = 'done';
                      updateReason += ' - R (Rejected)';
                  break;
                }
                }
              } else {
                // Check if appointment should be marked as missed based on time threshold
                const appointmentTimeSGT = new Date(targetDateAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000));
                const timeDiffMs = singaporeTime.getTime() - appointmentTimeSGT.getTime();
                const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

                if (timeDiffHours >= thresholdHours) {
                  newAppointmentStatus = 'missed';
                  newLeadStatus = 'missed/RS';
                  updateReason = `Time threshold exceeded (${timeDiffHours.toFixed(2)}h late)`;
                }
              }

              // Apply updates if status changed
              if (newAppointmentStatus !== targetDateAppointment.status || newLeadStatus !== existingLead.status) {
                await db.update(appointments)
          .set({ 
            status: newAppointmentStatus,
                    updated_by: fallbackUserId 
          })
                  .where(eq(appointments.id, targetDateAppointment.id));
                  
                await updateLead(existingLead.id, {
                  status: newLeadStatus,
                  updated_by: fallbackUserId
                });
        
        results.push({
                  appointmentId: targetDateAppointment.id.toString(),
                  leadId: existingLead.id.toString(),
                  leadName: fullName,
                  oldAppointmentStatus: targetDateAppointment.status,
          newAppointmentStatus: newAppointmentStatus,
                  oldLeadStatus: existingLead.status,
                  newLeadStatus: newLeadStatus,
                  reason: updateReason,
                  appointmentTime: format(new Date(targetDateAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)), 'yyyy-MM-dd HH:mm'),
                  timeDiffHours: appointmentTurnedUp ? 'N/A' : `${((singaporeTime.getTime() - new Date(targetDateAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)).getTime()) / (1000 * 60 * 60)).toFixed(2)}`,
                  action: 'update_existing_appointment'
                });

        updatedCount++;
              }
            } else if (targetDateAppointment && !isExcelToday) {
              // Future appointment exists - just acknowledge it
              results.push({
                appointmentId: targetDateAppointment.id.toString(),
                leadId: existingLead.id.toString(),
                leadName: fullName,
                oldAppointmentStatus: targetDateAppointment.status,
                newAppointmentStatus: targetDateAppointment.status,
                oldLeadStatus: existingLead.status,
                newLeadStatus: existingLead.status,
                reason: `Future appointment already exists for ${targetAppointmentDate} - no changes needed`,
                appointmentTime: format(new Date(targetDateAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)), 'yyyy-MM-dd HH:mm'),
                timeDiffHours: 'N/A',
                action: 'acknowledge_future_appointment'
              });
            }
          }
        }
        
        // Handle borrower appointments for Re Loan cases
        if (loanType.includes('Re Loan')) {
          // Find existing borrower by phone number
          const existingBorrower = await findBorrowerByPhone(formattedPhone);
          
          if (existingBorrower) {
            // Borrower exists - check for appointments
            const todayBorrowerAppointments = await db
              .select()
              .from(borrower_appointments)
              .where(
                and(
                  eq(borrower_appointments.borrower_id, existingBorrower.id),
                  gte(borrower_appointments.start_datetime, new Date(`${targetAppointmentDate}T00:00:00.000Z`)),
                  lte(borrower_appointments.start_datetime, new Date(`${targetAppointmentDate}T23:59:59.999Z`))
                )
              );

            if (todayBorrowerAppointments.length === 0) {
              // No borrower appointment for today - create one
              console.log(`📅 Creating borrower appointment for existing borrower ${existingBorrower.id}`);
              
              const nearestTimeslot = await findNearestTimeslot(targetAppointmentDate);
              if (nearestTimeslot) {
                // Use existing createBorrowerAppointment function with API key support
                const borrowerAppointmentResult = await createBorrowerAppointment({
                  borrower_id: existingBorrower.id,
                  agent_id: authenticatedUserId,
                  appointment_type: "reloan_consultation",
                  notes: `Auto-created from Google Sheets - ${fullName} (Original date: ${excelDate})`,
                  lead_source: "Google Sheets",
                  start_datetime: new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time),
                  end_datetime: new Date(nearestTimeslot.date + 'T' + nearestTimeslot.end_time),
                  timeslot_ids: [nearestTimeslot.id],
                  overrideUserId: authenticatedUserId
                });

                if (borrowerAppointmentResult.success && borrowerAppointmentResult.data) {
                  const newBorrowerAppointment = borrowerAppointmentResult.data;
                  
                  // Update status if it's for today and attended
                  if (isExcelToday && appointmentTurnedUp) {
                    await db.update(borrower_appointments)
                      .set({ 
                        status: 'done',
                        updated_by: authenticatedUserId 
                      })
                      .where(eq(borrower_appointments.id, newBorrowerAppointment.id));
                  }

                  createdAppointmentsCount++;

                  results.push({
                    appointmentId: `B${newBorrowerAppointment.id}`,
                    leadId: `B${existingBorrower.id}`,
                    leadName: fullName,
                    oldAppointmentStatus: 'none',
                    newAppointmentStatus: (isExcelToday && appointmentTurnedUp) ? 'done' : 'upcoming',
                    oldLeadStatus: existingBorrower.status,
                    newLeadStatus: existingBorrower.status,
                    reason: `Borrower appointment created for ${targetAppointmentDate}${(isExcelToday && appointmentTurnedUp) ? ' - Marked as attended' : ''}`,
                    appointmentTime: format(new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time), 'yyyy-MM-dd HH:mm'),
                    timeDiffHours: 'N/A',
                    action: 'create_borrower_appointment'
                  });
                }
              }
            } else {
              // Has borrower appointment - update or move it
              const todayBorrowerAppointment = todayBorrowerAppointments[0];
              
              if (todayBorrowerAppointment && isExcelToday) {
                // Update status based on attendance
                let newAppointmentStatus = todayBorrowerAppointment.status;
                let updateReason = '';

                if (appointmentTurnedUp) {
                  newAppointmentStatus = 'done';
                  updateReason = 'Marked as attended (UW field filled)';
                } else {
                  // Check time threshold
                  const appointmentTimeSGT = new Date(todayBorrowerAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000));
                  const timeDiffMs = singaporeTime.getTime() - appointmentTimeSGT.getTime();
                  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

                  if (timeDiffHours >= thresholdHours) {
                    newAppointmentStatus = 'missed';
                    updateReason = `Time threshold exceeded (${timeDiffHours.toFixed(2)}h late)`;
                  }
                }

                if (newAppointmentStatus !== todayBorrowerAppointment.status) {
                  await db.update(borrower_appointments)
                    .set({ 
                      status: newAppointmentStatus,
                      updated_by: authenticatedUserId
                    })
                    .where(eq(borrower_appointments.id, todayBorrowerAppointment.id));

                  results.push({
                    appointmentId: `B${todayBorrowerAppointment.id}`,
                    leadId: `B${existingBorrower.id}`,
                    leadName: fullName,
                    oldAppointmentStatus: todayBorrowerAppointment.status,
                    newAppointmentStatus: newAppointmentStatus,
                    oldLeadStatus: existingBorrower.status,
                    newLeadStatus: existingBorrower.status,
                    reason: updateReason,
                    appointmentTime: format(new Date(todayBorrowerAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)), 'yyyy-MM-dd HH:mm'),
                    timeDiffHours: appointmentTurnedUp ? 'N/A' : `${((singaporeTime.getTime() - new Date(todayBorrowerAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)).getTime()) / (1000 * 60 * 60)).toFixed(2)}`,
                    action: 'update_borrower_appointment'
                  });

                  updatedCount++;
                }
              } else {
                // Has borrower appointment on different date - move to today
                const existingBorrowerAppointment = await db
                  .select()
                  .from(borrower_appointments)
                  .where(
                    and(
                      eq(borrower_appointments.borrower_id, existingBorrower.id),
                      eq(borrower_appointments.status, 'upcoming')
                    )
                  )
                  .limit(1);

                if (existingBorrowerAppointment.length > 0 && existingBorrowerAppointment[0]) {
                  const appointmentToMove = existingBorrowerAppointment[0];
                  const nearestTimeslot = await findNearestTimeslot(targetAppointmentDate);
                  if (nearestTimeslot) {
                    const moveResult = await moveBorrowerAppointmentToTimeslot(
                      appointmentToMove.id, 
                      nearestTimeslot.id, 
                      authenticatedUserId
                    );

                    if (moveResult.success) {
                      movedAppointmentsCount++;
                      
                      // Update status based on attendance
                      const appointmentStatus = (isExcelToday && appointmentTurnedUp) ? 'done' : 'upcoming';
                      
                      if (isExcelToday && appointmentTurnedUp) {
                        await db.update(borrower_appointments)
                          .set({ 
                            status: appointmentStatus,
                            updated_by: authenticatedUserId
                          })
                          .where(eq(borrower_appointments.id, appointmentToMove.id));
                      }

                      results.push({
                        appointmentId: `B${appointmentToMove.id}`,
                        leadId: `B${existingBorrower.id}`,
                        leadName: fullName,
                        oldAppointmentStatus: appointmentToMove.status,
                        newAppointmentStatus: appointmentStatus,
                        oldLeadStatus: existingBorrower.status,
                        newLeadStatus: existingBorrower.status,
                        reason: `Borrower appointment moved from ${format(new Date(appointmentToMove.start_datetime), 'yyyy-MM-dd')} to ${targetAppointmentDate}${(isExcelToday && appointmentTurnedUp) ? ' and marked as attended' : ''}`,
                        appointmentTime: format(new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time), 'yyyy-MM-dd HH:mm'),
                        timeDiffHours: 'N/A',
                        action: 'move_borrower_appointment'
                      });
                    }
                  }
                }
              }
            }
          } else {
            // Borrower not found - skip (don't create new borrowers)
            console.log(`⏭️ Borrower not found for phone ${cleanExcelPhone} - skipping (no new borrower creation)`);
            
            results.push({
              appointmentId: 'N/A',
              leadId: 'N/A',
              leadName: fullName,
              oldAppointmentStatus: 'N/A',
              newAppointmentStatus: 'N/A',
              oldLeadStatus: 'N/A',
              newLeadStatus: 'N/A',
              reason: 'Borrower not found - no new borrower creation allowed',
              appointmentTime: 'N/A',
              timeDiffHours: 'N/A',
              action: 'skip_borrower_not_found'
            });
          }
        }
        } catch (error) {
        console.error(`❌ Error processing row ${row.row_number}:`, error);
          results.push({
          appointmentId: 'N/A',
          leadId: 'N/A',
          leadName: row["col_Full Name"]?.toString() || 'Unknown',
          oldAppointmentStatus: 'N/A',
          newAppointmentStatus: 'N/A',
          oldLeadStatus: 'N/A',
          newLeadStatus: 'N/A',
          reason: `Error: ${(error as Error).message}`,
          appointmentTime: 'N/A',
          timeDiffHours: 'N/A',
          action: 'error',
            error: (error as Error).message
          });
        }
    }

    console.log(`📊 Real-time processing completed:`);
    console.log(`   Excel rows processed: ${processedCount}`);
    console.log(`   Appointments updated: ${updatedCount}`);
    console.log(`   Leads created: ${createdLeadsCount}`);
    console.log(`   Appointments created: ${createdAppointmentsCount}`);
    console.log(`   Appointments moved: ${movedAppointmentsCount}`);

    return NextResponse.json({
      success: true,
      message: `Real-time processing completed. Processed ${processedCount} Excel rows.`,
      mode: processingMode,
      processed: processedCount,
      updated: updatedCount,
      created: {
        leads: createdLeadsCount,
        appointments: createdAppointmentsCount
      },
      moved: movedAppointmentsCount,
      todaySingapore,
      thresholdHours,
      results,
      authentication: {
        authenticated: isAuthenticated,
        userId: authenticatedUserId,
        apiKeyProvided: !!apiKey
      },
      summary: {
        mode: processingMode,
        excelDataProvided: true,
        excelRowsProcessed: processedCount,
        appointmentStatusUpdates: updatedCount,
        leadsCreated: createdLeadsCount,
        appointmentsCreated: createdAppointmentsCount,
        appointmentsMoved: movedAppointmentsCount,
        errorCount: results.filter(r => r.error).length,
        authenticatedUser: authenticatedUserId,
        isAuthenticated: isAuthenticated
      }
    });

  } catch (error) {
    console.error("❌ Error in appointment status update:", error);
    return NextResponse.json(
      { 
        error: "Failed to process appointment status updates",
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/manual trigger
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const thresholdHours = parseFloat(searchParams.get('thresholdHours') ?? '3');
    const mode = (searchParams.get('mode') as ProcessingMode) ?? 'realtime';
    const apiKey = searchParams.get('api_key');
    const agentUserId = searchParams.get('agent_user_id');

    console.log(`🔄 Manual trigger: Processing appointments in ${mode} mode`);

    // Validate API key for GET requests too
    const envApiKey = process.env.API_KEY;
    if (apiKey && envApiKey && apiKey !== envApiKey) {
      return NextResponse.json({
        error: "Invalid API key",
        message: "The provided API key is not valid"
      }, { status: 401 });
    }

    // Call the POST method 
    const response = await POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ 
        thresholdHours,
        mode,
        api_key: apiKey,
        agent_user_id: agentUserId,
        excelData: mode === 'realtime' ? { rows: [], spreadsheet_id: 'manual', spreadsheet_name: 'Manual Test', sheet: 'Test' } : undefined
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    }));

    return response;

  } catch (error) {
    console.error("❌ Error in manual appointment status update:", error);
    return NextResponse.json(
      { 
        error: "Failed to process manual appointment status updates",
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
} 