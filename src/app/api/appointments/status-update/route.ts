/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { appointments, leads, borrower_appointments, borrowers, timeslots, appointment_timeslots, borrower_appointment_timeslots } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, gte, lte, isNull, desc, asc, or, not } from "drizzle-orm";
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

// Helper function to find lead by phone number (check phone_number, phone_number_2, phone_number_3)
async function findLeadByPhone(phoneNumber: string) {
  const cleanPhone = phoneNumber.replace(/^\+65/, '').replace(/\D/g, '');
  const formattedPhone = `+65${cleanPhone}`;
  
  const foundLeads = await db
    .select()
    .from(leads)
    .where(
      and(
        not(eq(leads.status, 'unqualified')),
        or(
          eq(leads.phone_number, formattedPhone),
          eq(leads.phone_number_2, formattedPhone),
          eq(leads.phone_number_3, formattedPhone)
        )
      )
    )
  
  if (foundLeads.length > 1) {
    console.log(`❌ [MULTIPLE LEADS] Found ${foundLeads.length} leads for ${formattedPhone}: ${foundLeads.map(l => `ID:${l.id}(${l.full_name})`).join(', ')}`);
    throw new Error(`Multiple leads found for phone ${formattedPhone}. Found ${foundLeads.length} leads: ${foundLeads.map(l => `ID:${l.id}(${l.full_name})`).join(', ')}`);
  }
  
  if (foundLeads.length === 1) {
    const lead = foundLeads[0];
    let matchField = 'PRIMARY';
    if (lead?.phone_number_2 === formattedPhone) matchField = 'SECONDARY';
    else if (lead?.phone_number_3 === formattedPhone) matchField = 'TERTIARY';
    
    console.log(`✅ [PHONE SEARCH] Found lead ID:${lead?.id} (${lead?.full_name}) via ${matchField} phone | Phones: P:${lead?.phone_number} S:${lead?.phone_number_2} T:${lead?.phone_number_3}`);
    return lead;
  } else {
    console.log(`❌ [PHONE SEARCH] No lead found for: ${formattedPhone}`);
    return null;
  }
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
    .where(eq(borrowers.phone_number, `${cleanPhone}`))
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
    const oldTimeslot = await tx
      .select()
      .from(timeslots)
      .where(eq(timeslots.id, oldTimeslotId ?? 0))
      .limit(1);

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
          occupied_count: Math.max(0, (oldTimeslot[0]?.occupied_count ?? 0) - 1),
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
    let authenticatedUserId = process.env.AGENT_USER_ID ?? 'system-update'; // Default fallback
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

    // Ensure we always have a valid user ID
    const safeUserId = authenticatedUserId ?? 'system-update';

    // Get today's date in Singapore timezone (UTC+8)
    const now = new Date();
    const singaporeOffset = 8 * 60; // 8 hours in minutes
    const singaporeTime = new Date(now.getTime() + (singaporeOffset * 60 * 1000));
    const todayParts = singaporeTime.toISOString().split('T');
    const todaySingapore = todayParts[0]; // YYYY-MM-DD format
    
    if (!todaySingapore) {
      throw new Error('Failed to get Singapore date');
    }

    console.log('📅 Today (Singapore):', todaySingapore);

    // Use authenticated user ID for updates
    const fallbackUserId = authenticatedUserId ?? 'system-update';

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

    // LIVE MODE: Process Excel data and live updates (removed end-of-day mode)
    console.log('⚡ Running live processing with Excel code updates...');

    if (!excelData?.rows || excelData.rows.length === 0) {
      return NextResponse.json({
        error: "No Excel data provided for live processing",
        help: "Live mode requires Excel data with 'New Loan - 新贷款' appointment information and codes (P, PRS, RS, R)"
      }, { status: 400 });
    }

    console.log(`📊 Total Excel rows received: ${excelData.rows.length}`);

    // Filter Excel data to only process today's appointments (avoid processing future appointments)
    const filteredRows = excelData.rows.filter(row => {
      try {
        // Parse the timestamp from Excel (which is in GMT+8)
        const timestampStr = row.col_Date;
        if (!timestampStr) return false;

        // Handle DD/MM/YY or DD/MM/YYYY format
        let excelDate: string;
        if (timestampStr.includes('/') || timestampStr.includes('-')) {
          const parts = timestampStr.split(/[\/-]/);
          if (parts.length !== 3) return false;

          const [day, month, yearTime] = parts;
          if (!day || !month || !yearTime) return false;

          const [yearPart] = yearTime.split(' ');
          if (!yearPart) return false;

          const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
          excelDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          return false; // Unsupported date format
        }

        // Only process today's appointments 
        return excelDate === todaySingapore;
      } catch (error) {
        console.error(`❌ Error parsing date for row ${row.row_number}:`, error);
        return false; // Skip rows with invalid dates
      }
    });

    // Count how many are "New Loan - 新贷款" vs other types
    const newLoanRows = filteredRows.filter(row => row["col_New or Reloan? "]?.toString().trim() === "New Loan - 新贷款");
    const otherLoanRows = filteredRows.filter(row => row["col_New or Reloan? "]?.toString().trim() !== "New Loan - 新贷款");
    
    // Sort rows to prioritize UW-filled rows (attendance confirmed) over empty ones
    // This prevents duplicate phone numbers from flipping between statuses
    const sortedFilteredRows = filteredRows.sort((a, b) => {
      const aHasUW = !!(a.col_UW?.toString().trim());
      const bHasUW = !!(b.col_UW?.toString().trim());
      
      // UW-filled rows come first (true > false)
      if (aHasUW !== bHasUW) {
        return bHasUW ? 1 : -1;
      }
      return 0;
    });

    // Track processed phone numbers to prevent duplicate processing
    const processedPhoneNumbers = new Set<string>();
    
    console.log(`📅 Filtered: ${sortedFilteredRows.length} today's rows (${todaySingapore}) | New Loans:${newLoanRows.length} Other:${otherLoanRows.length} Future skipped:${excelData.rows.length - sortedFilteredRows.length}`);

    // Process each filtered Excel row (only today's appointments)
    for (const row of sortedFilteredRows) {
        processedCount++;
        
      try {
        // Since we already filtered for today's appointments, we know this is today
        const excelDate = todaySingapore;
        const isExcelToday = true;
        const targetAppointmentDate = todaySingapore;

        // Clean and format the phone number from Excel
        const cleanExcelPhone = row["col_Mobile Number"]?.toString().replace(/\D/g, '');
        if (!cleanExcelPhone) {
          console.log(`⚠️ No phone number found in row ${row.row_number}`);
          continue;
        }

        const formattedPhone = `+65${cleanExcelPhone}`;
        const fullName = row["col_Full Name"]?.toString().trim() || '';
        const loanType = row["col_New or Reloan? "]?.toString().trim() || '';

        // Check if we've already processed this phone number to prevent duplicates
        if (processedPhoneNumbers.has(formattedPhone)) {
          console.log(`🔄 [DUPLICATE] Skipping row ${row.row_number} for ${fullName} (${formattedPhone}) - already processed`);
          continue;
        }

        // Mark this phone number as processed
        processedPhoneNumbers.add(formattedPhone);
        
        // Check if this is a new loan case for lead appointments (filter out other types)
        if (loanType !== "New Loan - 新贷款") {
          console.log(`⏭️ [SKIP ROW] Skipping non-new-loan case: "${loanType}" (row ${row.row_number})`);
          continue;
        }
        
        // Check if appointment turned up (UW field filled)
        const appointmentTurnedUp = checkAppointmentAttendance(row);
        
        // Find existing lead by phone number with validation
        console.log(`\n🔍 [ROW ${row.row_number}] ${fullName} (${formattedPhone}) NEW LOAN | UW:"${row.col_UW}" Code:"${row.col_Code}" Attended:${appointmentTurnedUp}`);
        
        let existingLead;
        try {
          existingLead = await findLeadByPhone(formattedPhone);
        } catch (leadError) {
          console.error(`❌ Lead validation failed for ${fullName} (${formattedPhone}):`, leadError);
          results.push({
            appointmentId: 'validation_failed',
            leadId: 'validation_failed',
            leadName: fullName,
            oldAppointmentStatus: 'N/A',
            newAppointmentStatus: 'N/A',
            oldLeadStatus: 'N/A',
            newLeadStatus: 'N/A',
            reason: `Lead validation failed: ${(leadError as Error).message}`,
            appointmentTime: 'N/A',
            timeDiffHours: 'N/A',
            action: 'validation_error',
            error: (leadError as Error).message
          });
          continue; // Skip this record and continue with next
        }
        
        if (!existingLead) {
          // Case A: Lead doesn't exist - BUT only create if UW field is filled (attended)
          if (!appointmentTurnedUp) {
            console.log(`⏭️ Skipping new lead creation for ${fullName} - UW field not filled (no attendance)`);
            results.push({
              appointmentId: 'skipped',
              leadId: 'skipped',
              leadName: fullName,
              oldAppointmentStatus: 'none',
              newAppointmentStatus: 'none',
              oldLeadStatus: 'none',
              newLeadStatus: 'none',
              reason: 'Live: Skipped - UW field not filled (no attendance recorded)',
              appointmentTime: 'N/A',
              timeDiffHours: 'N/A',
              action: 'skip_no_attendance'
            });
            continue;
          }
          
          console.log(`🆕 Creating new lead for phone ${cleanExcelPhone} - UW field filled (attended)`);
          
          const createLeadResult = await createLead({
            phone_number: formattedPhone,
            full_name: fullName,
            source: 'SEO',
            status: 'new',
            lead_type: 'new', // Always 'new' since we only process "New Loan - 新贷款"
            amount: row["col_Loan Amount Applying?"]?.toString() || '',
            email: row["col_Email Address"]?.toString() || '',
            employment_status: row["col_Employment Type"]?.toString() || '',
            loan_purpose: row["col_What is the purpose of the Loan?"]?.toString() || '',
                          created_by: safeUserId,
              updated_by: safeUserId,
            bypassEligibility: false // Check eligibility for new leads
          });

          if (createLeadResult.success && createLeadResult.lead) {
            createdLeadsCount++;
            
            // Create appointment for today
            const nearestTimeslot = await findNearestTimeslot(todaySingapore);
            console.log('🔄 Creating appointment for today');
            if (nearestTimeslot) {
              const appointmentResult = await createAppointment({
                leadId: createLeadResult.lead.id,
                timeslotId: nearestTimeslot.id,
                notes: `Auto-created from Google Sheets - ${fullName} (Today: ${todaySingapore})`,
                isUrgent: false,
                overrideUserId: authenticatedUserId
              });

              if (appointmentResult.success && 'appointment' in appointmentResult && appointmentResult.appointment) {
                console.log('✅ Appointment created successfully:', appointmentResult.appointment.id);
                createdAppointmentsCount++;
                
                // Update appointment status based on attendance
                const appointmentStatus = appointmentTurnedUp ? 'done' : 'upcoming';
                const leadStatus = appointmentTurnedUp ? 'done' : 'booked';
                
                if (appointmentTurnedUp) {
                  await db.update(appointments)
                    .set({ 
                      status: appointmentStatus,
                      updated_by: safeUserId
                    })
                    .where(eq(appointments.id, appointmentResult.appointment.id));
                    
                  await updateLead(createLeadResult.lead.id, {
                    status: leadStatus,
                    updated_by: safeUserId
                  });
                }
                results.push({
                  appointmentId: appointmentResult.appointment.id.toString(),
                  leadId: createLeadResult.lead.id.toString(),
                  leadName: fullName,
                  oldAppointmentStatus: 'none',
                  newAppointmentStatus: appointmentTurnedUp ? 'done' : 'upcoming',
                  oldLeadStatus: 'none',
                  newLeadStatus: appointmentTurnedUp ? 'done' : 'booked',
                  reason: `New lead created and appointment scheduled for today${appointmentTurnedUp ? ' - Marked as attended' : ''}`,
                  appointmentTime: format(new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time), 'yyyy-MM-dd HH:mm'),
                  timeDiffHours: 'N/A',
                  action: 'create_lead_and_appointment'
                });
              } else {
                console.error('❌ Failed to create appointment for new lead:', appointmentResult);
                results.push({
                  appointmentId: 'failed',
                  leadId: createLeadResult.lead.id.toString(),
                  leadName: fullName,
                  oldAppointmentStatus: 'none',
                  newAppointmentStatus: 'failed',
                  oldLeadStatus: 'new',
                  newLeadStatus: 'new',
                  reason: `Failed to create appointment: ${appointmentResult.success === false ? 'Creation failed' : 'Unknown error'}`,
                  appointmentTime: 'N/A',
                  timeDiffHours: 'N/A',
                  action: 'create_appointment_failed',
                  error: appointmentResult.success === false ? 'Creation failed' : 'Unknown error'
                });
              }
            }
          }
        } else {
          // Lead exists - validate appointments with error handling
          let todayAppointments, anyUpcomingAppointments;
          
          try {
            // Check for NON-CANCELLED appointments today
            todayAppointments = await db
              .select()
              .from(appointments)
              .where(
                and(
                  eq(appointments.lead_id, existingLead.id),
                  not(eq(appointments.status, 'cancelled')),
                  gte(appointments.start_datetime, new Date(`${todaySingapore}T00:00:00.000Z`)),
                  lte(appointments.start_datetime, new Date(`${todaySingapore}T23:59:59.999Z`))
                )
              );

            // Validate single appointment constraint for today
            if (todayAppointments.length > 1) {
              console.log(`❌ [MULTIPLE APPOINTMENTS] Lead ${existingLead.id} has ${todayAppointments.length} non-cancelled appointments today: ${todayAppointments.map(a => `ID:${a.id}(${a.status})`).join(', ')}`);
              throw new Error(`Multiple non-cancelled appointments found for lead ${existingLead.id} today. Found ${todayAppointments.length} appointments: ${todayAppointments.map(a => `ID:${a.id}(${a.status})`).join(', ')}`);
            }

            // Also check for any upcoming appointments on other dates (upcoming status already excludes cancelled)
            anyUpcomingAppointments = await db
              .select()
              .from(appointments)
              .where(
                and(
                  eq(appointments.lead_id, existingLead.id),
                  eq(appointments.status, 'upcoming')
                )
              );

            // Validate single upcoming appointment constraint
            if (anyUpcomingAppointments.length > 1) {
              console.log(`❌ [MULTIPLE UPCOMING] Lead ${existingLead.id} has ${anyUpcomingAppointments.length} upcoming appointments: ${anyUpcomingAppointments.map(a => `ID:${a.id}(${format(new Date(a.start_datetime), 'MM-dd HH:mm')})`).join(', ')}`);
              throw new Error(`Multiple upcoming appointments found for lead ${existingLead.id}. Found ${anyUpcomingAppointments.length} appointments: ${anyUpcomingAppointments.map(a => `ID:${a.id}(${format(new Date(a.start_datetime), 'MM-dd HH:mm')})`).join(', ')}`);
            }
          } catch (appointmentError) {
            console.error(`❌ Appointment validation failed for lead ${existingLead.id} (${fullName}):`, appointmentError);
            results.push({
              appointmentId: 'validation_failed',
              leadId: existingLead.id.toString(),
              leadName: fullName,
              oldAppointmentStatus: 'N/A',
              newAppointmentStatus: 'N/A',
              oldLeadStatus: existingLead.status,
              newLeadStatus: existingLead.status,
              reason: `Appointment validation failed: ${(appointmentError as Error).message}`,
              appointmentTime: 'N/A',
              timeDiffHours: 'N/A',
              action: 'validation_error',
              error: (appointmentError as Error).message
            });
            continue; // Skip this record and continue with next
          }

          console.log(`📅 [APPOINTMENTS] Lead ${existingLead.id} (${existingLead.full_name}) | Today:${todayAppointments.length} Future:${anyUpcomingAppointments.length}`);

          if (todayAppointments.length === 0) {
            // No appointment for today
            if (anyUpcomingAppointments.length > 0) {
              // Case C: Has appointment on different date - BUT only move if UW field is filled (attended)
              const appointmentToMove = anyUpcomingAppointments[0];
              const futureDate = format(new Date(appointmentToMove!.start_datetime.getTime() + (8 * 60 * 60 * 1000)), 'MM-dd HH:mm');
              
              if (!appointmentTurnedUp) {
                console.log(`⏭️ [SKIP MOVE] Lead ${existingLead.id} has ${anyUpcomingAppointments.length} future appts (${futureDate}) but UW not filled - skipping move`);
                results.push({
                  appointmentId: 'skipped',
                  leadId: existingLead.id.toString(),
                  leadName: fullName,
                  oldAppointmentStatus: 'none',
                  newAppointmentStatus: 'none',
                  oldLeadStatus: existingLead.status,
                  newLeadStatus: existingLead.status,
                  reason: 'Live: Skipped appointment move - UW field not filled (no attendance recorded)',
                  appointmentTime: 'N/A',
                  timeDiffHours: 'N/A',
                  action: 'skip_move_no_attendance'
                });
                continue;
              }
              
              if (appointmentToMove) {
                console.log(`🚀 [MOVE] Appt ${appointmentToMove.id} from ${futureDate} to today - UW filled`);
                
                const nearestTimeslot = await findNearestTimeslot(todaySingapore);
                if (nearestTimeslot) {
                  const moveResult = await moveAppointmentToTimeslot(
                    appointmentToMove.id, 
                    nearestTimeslot.id, 
                    authenticatedUserId
                  );

                  if (moveResult.success) {
                    movedAppointmentsCount++;
                    
                    // Update status based on attendance
                    const appointmentStatus = appointmentTurnedUp ? 'done' : 'upcoming';
                    const leadStatus = appointmentTurnedUp ? 'done' : 'booked';
                    
                    if (appointmentTurnedUp) {
                      await db.update(appointments)
                        .set({ 
                          status: appointmentStatus,
                          updated_by: authenticatedUserId
                        })
                        .where(eq(appointments.id, appointmentToMove.id));
                        
                      await updateLead(existingLead.id, {
                        status: leadStatus,
                        updated_by: authenticatedUserId
                      });
                    }

                    console.log(`✅ [MOVED] Appt ${appointmentToMove.id} → timeslot ${nearestTimeslot.id} (${nearestTimeslot.start_time}) | Status: ${appointmentStatus}`);

                    results.push({
                      appointmentId: appointmentToMove.id.toString(),
                      leadId: existingLead.id.toString(),
                      leadName: fullName,
                      oldAppointmentStatus: appointmentToMove.status,
                      newAppointmentStatus: appointmentStatus,
                      oldLeadStatus: existingLead.status,
                      newLeadStatus: leadStatus,
                      reason: `Appointment moved from ${format(new Date(appointmentToMove.start_datetime), 'yyyy-MM-dd')} to today${appointmentTurnedUp ? ' and marked as attended' : ''}`,
                      appointmentTime: format(new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time), 'yyyy-MM-dd HH:mm'),
                      timeDiffHours: 'N/A',
                      action: 'move_appointment'
                    });
                  } else {
                    console.error(`❌ [MOVE FAILED] Appt ${appointmentToMove.id}: ${JSON.stringify(moveResult)}`);
                  }
                } else {
                  console.error(`❌ [NO TIMESLOT] No available timeslot for ${todaySingapore}`);
                }
              }
            } else {
              // Case B: Lead exists but no appointment at all - BUT only create if UW field is filled (attended)
              if (!appointmentTurnedUp) {
                console.log(`⏭️ [SKIP CREATE] Lead ${existingLead.id} has no appointments but UW not filled - skipping creation`);
                results.push({
                  appointmentId: 'skipped',
                  leadId: existingLead.id.toString(),
                  leadName: fullName,
                  oldAppointmentStatus: 'none',
                  newAppointmentStatus: 'none',
                  oldLeadStatus: existingLead.status,
                  newLeadStatus: existingLead.status,
                  reason: 'Live: Skipped appointment creation - UW field not filled (no attendance recorded)',
                  appointmentTime: 'N/A',
                  timeDiffHours: 'N/A',
                  action: 'skip_create_no_attendance'
                });
                continue;
              }
              
              console.log(`🚀 [CREATE] Lead ${existingLead.id} has no appointments - creating today (UW filled)`);
              
              const nearestTimeslot = await findNearestTimeslot(todaySingapore);
              if (nearestTimeslot) {
                const appointmentResult = await createAppointment({
                  leadId: existingLead.id,
                  timeslotId: nearestTimeslot.id,
                  notes: `Auto-created from Google Sheets for existing lead - ${fullName} (Today: ${todaySingapore})`,
                  isUrgent: false,
                  overrideUserId: safeUserId
                });

                if (appointmentResult.success && 'appointment' in appointmentResult && appointmentResult.appointment) {
                  console.log('✅ Appointment created for existing lead:', appointmentResult.appointment.id);
                  createdAppointmentsCount++;
                  
                  // Update appointment status based on attendance
                  const appointmentStatus = appointmentTurnedUp ? 'done' : 'upcoming';
                  const leadStatus = appointmentTurnedUp ? 'done' : 'booked';
                  
                  if (appointmentTurnedUp) {
                    await db.update(appointments)
                      .set({ 
                        status: appointmentStatus,
                        updated_by: safeUserId
                      })
                      .where(eq(appointments.id, appointmentResult.appointment.id));
                      
                    await updateLead(existingLead.id, {
                      status: leadStatus,
                      updated_by: safeUserId
                    });
                  }
                  results.push({
                    appointmentId: appointmentResult.appointment.id.toString(),
                    leadId: existingLead.id.toString(),
                    leadName: fullName,
                    oldAppointmentStatus: 'none',
                    newAppointmentStatus: appointmentTurnedUp ? 'done' : 'upcoming',
                    oldLeadStatus: existingLead.status,
                    newLeadStatus: appointmentTurnedUp ? 'done' : 'booked',
                    reason: `Appointment created for existing lead today${appointmentTurnedUp ? ' - Marked as attended' : ''}`,
                    appointmentTime: format(new Date(nearestTimeslot.date + 'T' + nearestTimeslot.start_time), 'yyyy-MM-dd HH:mm'),
                    timeDiffHours: 'N/A',
                    action: 'create_appointment'
                  });
                } else {
                  console.error('❌ Failed to create appointment for existing lead:', appointmentResult);
                  results.push({
                    appointmentId: 'failed',
                    leadId: existingLead.id.toString(),
                    leadName: fullName,
                    oldAppointmentStatus: 'none',
                    newAppointmentStatus: 'failed',
                    oldLeadStatus: existingLead.status,
                    newLeadStatus: existingLead.status,
                                          reason: `Failed to create appointment: ${appointmentResult.success === false ? 'Creation failed' : 'Unknown error'}`,
                      appointmentTime: 'N/A',
                      timeDiffHours: 'N/A',
                      action: 'create_appointment_failed',
                      error: appointmentResult.success === false ? 'Creation failed' : 'Unknown error'
                  });
                }
              }
            }
          } else {
            // Case D: Lead has appointment today - LIVE update with Excel codes when UW filled
            const todayAppointment = todayAppointments[0];
            
            if (todayAppointment) {
              const apptTime = format(new Date(todayAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)), 'HH:mm');
              console.log(`📋 [TODAY APPT] ${todayAppointment.id} at ${apptTime} | Status:${todayAppointment.status} | UW:"${row.col_UW}" Code:"${row.col_Code}" Attended:${appointmentTurnedUp}`);
              
              const code = row.col_Code?.trim().toUpperCase();
              let newAppointmentStatus = todayAppointment.status;
              let newLeadStatus = existingLead.status;
              let newLoanStatus = existingLead.loan_status;
              let newLoanNotes = existingLead.loan_notes;
              let newEligibilityNotes = existingLead.eligibility_notes;
              
              // Appointment fields to update
              let newAppointmentNotes = todayAppointment.notes;
              let newAppointmentLoanStatus = todayAppointment.loan_status;
              let newAppointmentLoanNotes = todayAppointment.loan_notes;
              let updateReason = '';

              if (appointmentTurnedUp) {
                // UW field filled - process Excel codes LIVE
                if (code) {
                  switch (code) {
                    case 'P':
                      newAppointmentStatus = 'done';
                      newLeadStatus = 'done';
                      newLoanStatus = 'P';
                      newLoanNotes = 'P - Done';
                      newEligibilityNotes = 'Loan Disbursed';
                      
                      // Update appointment fields
                      newAppointmentNotes = `${todayAppointment.notes ? todayAppointment.notes + ' | ' : ''}Live: P - Completed`;
                      newAppointmentLoanStatus = 'P';
                      newAppointmentLoanNotes = 'P - Done';
                      
                      updateReason = 'Live: P (Completed) - UW field filled';
                      break;
                    case 'PRS':
                      newAppointmentStatus = 'done';
                      newLeadStatus = 'done';
                      newLoanStatus = 'PRS';
                      newLoanNotes = 'PRS - Customer Rejected';
                      newEligibilityNotes = 'Loan approved but customer rejected';
                      
                      // Update appointment fields
                      newAppointmentNotes = `${todayAppointment.notes ? todayAppointment.notes + ' | ' : ''}Live: PRS - Customer Rejected`;
                      newAppointmentLoanStatus = 'PRS';
                      newAppointmentLoanNotes = 'PRS - Customer Rejected';
                      
                      updateReason = 'Live: PRS (Customer Rejected) - UW field filled';
                      break;
                    case 'RS':
                      newAppointmentStatus = 'done';
                      newLeadStatus = 'missed/RS';
                      newLoanStatus = 'RS';
                      
                      // Get RS type and details
                      const rsType = row.col_RS?.toString().trim();
                      const rsDetails = row["col_RS -Detailed"]?.toString().trim();
                      
                      newLoanNotes = `RS${rsType ? ` - ${rsType}` : ''}`;
                      newEligibilityNotes = `Failed eligibility${rsType ? ` - ${rsType}` : ''}${rsDetails ? ` - ${rsDetails}` : ''}`;
                      
                      // Update appointment fields
                      newAppointmentNotes = `${todayAppointment.notes ? todayAppointment.notes + ' | ' : ''}Live: RS - Rejected by System${rsType ? ` - ${rsType}` : ''}${rsDetails ? ` - ${rsDetails}` : ''}`;
                      newAppointmentLoanStatus = 'RS';
                      newAppointmentLoanNotes = `RS${rsType ? ` - ${rsType}` : ''}`;
                      
                      updateReason = `Live: RS (Rejected by System)${rsType ? ` - Type: ${rsType}` : ''}${rsDetails ? ` - Details: ${rsDetails}` : ''} - UW field filled`;
                      break;
                    case 'R':
                      newAppointmentStatus = 'done';
                      newLeadStatus = 'done';
                      newLoanStatus = 'R';
                      newLoanNotes = 'R - Rejected';
                      newEligibilityNotes = 'Rejected';
                      
                      // Update appointment fields
                      newAppointmentNotes = `${todayAppointment.notes ? todayAppointment.notes + ' | ' : ''}Live: R - Rejected`;
                      newAppointmentLoanStatus = 'R';
                      newAppointmentLoanNotes = 'R - Rejected';
                      
                      updateReason = 'Live: R (Rejected) - UW field filled';
                      break;
                    default:
                      // No valid code, just mark as attended
                      newAppointmentStatus = 'done';
                      newLeadStatus = 'done';
                      updateReason = 'Live: Marked as attended (UW field filled) - No valid code';
                      break;
                  }
                } else {
                  // No code, just mark as attended
                  newAppointmentStatus = 'done';
                  newLeadStatus = 'done';
                  updateReason = 'Live: Marked as attended (UW field filled) - No code provided';
                }
              } else {
                // Not attended - check if appointment should be marked as missed based on time threshold
                const appointmentTimeSGT = new Date(todayAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000));
                const timeDiffMs = singaporeTime.getTime() - appointmentTimeSGT.getTime();
                const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

                if (timeDiffHours >= thresholdHours) {
                  newAppointmentStatus = 'missed';
                  newLeadStatus = 'missed/RS';
                  updateReason = `Time threshold exceeded (${timeDiffHours.toFixed(2)}h late) - No attendance`;
                  console.log(`⏰ [MISSED] ${timeDiffHours.toFixed(2)}h late > ${thresholdHours}h threshold${code ? ` | Code:${code} (ignored - no UW)` : ''}`);
                } else {
                  // Still within threshold, keep as upcoming
                  updateReason = `No attendance recorded yet (${timeDiffHours.toFixed(2)}h since appointment)`;
                  console.log(`⏰ [UPCOMING] ${timeDiffHours.toFixed(2)}h since appt < ${thresholdHours}h threshold${code ? ` | Code:${code} (ignored - no UW)` : ''}`);
                }
              }

              // Apply updates if status changed or new fields need updating
              const hasLeadChanges = newLeadStatus !== existingLead.status || 
                                    newLoanStatus !== existingLead.loan_status || 
                                    newLoanNotes !== existingLead.loan_notes || 
                                    newEligibilityNotes !== existingLead.eligibility_notes;

              const hasAppointmentChanges = newAppointmentStatus !== todayAppointment.status ||
                                          newAppointmentNotes !== todayAppointment.notes ||
                                          newAppointmentLoanStatus !== todayAppointment.loan_status ||
                                          newAppointmentLoanNotes !== todayAppointment.loan_notes;

              if (hasLeadChanges || hasAppointmentChanges) {
                // Update lead
                if (hasLeadChanges) {
                  await updateLead(existingLead.id, {
                    status: newLeadStatus,
                    loan_status: newLoanStatus,
                    loan_notes: newLoanNotes,
                    eligibility_notes: newEligibilityNotes,
                    updated_by: authenticatedUserId
                  });
                }

                // Update appointment
                if (hasAppointmentChanges) {
                await db.update(appointments)
                  .set({ 
                    status: newAppointmentStatus,
                      notes: newAppointmentNotes,
                      loan_status: newAppointmentLoanStatus,
                      loan_notes: newAppointmentLoanNotes,
                      updated_at: new Date(),
                    updated_by: authenticatedUserId
                  })
                  .where(eq(appointments.id, todayAppointment.id));
                }
                  
                console.log(`✅ [UPDATED] Lead:${existingLead.status}→${newLeadStatus} Appt:${todayAppointment.status}→${newAppointmentStatus} | Loan:${newLoanStatus ?? 'none'}`);

                results.push({
                  appointmentId: todayAppointment.id.toString(),
                  leadId: existingLead.id.toString(),
                  leadName: fullName,
                  oldAppointmentStatus: todayAppointment.status,
                  newAppointmentStatus: newAppointmentStatus,
                  oldLeadStatus: existingLead.status,
                  newLeadStatus: newLeadStatus,
                  reason: updateReason,
                  appointmentTime: format(new Date(todayAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)), 'yyyy-MM-dd HH:mm'),
                  timeDiffHours: appointmentTurnedUp ? 'N/A' : `${((singaporeTime.getTime() - new Date(todayAppointment.start_datetime.getTime() + (8 * 60 * 60 * 1000)).getTime()) / (1000 * 60 * 60)).toFixed(2)}`,
                  action: 'update_existing_appointment_live'
                });

                updatedCount++;
              } else {
                console.log(`⏭️ [NO CHANGE] Lead ${existingLead.id} | Lead:${existingLead.status} Appt:${todayAppointment.status} (no updates needed)`);
              }
            }
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

    // BORROWER APPOINTMENTS: Use the exact old processing logic from test.ts (proven working)
    const upcomingBorrowerAppointments = await db
      .select({
        appointment: borrower_appointments,
        borrower: borrowers
      })
              .from(borrower_appointments)
      .leftJoin(borrowers, eq(borrower_appointments.borrower_id, borrowers.id))
              .where(
                and(
          eq(borrower_appointments.status, 'upcoming'),
                  gte(borrower_appointments.start_datetime, new Date(`${todaySingapore}T00:00:00.000Z`)),
                  lte(borrower_appointments.start_datetime, new Date(`${todaySingapore}T23:59:59.999Z`))
                )
              );

    console.log(`🏦 [BORROWERS] Processing ${upcomingBorrowerAppointments.length} upcoming borrower appointments | Using old logic for "Re Loan - 再贷款" rows`);

    // Track processed borrower appointment IDs to avoid duplicates (OLD LOGIC)
    const processedBorrowerAppointmentIds = new Set<number>();

    // Process Excel rows for borrower appointments (Re Loan - 再贷款) - EXACT OLD LOGIC FROM TEST.TS
    if (excelData?.rows) {
      for (const row of excelData.rows) {
        processedCount++;
        
        // Check if this is a reloan case for borrower appointments
        if (row["col_New or Reloan? "]?.trim() !== "Re Loan - 再贷款") {
          continue;
        }

        // Parse the timestamp from Excel (which is in GMT+8) - EXACT OLD LOGIC
        let excelDate: string;
        try {
          const timestampStr = row.col_Date;
          if (!timestampStr) {
            throw new Error('Empty timestamp');
          }

          // Handle DD/MM/YY or DD/MM/YYYY format
          if (timestampStr.includes('/') || timestampStr.includes('-')) {
            // Split by either / or -
            const parts = timestampStr.split(/[\/-]/);
            if (parts.length !== 3) {
              throw new Error('Invalid date format: expected DD/MM/YY or DD/MM/YYYY');
            }

            const [day, month, yearTime] = parts;
            if (!day || !month || !yearTime) {
              throw new Error('Invalid date format: missing day, month, or year');
            }

            // Split year and time if present
            const [yearPart] = yearTime.split(' ');
            if (!yearPart) {
              throw new Error('Invalid date format: missing year');
            }

            // Handle both 2-digit and 4-digit years
            const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;

            // Create YYYY-MM-DD format for comparison
            excelDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            // console.log(`📅 Parsed borrower appointment date: ${timestampStr} → ${excelDate}`);
            } else {
            throw new Error('Unsupported date format');
          }
        } catch (error) {
          console.error(`❌ Error parsing timestamp for borrower row ${row.row_number}:`, error);
          console.error(`📝 Raw timestamp value: "${row.col_Date}"`);
          continue;
        }

        // Only process if the Excel row is from today
        if (excelDate !== todaySingapore) {
          // console.log(`⏭️ Skipping borrower row ${row.row_number} - not from today (${excelDate} vs ${todaySingapore})`);
          continue;
        }

        // Clean and format the phone number from Excel
        const cleanExcelPhone = row["col_Mobile Number"]?.toString().replace(/\D/g, '');
        if (!cleanExcelPhone) {
          console.log(`⚠️ No phone number found in borrower row ${row.row_number}`);
          continue;
        }

        // Find matching borrower appointment - EXACT OLD LOGIC
        const matchingBorrowerAppointment = upcomingBorrowerAppointments.find(record => {
          const borrowerPhone = record.borrower?.phone_number?.replace(/^\+65/, '').replace(/\D/g, '');
          return borrowerPhone === cleanExcelPhone;
        });

        if (!matchingBorrowerAppointment) {
          continue;
        }

        const { appointment: borrowerAppointment, borrower } = matchingBorrowerAppointment;
        
        if (!borrower) {
          console.warn(`⚠️ No borrower found for appointment ${borrowerAppointment.id}`);
          continue;
        }

        // Update borrower appointment status based on code - EXACT OLD LOGIC
        const code = row.col_Code?.trim().toUpperCase();
        let newAppointmentStatus = 'upcoming';
        let newBorrowerStatus = borrower.status;
        let newBorrowerLoanStatus = borrower.loan_status;
        let newBorrowerLoanNotes = borrower.loan_notes;
        let newAppointmentLoanStatus = borrowerAppointment.loan_status;
        let newAppointmentLoanNotes = borrowerAppointment.loan_notes;
                let updateReason = '';

        // Format eligibility notes based on code (for borrower) - EXACT OLD LOGIC
        let eligibilityNotes = '';
        let additionalBorrowerNotes = '';
        
        if (code === 'RS') {
          const rsDetailed = row["col_RS -Detailed"]?.trim() ?? '';
          const rsReason = row.col_RS?.trim() ?? '';
          eligibilityNotes = `RS - ${rsReason}`;
          
          // Add detailed reason to borrower notes if it has content
          if (rsDetailed) {
            additionalBorrowerNotes = `RS Details: ${rsDetailed}`;
          }
        } else if (code === 'R') {
          eligibilityNotes = 'R - Rejected';
        } else if (code === 'PRS') {
          eligibilityNotes = 'PRS - Customer Rejected';
        } else if (code === 'P') {
          eligibilityNotes = 'P - Done';
        }

        switch (code) {
          case 'P':
                  newAppointmentStatus = 'done';
            newBorrowerStatus = 'done';
            newBorrowerLoanStatus = 'P';
            newBorrowerLoanNotes = 'P - Done';
            newAppointmentLoanStatus = 'P';
            newAppointmentLoanNotes = 'P - Done';
            updateReason = 'Completed (P)';
            break;
          case 'PRS':
            newAppointmentStatus = 'done';
            newBorrowerStatus = 'done';
            newBorrowerLoanStatus = 'PRS';
            newBorrowerLoanNotes = 'PRS - Customer Rejected';
            newAppointmentLoanStatus = 'PRS';
            newAppointmentLoanNotes = 'PRS - Customer Rejected';
            updateReason = 'Customer Rejected (PRS)';
            break;
          case 'RS':
            newAppointmentStatus = 'done';
            newBorrowerStatus = 'missed/RS';
            newBorrowerLoanStatus = 'RS';
            newBorrowerLoanNotes = additionalBorrowerNotes ? `RS - Rejected. ${additionalBorrowerNotes}` : 'RS - Rejected';
            newAppointmentLoanStatus = 'RS';
            newAppointmentLoanNotes = additionalBorrowerNotes ? `RS - Rejected. ${additionalBorrowerNotes}` : 'RS - Rejected';
            updateReason = 'Rejected by System (RS)';
            break;
          case 'R':
            newAppointmentStatus = 'done';
            newBorrowerStatus = 'done';
            newBorrowerLoanStatus = 'R';
            newBorrowerLoanNotes = 'R - Rejected';
            newAppointmentLoanStatus = 'R';
            newAppointmentLoanNotes = 'R - Rejected';
            updateReason = 'Rejected (R)';
            
            // Call rejection webhook for R codes for borrowers too - EXACT OLD LOGIC
            try {
              const cleanPhoneNumber = borrower.phone_number?.replace(/^\+65/, '').replace(/[^\d]/g, '') ?? '';
              if (cleanPhoneNumber) {
                console.log(`📞 Calling borrower rejection webhook for ${cleanPhoneNumber}`);
                
                const rejectionWebhookUrl = process.env.WORKATO_SEND_REJECTION_WEBHOOK_URL;

                if(!rejectionWebhookUrl) {
                  console.error('❌ WORKATO_SEND_REJECTION_WEBHOOK_URL is not set');
                  break;
                }

                const webhookResponse = await fetch(rejectionWebhookUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    phone_number: cleanPhoneNumber,
                    borrower_id: borrower.id,
                    borrower_name: borrower.full_name,
                    appointment_id: borrowerAppointment.id,
                    code: code,
                    appointment_type: 'borrower',
                    timestamp: new Date().toISOString()
                  })
                });
                
                if (webhookResponse.ok) {
                  const webhookResult = await webhookResponse.json();
                  console.log(`✅ Borrower rejection webhook called successfully for ${cleanPhoneNumber}:`, webhookResult);
                  updateReason += ` + Webhook called`;
                } else {
                  console.error(`❌ Borrower rejection webhook failed for ${cleanPhoneNumber}:`, webhookResponse.status, webhookResponse.statusText);
                  updateReason += ` + Webhook failed`;
                }
              } else {
                console.warn(`⚠️ No valid phone number found for borrower rejection webhook (Borrower ID: ${borrower.id})`);
              }
            } catch (webhookError) {
              console.error(`❌ Error calling borrower rejection webhook:`, webhookError);
              updateReason += ` + Webhook error`;
            }
            break;
          default:
            console.log(`⚠️ Unknown code "${code}" for borrower appointment ${borrowerAppointment.id}`);
            continue;
        }

        // Update borrower appointment status - EXACT OLD LOGIC
        await db
          .update(borrower_appointments)
                    .set({ 
                      status: newAppointmentStatus,
            loan_status: newAppointmentLoanStatus,
            loan_notes: newAppointmentLoanNotes,
            updated_at: new Date(),
            // updated_by: fallbackUserId  // KEEP COMMENTED AS IN ORIGINAL
          })
          .where(eq(borrower_appointments.id, borrowerAppointment.id));

        // Update borrower status if it changed - EXACT OLD LOGIC
        await db
          .update(borrowers)
          .set({
            status: newBorrowerStatus,
            loan_status: newBorrowerLoanStatus,
            loan_notes: newBorrowerLoanNotes,
            updated_at: new Date(),
            // updated_by: fallbackUserId  // KEEP COMMENTED AS IN ORIGINAL
          })
          .where(eq(borrowers.id, borrower.id));

        console.log(`✅ [BORROWER] Appt ${borrowerAppointment.id} → ${newAppointmentStatus} | Borrower ${borrower.id} → ${newBorrowerStatus} | Code: ${code}`);

        // Add to results array - EXACT OLD LOGIC
        const appointmentTimeUTC = new Date(borrowerAppointment.start_datetime);
        const appointmentTimeSGT = new Date(appointmentTimeUTC.getTime() + (8 * 60 * 60 * 1000));

                  results.push({
          appointmentId: `B${borrowerAppointment.id}`, // Prefix with 'B' for borrower appointments
          leadId: `B${borrower.id}`, // Use borrower ID with 'B' prefix
          leadName: borrower.full_name ?? 'Unknown',
          oldAppointmentStatus: borrowerAppointment.status,
                    newAppointmentStatus: newAppointmentStatus,
          oldLeadStatus: borrower.status,
          newLeadStatus: newBorrowerStatus,
          reason: `Excel Code: ${code} - ${eligibilityNotes} (Borrower)${updateReason ? ' - ' + updateReason : ''}`,
          appointmentTime: format(appointmentTimeSGT, 'yyyy-MM-dd HH:mm'),
          timeDiffHours: 'N/A (Excel Update)',
          action: 'update_borrower_appointment_old_logic'
        });

        // Mark this borrower appointment as processed to avoid duplicate updates
        processedBorrowerAppointmentIds.add(borrowerAppointment.id);

                  updatedCount++;
                }

    // Then, check remaining borrower appointments for time threshold - EXACT OLD LOGIC
    // console.log(`🕐 Starting time threshold check for ${upcomingBorrowerAppointments.length} total borrower appointments (${processedBorrowerAppointmentIds.size} already processed by Excel)`);
    
    for (const record of upcomingBorrowerAppointments) {
      const borrowerAppointment = record.appointment;
      const borrower = record.borrower;
      
      if (!borrower) {
        console.warn(`⚠️ No borrower found for appointment ${borrowerAppointment.id}`);
        continue;
      }

      // Skip if this borrower appointment was already processed by Excel data
      if (processedBorrowerAppointmentIds.has(borrowerAppointment.id)) {
        // console.log(`⏭️ Skipping borrower appointment ${borrowerAppointment.id} - already processed by Excel data`);
        continue;
      }

      // Skip if borrower appointment status is no longer 'upcoming' (safety check)
      if (borrowerAppointment.status !== 'upcoming') {
        // console.log(`⏭️ Skipping borrower appointment ${borrowerAppointment.id} - status is ${borrowerAppointment.status}, not upcoming`);
        continue;
      }

      // Convert borrower appointment time to Singapore timezone for comparison
      const appointmentTimeUTC = new Date(borrowerAppointment.start_datetime);
      const appointmentTimeSGT = new Date(appointmentTimeUTC.getTime() + (8 * 60 * 60 * 1000));
      const currentTimeSGT = singaporeTime;

      // Calculate time difference in hours
      const timeDiffMs = currentTimeSGT.getTime() - appointmentTimeSGT.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      console.log(`🕐 Borrower Appointment ${borrowerAppointment.id}: ${format(appointmentTimeSGT, 'HH:mm')} | Current: ${format(currentTimeSGT, 'HH:mm')} | Diff: ${timeDiffHours.toFixed(2)}h`);

      // If borrower appointment is late by threshold hours, mark as missed
      if (timeDiffHours >= thresholdHours) {
        try {
          // Update borrower appointment status
          await db
            .update(borrower_appointments)
            .set({
              status: 'missed',
              updated_at: new Date(),
              // updated_by: fallbackUserId  // KEEP COMMENTED AS IN ORIGINAL
            })
            .where(eq(borrower_appointments.id, borrowerAppointment.id));

          // Update borrower status
          await db
            .update(borrowers)
            .set({
              status: 'missed/RS',
              updated_at: new Date(),
              // updated_by: fallbackUserId  // KEEP COMMENTED AS IN ORIGINAL
            })
            .where(eq(borrowers.id, borrower.id));

          // Add to results array
            results.push({
            appointmentId: `B${borrowerAppointment.id}`, // Prefix with 'B' for borrower appointments
            leadId: `B${borrower.id}`, // Use borrower ID with 'B' prefix
            leadName: borrower.full_name ?? 'Unknown',
            oldAppointmentStatus: borrowerAppointment.status,
            newAppointmentStatus: 'missed',
            oldLeadStatus: borrower.status,
            newLeadStatus: 'follow_up',  // EXACT AS ORIGINAL (follow_up not missed/RS)
            reason: `Time threshold exceeded (${timeDiffHours.toFixed(2)}h late, threshold: ${thresholdHours}h) - Borrower`,
            appointmentTime: format(appointmentTimeSGT, 'yyyy-MM-dd HH:mm'),
            timeDiffHours: timeDiffHours.toFixed(2),
            action: 'time_based_missed_borrower_old_logic'
          });

          updatedCount++;
          // console.log(`✅ Marked borrower appointment ${borrowerAppointment.id} as missed (${timeDiffHours.toFixed(2)}h late)`);
        } catch (error) {
          // console.error(`❌ Error updating borrower appointment ${borrowerAppointment.id}:`, error);
          
          // Add error to results array
          results.push({
            appointmentId: `B${borrowerAppointment.id}`,
            leadId: `B${borrower.id}`,
            leadName: borrower.full_name ?? 'Unknown',
            oldAppointmentStatus: borrowerAppointment.status,
            newAppointmentStatus: borrowerAppointment.status,
            oldLeadStatus: borrower.status,
            newLeadStatus: borrower.status,
            reason: `Failed to update: ${(error as Error).message} - Borrower`,
            appointmentTime: format(appointmentTimeSGT, 'yyyy-MM-dd HH:mm'),
            timeDiffHours: timeDiffHours.toFixed(2),
            action: 'borrower_error_old_logic',
            error: (error as Error).message
          });
        }
      } else {
        // console.log(`ℹ️ No update needed for borrower appointment ${borrowerAppointment.id}: Time diff ${timeDiffHours.toFixed(2)}h < ${thresholdHours}h`);
      }
    }

    // Removed old commented borrower logic since it's handled above in the new implementation

      console.log(`📊 Excel processing for borrower appointments completed: ${processedBorrowerAppointmentIds.size} borrower appointments updated from Excel data`);
    }

    console.log(`📊 COMPLETED | Total:${excelData.rows.length} Today:${sortedFilteredRows.length} NewLoans:${newLoanRows.length} Processed:${processedPhoneNumbers.size} | Updated:${updatedCount} Created:${createdLeadsCount}/${createdAppointmentsCount} Moved:${movedAppointmentsCount} Borrowers:${processedBorrowerAppointmentIds.size}`);

    return NextResponse.json({
      success: true,
      message: `Live processing completed. Processed ${processedPhoneNumbers.size} unique phone numbers from ${newLoanRows.length} 'New Loan' appointments with Excel codes (P, PRS, RS, R), skipped ${excelData.rows.length - sortedFilteredRows.length} future appointments and duplicates.`,
      mode: processingMode,
      totalReceived: excelData.rows.length,
      todayProcessed: sortedFilteredRows.length,
      uniquePhoneNumbersProcessed: processedPhoneNumbers.size,
      futureSkipped: excelData.rows.length - sortedFilteredRows.length,
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
        mode: 'live',
        description: 'Live processing with Excel codes (P, PRS, RS, R) - New Loan only',
        excelDataProvided: true,
        totalExcelRows: excelData.rows.length,
        todayRowsProcessed: sortedFilteredRows.length,
        uniquePhoneNumbersProcessed: processedPhoneNumbers.size,
        newLoanRowsProcessed: newLoanRows.length,
        futureRowsSkipped: excelData.rows.length - sortedFilteredRows.length,
        leadAppointmentStatusUpdates: results.filter(r => !r.appointmentId.startsWith('B') && !r.action.includes('skip')).length,
        borrowerAppointmentStatusUpdates: results.filter(r => r.appointmentId.startsWith('B') && r.action.includes('old_logic')).length,
        liveCodeUpdates: results.filter(r => r.action === 'update_existing_appointment_live').length,
        leadsCreated: createdLeadsCount,
        appointmentsCreated: createdAppointmentsCount,
        appointmentsMoved: movedAppointmentsCount,
        skippedActions: results.filter(r => r.action.includes('skip')).length,
        totalUpdated: updatedCount,
        errorCount: results.filter(r => r.error).length,
        authenticatedUser: authenticatedUserId,
        isAuthenticated: isAuthenticated
      }
    });

  } catch (error) {
    console.error("❌ Error in appointment status update:", error);
    return NextResponse.json(
      { 
        error: "Failed to process live appointment status updates with Excel codes",
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

    console.log(`🔄 Manual trigger: Processing appointments in live mode`);

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
        excelData: { rows: [], spreadsheet_id: 'manual', spreadsheet_name: 'Manual Test', sheet: 'Test' }
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
        error: "Failed to process manual appointment status updates in live mode",
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
} 