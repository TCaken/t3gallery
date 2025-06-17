/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { appointments, leads, timeslots } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, gte, lte, or, like, desc, sql } from "drizzle-orm";
import { format, addHours } from 'date-fns';
import { updateLead, createLead, addLeadNote } from "~/app/_actions/leadActions";
import { getCurrentSGT, getTodaySGT, convertUTCToSGT } from '~/lib/timezone';

// Types for Excel data structure (based on the provided JSON)
interface ExcelRow {
  row_number: number;
  col_Timestamp: string;
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

export async function POST(request: NextRequest) {
  try {
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    // }

    // Get request parameters - handle both JSON and form data from Workato
    let excelData: ExcelData | undefined;
    let thresholdHours = 2.5;
    let targetDate: string | undefined; // New parameter for flexible date input
    
    const contentType = request.headers.get('content-type') ?? '';
    console.log('📥 Content-Type:', contentType);
    
    if (contentType.includes('application/json')) {
      // Handle JSON format
      try {
        const body = await request.json() as { 
          excelData?: ExcelData; 
          thresholdHours?: number;
          targetDate?: string; // YYYY-MM-DD format
        };
        excelData = body.excelData;
        thresholdHours = body.thresholdHours ?? 2.5;
        targetDate = body.targetDate;
        console.log('📋 Parsed as JSON');
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
        console.log('📋 Parsing as form data...');
        
        // Log all form fields for debugging
        for (const [key, value] of formData.entries()) {
          console.log(`📝 Form field: ${key} = ${typeof value === 'string' ? value.substring(0, 100) + '...' : value}`);
        }
        
        // Try different possible field names that Workato might use
        let rowsData = null;
        
        // Check for 'rows' field
        const rowsField = formData.get('rows');
        if (rowsField && typeof rowsField === 'string') {
          console.log('🔍 Found "rows" field');
          rowsData = rowsField;
        }
        
        // Check for 'excelData' field
        const excelDataField = formData.get('excelData');
        if (excelDataField && typeof excelDataField === 'string') {
          console.log('🔍 Found "excelData" field');
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
          console.log('🔍 Checking for direct JSON data...');
          const bodyText = await request.text();
          console.log('📄 Raw body:', bodyText.substring(0, 200) + '...');
          
          try {
            // Try to parse the entire body as JSON
            const parsed = JSON.parse(bodyText);
            if (parsed.rows) {
              rowsData = JSON.stringify(parsed.rows);
            } else if (Array.isArray(parsed)) {
              rowsData = JSON.stringify(parsed);
            }
          } catch (e) {
            console.log('❌ Not direct JSON');
          }
        }
        
        if (rowsData) {
          console.log('📊 Rows data found, parsing...');
          const rows = JSON.parse(rowsData);
          
          excelData = {
            rows: Array.isArray(rows) ? rows : [rows],
            spreadsheet_id: (formData.get('spreadsheet_id') as string) ?? 'workato',
            spreadsheet_name: (formData.get('spreadsheet_name') as string) ?? 'Workato Import',
            sheet: (formData.get('sheet') as string) ?? 'Sheet1'
          };
          
          const thresholdParam = formData.get('thresholdHours');
          if (thresholdParam && typeof thresholdParam === 'string') {
            thresholdHours = parseFloat(thresholdParam) ?? 2.5;
          }

          // Get target date from form data
          const targetDateParam = formData.get('targetDate');
          if (targetDateParam && typeof targetDateParam === 'string') {
            targetDate = targetDateParam;
          }
          
          console.log('✅ Successfully parsed form data');
          console.log(`📊 Found ${excelData.rows.length} rows`);
        } else {
          console.log('❌ No rows data found in form');
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
            console.log('🔍 Trying URL parameters...');
            const decodedRows = decodeURIComponent(rowsParam);
            const rows = JSON.parse(decodedRows);
            excelData = {
              rows: Array.isArray(rows) ? rows : [rows],
              spreadsheet_id: url.searchParams.get('spreadsheet_id') ?? 'url-param',
              spreadsheet_name: url.searchParams.get('spreadsheet_name') ?? 'URL Parameters',
              sheet: url.searchParams.get('sheet') ?? 'Sheet1'
            };
            thresholdHours = parseFloat(url.searchParams.get('thresholdHours') ?? '2.5');
            targetDate = url.searchParams.get('targetDate') ?? undefined;
            console.log('✅ Successfully parsed URL parameters');
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

    console.log('🔄 Starting appointment status update process...');
    console.log('📊 Excel data provided:', !!excelData);
    console.log('⏰ Threshold hours:', thresholdHours);
    console.log('📅 Target date:', targetDate || 'current date');

    // Determine the target date - use provided date or current Singapore time
    let todaySingapore: string;
    let singaporeTime: Date;

    if (targetDate) {
      // Validate target date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(targetDate)) {
        return NextResponse.json({
          error: "Invalid target date format",
          details: "Expected format: YYYY-MM-DD (e.g., 2024-01-15)",
          received: targetDate
        }, { status: 400 });
      }
      
      todaySingapore = targetDate;
      // Create Singapore time for the target date at current time
      const now = new Date();
      const singaporeOffset = 8 * 60; // 8 hours in minutes
      singaporeTime = new Date(now.getTime() + (singaporeOffset * 60 * 1000));
      
      console.log('📅 Using provided target date:', todaySingapore);
    } else {
      // Use current Singapore time
      const now = new Date();
      const singaporeOffset = 8 * 60; // 8 hours in minutes
      singaporeTime = new Date(now.getTime() + (singaporeOffset * 60 * 1000));
      todaySingapore = singaporeTime.toISOString().split('T')[0]!; // YYYY-MM-DD format, non-null assertion safe here
      
      console.log('📅 Using current Singapore date:', todaySingapore);
    }

    console.log('📅 Processing date (Singapore):', todaySingapore);

    // Fetch all upcoming appointments for the target date
    const startOfDaySGT = new Date(`${todaySingapore}T00:00:00.000Z`);
    const endOfDaySGT = new Date(`${todaySingapore}T23:59:59.999Z`);
    
    // Convert to UTC for database query
    const startOfDayUTC = new Date(startOfDaySGT.getTime() - (8 * 60 * 60 * 1000));
    const endOfDayUTC = new Date(endOfDaySGT.getTime() - (8 * 60 * 60 * 1000));

    const upcomingAppointments = await db
      .select({
        appointment: appointments,
        lead: leads
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .where(
        and(
          eq(appointments.status, 'upcoming'),
          gte(appointments.start_datetime, startOfDayUTC),
          lte(appointments.start_datetime, endOfDayUTC)
        )
      );

    console.log(`📋 Found ${upcomingAppointments.length} upcoming appointments for ${todaySingapore}`);
    
    // Debug: List all found appointments
    upcomingAppointments.forEach(record => {
      const appt = record.appointment;
      const leadData = record.lead;
      const apptTimeSGT = new Date(appt.start_datetime.getTime() + (8 * 60 * 60 * 1000));
      console.log(`📅 Found appointment ${appt.id}: Lead "${leadData?.full_name}" (${leadData?.phone_number}), Time: ${format(apptTimeSGT, 'yyyy-MM-dd HH:mm')}, Status: ${appt.status}`);
    });

    // **PHASE 2: WALK-IN DETECTION LOGIC**
    const walkInLeads: Array<{
      excelRow: ExcelRow;
      cleanPhone: string;
      isNewLead: boolean;
      existingLeadId?: number;
    }> = [];

    if (excelData?.rows) {
      console.log('🚶‍♂️ Phase 2: Detecting walk-in leads...');
      
      for (const row of excelData.rows) {
        // Skip if not a new loan case
        if (row["col_New or Reloan? "]?.trim() !== "New Loan - 新贷款") {
          continue;
        }

        // Parse and validate the timestamp from Excel
        let excelDate: string;
        try {
          const timestampStr = row.col_Timestamp;
          if (!timestampStr) {
            console.log(`⚠️ Row ${row.row_number}: Empty timestamp, skipping`);
            continue;
          }

          // Handle DD/MM/YY or DD/MM/YYYY format
          if (timestampStr.includes('/') || timestampStr.includes('-')) {
            const parts = timestampStr.split(/[\/-]/);
            if (parts.length !== 3) {
              console.log(`⚠️ Row ${row.row_number}: Invalid date format: ${timestampStr}`);
              continue;
            }

            const [day, month, yearTime] = parts;
            if (!day || !month || !yearTime) {
              console.log(`⚠️ Row ${row.row_number}: Missing date components: ${timestampStr}`);
              continue;
            }

            const [yearPart] = yearTime.split(' ');
            if (!yearPart) {
              console.log(`⚠️ Row ${row.row_number}: Missing year: ${timestampStr}`);
              continue;
            }

            // Handle both 2-digit and 4-digit years
            const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
            excelDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else {
            console.log(`⚠️ Row ${row.row_number}: Unsupported date format: ${timestampStr}`);
            continue;
          }
        } catch (error) {
          console.error(`❌ Row ${row.row_number}: Error parsing timestamp:`, error);
          continue;
        }

        // Only process if the Excel row is from the target date
        if (excelDate !== todaySingapore) {
          console.log(`⏭️ Row ${row.row_number}: Not from target date (${excelDate} vs ${todaySingapore})`);
          continue;
        }

        // Clean and validate phone number
        const cleanExcelPhone = row["col_Mobile Number"]?.toString().replace(/\D/g, '');
        if (!cleanExcelPhone) {
          console.log(`⚠️ Row ${row.row_number}: No phone number found`);
          continue;
        }

        // Format phone number to Singapore format
        let formattedPhone: string;
        try {
          // Add +65 if not present
          if (cleanExcelPhone.startsWith('65')) {
            formattedPhone = `+${cleanExcelPhone}`;
          } else if (cleanExcelPhone.length === 8) {
            formattedPhone = `+65${cleanExcelPhone}`;
          } else {
            formattedPhone = `+65${cleanExcelPhone}`;
          }
          
          // Validate Singapore phone number format
          const sgPhoneRegex = /^\+65[896]\d{7}$/;
          if (!sgPhoneRegex.test(formattedPhone)) {
            console.log(`⚠️ Row ${row.row_number}: Invalid Singapore phone format: ${cleanExcelPhone}`);
            continue;
          }
        } catch (error) {
          console.log(`⚠️ Row ${row.row_number}: Error formatting phone: ${cleanExcelPhone}`);
          continue;
        }

        // Check if this lead has an appointment today
        const hasAppointmentToday = upcomingAppointments.some(record => {
          const leadPhone = record.lead?.phone_number?.replace(/\+65/g, '');
          return leadPhone === cleanExcelPhone;
        });

        if (hasAppointmentToday) {
          console.log(`✅ Row ${row.row_number}: Lead ${cleanExcelPhone} already has appointment today`);
          continue; // Skip - they already have an appointment
        }

        // Check if lead exists in database
        const existingLead = await db
          .select({ id: leads.id, phone_number: leads.phone_number, full_name: leads.full_name })
          .from(leads)
          .where(
            or(
              eq(leads.phone_number, formattedPhone),
              eq(leads.phone_number_2, formattedPhone),
              eq(leads.phone_number_3, formattedPhone)
            )
          )
          .limit(1);

        // Add to walk-in leads list
        walkInLeads.push({
          excelRow: row,
          cleanPhone: cleanExcelPhone,
          isNewLead: existingLead.length === 0,
          existingLeadId: existingLead.length > 0 ? existingLead[0]?.id : undefined
        });

        console.log(`🚶‍♂️ Walk-in detected: ${row["col_Full Name"]} (${cleanExcelPhone}) - ${existingLead.length === 0 ? 'New Lead' : `Existing Lead ID: ${existingLead[0]?.id}`}`);
      }

      console.log(`🚶‍♂️ Walk-in Detection Summary:`);
      console.log(`📊 Total walk-ins detected: ${walkInLeads.length}`);
      console.log(`🆕 New leads to create: ${walkInLeads.filter(w => w.isNewLead).length}`);
      console.log(`👤 Existing leads: ${walkInLeads.filter(w => !w.isNewLead).length}`);
    }

    // Use fallback userId for updates (since auth is commented out)
    const fallbackUserId = "system-update";

    if (upcomingAppointments.length === 0 && walkInLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No upcoming appointments or walk-ins found for the target date",
        processed: 0,
        updated: 0,
        walkInsDetected: 0,
        walkInsProcessed: 0,
        todaySingapore: todaySingapore
      });
    }

    // **PHASE 3: LEAD CREATION SYSTEM**
    let walkInsProcessed = 0;
    let walkInsCreated = 0;
    const walkInResults: Array<{
      excelRow: ExcelRow;
      leadId?: number;
      leadName: string;
      phone: string;
      status: 'created' | 'existing' | 'failed';
      reason?: string;
      error?: string;
    }> = [];

    if (walkInLeads.length > 0) {
      console.log('🏭 Phase 3: Creating leads for walk-ins...');
      
      // Import the createLead function
      const { createLead } = await import('~/app/_actions/leadActions');
      
      for (const walkIn of walkInLeads) {
        walkInsProcessed++;
        const row = walkIn.excelRow;
        
        console.log(`🏭 Processing walk-in ${walkInsProcessed}/${walkInLeads.length}: ${row["col_Full Name"]} (${walkIn.cleanPhone})`);
        
        if (!walkIn.isNewLead && walkIn.existingLeadId) {
          // Lead already exists - just record it
          walkInResults.push({
            excelRow: row,
            leadId: walkIn.existingLeadId,
            leadName: row["col_Full Name"] ?? 'Unknown',
            phone: walkIn.cleanPhone,
            status: 'existing',
            reason: `Lead already exists with ID: ${walkIn.existingLeadId}`
          });
          console.log(`👤 Using existing lead ID: ${walkIn.existingLeadId}`);
          continue;
        }
        
        // Create new lead - map Excel columns to lead fields
        try {
          // Format phone number
          let formattedPhone = walkIn.cleanPhone;
          if (formattedPhone.startsWith('65')) {
            formattedPhone = `+${formattedPhone}`;
          } else if (formattedPhone.length === 8) {
            formattedPhone = `+65${formattedPhone}`;
          } else {
            formattedPhone = `+65${formattedPhone}`;
          }
          
          // Extract and map Excel data to lead fields
          const leadData = {
            // Basic Information
            full_name: row["col_Full Name"]?.toString().trim() ?? '',
            phone_number: formattedPhone,
            email: row["col_Email Address"]?.toString().trim() ?? '',
            source: 'Walk-in',
            
            // Residential Information
            residential_status: row["col_Please choose your nationality or Work Pass "]?.toString().trim() === "Local" ? "Local" : "Foreigner",
            
            // Employment Information  
            employment_status: row["col_Employment Type"]?.toString().trim() ?? '',
            employment_salary: row["col_Monthly Income"]?.toString().trim() ?? '',
            
            // Loan Information
            amount: row["col_Loan Amount Applying?"]?.toString().trim() ?? '',
            loan_purpose: row["col_What is the purpose of the Loan?"]?.toString().trim() ?? '',
            existing_loans: row["col_How many Moneylender Company do you currently have outstanding loan?"]?.toString().trim() === "0" ? "No" : "Yes",
            
            // Additional fields
            status: 'new',
            bypassEligibility: false, // Run eligibility check for walk-ins
            created_by: fallbackUserId,
            received_time: new Date() // Mark as received now
          };
          
          console.log(`📝 Creating lead with data:`, {
            name: leadData.full_name,
            phone: leadData.phone_number,
            email: leadData.email,
            source: leadData.source,
            residential_status: leadData.residential_status,
            employment_status: leadData.employment_status,
            amount: leadData.amount
          });
          
          // Create the lead
          const createResult = await createLead(leadData);
          
          if (createResult.success && createResult.lead) {
            walkInsCreated++;
            walkInResults.push({
              excelRow: row,
              leadId: createResult.lead.id,
              leadName: createResult.lead.full_name ?? 'Unknown',
              phone: walkIn.cleanPhone,
              status: 'created',
              reason: `New lead created successfully. Eligibility: ${createResult.lead.eligibility_status}`
            });
            
            console.log(`✅ Created new lead ID: ${createResult.lead.id} for ${createResult.lead.full_name} - Status: ${createResult.lead.status}, Eligible: ${createResult.lead.eligibility_status}`);
          } else {
            walkInResults.push({
              excelRow: row,
              leadName: row["col_Full Name"] ?? 'Unknown',
              phone: walkIn.cleanPhone,
              status: 'failed',
              error: createResult.error ?? 'Unknown error during lead creation'
            });
            
            console.error(`❌ Failed to create lead for ${row["col_Full Name"]}: ${createResult.error}`);
          }
          
        } catch (error) {
          walkInResults.push({
            excelRow: row,
            leadName: row["col_Full Name"] ?? 'Unknown',
            phone: walkIn.cleanPhone,
            status: 'failed',
            error: `Exception during lead creation: ${error instanceof Error ? error.message : String(error)}`
          });
          
          console.error(`❌ Exception creating lead for ${row["col_Full Name"]}:`, error);
        }
      }
      
      console.log(`🏭 Lead Creation Summary:`);
      console.log(`📊 Walk-ins processed: ${walkInsProcessed}`);
      console.log(`🆕 New leads created: ${walkInsCreated}`);
      console.log(`👤 Existing leads found: ${walkInResults.filter(r => r.status === 'existing').length}`);
      console.log(`❌ Failed creations: ${walkInResults.filter(r => r.status === 'failed').length}`);
    }

    // **PHASE 4: APPOINTMENT AUTO-SCHEDULING**
    let appointmentsCreated = 0;
    const appointmentResults: Array<{
      leadId: number;
      leadName: string;
      phone: string;
      appointmentId?: number;
      timeslotId?: number;
      appointmentTime?: string;
      status: 'created' | 'failed' | 'ineligible';
      reason?: string;
      error?: string;
    }> = [];

    // Get eligible leads for appointment creation (created or existing leads)
    const eligibleForAppointments = walkInResults.filter(result => 
      (result.status === 'created' || result.status === 'existing') && result.leadId
    );

    if (eligibleForAppointments.length > 0) {
      console.log('📅 Phase 4: Creating appointments for eligible walk-ins...');
      
      // Import appointment functions
      const { fetchAvailableTimeslots } = await import('~/app/_actions/appointmentAction');
      const { createAppointmentWorkflow } = await import('~/app/_actions/transactionOrchestrator');
      
      try {
        // Get available timeslots for the target date
        console.log(`🔍 Fetching available timeslots for ${todaySingapore}...`);
        const availableTimeslots = await fetchAvailableTimeslots(todaySingapore);
        
        if (availableTimeslots.length === 0) {
          console.log(`⚠️ No timeslots available for ${todaySingapore}. Skipping appointment creation.`);
          
          // Mark all as failed due to no timeslots
          for (const walkInResult of eligibleForAppointments) {
            appointmentResults.push({
              leadId: walkInResult.leadId!,
              leadName: walkInResult.leadName,
              phone: walkInResult.phone,
              status: 'failed',
              reason: `No timeslots available for ${todaySingapore}`
            });
          }
        } else {
          console.log(`📅 Found ${availableTimeslots.length} available timeslots`);
          
          // Sort timeslots by start time to get earliest slots first
          const sortedTimeslots = availableTimeslots
            .filter(slot => !slot.is_disabled && (slot.occupied_count ?? 0) < (slot.max_capacity ?? 1))
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          
          console.log(`📅 Available slots after filtering: ${sortedTimeslots.length}`);
          
          if (sortedTimeslots.length === 0) {
            console.log(`⚠️ All timeslots are full for ${todaySingapore}. Skipping appointment creation.`);
            
            // Mark all as failed due to full timeslots
            for (const walkInResult of eligibleForAppointments) {
              appointmentResults.push({
                leadId: walkInResult.leadId!,
                leadName: walkInResult.leadName,
                phone: walkInResult.phone,
                status: 'failed',
                reason: `All timeslots are full for ${todaySingapore}`
              });
            }
          } else {
            // Create appointments for eligible leads
            let timeslotIndex = 0;
            
            for (const walkInResult of eligibleForAppointments) {
              console.log(`📅 Creating appointment for Lead ID: ${walkInResult.leadId} (${walkInResult.leadName})`);
              
              // Check if lead is eligible (not unqualified)
              if (walkInResult.reason?.includes('eligibility_status') && walkInResult.reason.includes('unqualified')) {
                appointmentResults.push({
                  leadId: walkInResult.leadId!,
                  leadName: walkInResult.leadName,
                  phone: walkInResult.phone,
                  status: 'ineligible',
                  reason: 'Lead is unqualified - not eligible for appointment'
                });
                console.log(`⚠️ Skipping appointment for unqualified lead: ${walkInResult.leadName}`);
                continue;
              }
              
              // Get the next available timeslot (with capacity checking)
              let selectedTimeslot = null;
              
              for (let i = timeslotIndex; i < sortedTimeslots.length; i++) {
                const slot = sortedTimeslots[i];
                if (!slot) continue;
                
                const occupiedCount = slot.occupied_count ?? 0;
                const maxCapacity = slot.max_capacity ?? 1;
                
                if (occupiedCount < maxCapacity) {
                  selectedTimeslot = slot;
                  timeslotIndex = i; // Start from this slot for next lead
                  break;
                }
              }
              
              if (!selectedTimeslot) {
                appointmentResults.push({
                  leadId: walkInResult.leadId!,
                  leadName: walkInResult.leadName,
                  phone: walkInResult.phone,
                  status: 'failed',
                  reason: 'No available timeslots with capacity remaining'
                });
                console.log(`❌ No available timeslots for ${walkInResult.leadName}`);
                continue;
              }
              
              try {
                // Create appointment using the transaction orchestrator
                const appointmentData = {
                  leadId: walkInResult.leadId!,
                  timeslotId: selectedTimeslot.id,
                  notes: `Walk-in appointment auto-created from Excel data on ${todaySingapore}`,
                  isUrgent: false,
                  phone: walkInResult.phone
                };
                
                console.log(`📅 Creating appointment with data:`, {
                  leadId: appointmentData.leadId,
                  timeslotId: appointmentData.timeslotId,
                  time: `${selectedTimeslot.start_time} - ${selectedTimeslot.end_time}`,
                  notes: appointmentData.notes
                });
                
                const appointmentResult = await createAppointmentWorkflow(appointmentData);
                
                if (appointmentResult.success) {
                  appointmentsCreated++;
                  
                  // Update the timeslot occupied count in our local array for next iteration
                  selectedTimeslot.occupied_count = (selectedTimeslot.occupied_count ?? 0) + 1;
                  
                  appointmentResults.push({
                    leadId: walkInResult.leadId!,
                    leadName: walkInResult.leadName,
                    phone: walkInResult.phone,
                    appointmentId: appointmentResult.results?.[0]?.result?.data?.appointment?.id,
                    timeslotId: selectedTimeslot.id,
                    appointmentTime: `${selectedTimeslot.start_time} - ${selectedTimeslot.end_time}`,
                    status: 'created',
                    reason: `Appointment created successfully at ${selectedTimeslot.start_time}`
                  });
                  
                  console.log(`✅ Created appointment for ${walkInResult.leadName} at ${selectedTimeslot.start_time} - ${selectedTimeslot.end_time}`);
                } else {
                  appointmentResults.push({
                    leadId: walkInResult.leadId!,
                    leadName: walkInResult.leadName,
                    phone: walkInResult.phone,
                    timeslotId: selectedTimeslot.id,
                    status: 'failed',
                    error: appointmentResult.error ?? 'Unknown error during appointment creation'
                  });
                  
                  console.error(`❌ Failed to create appointment for ${walkInResult.leadName}: ${appointmentResult.error}`);
                }
                
              } catch (error) {
                appointmentResults.push({
                  leadId: walkInResult.leadId!,
                  leadName: walkInResult.leadName,
                  phone: walkInResult.phone,
                  timeslotId: selectedTimeslot.id,
                  status: 'failed',
                  error: `Exception during appointment creation: ${error instanceof Error ? error.message : String(error)}`
                });
                
                console.error(`❌ Exception creating appointment for ${walkInResult.leadName}:`, error);
              }
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Error in appointment auto-scheduling phase:', error);
        
        // Mark all as failed due to system error
        for (const walkInResult of eligibleForAppointments) {
          appointmentResults.push({
            leadId: walkInResult.leadId!,
            leadName: walkInResult.leadName,
            phone: walkInResult.phone,
            status: 'failed',
            error: `System error during appointment scheduling: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
      
      console.log(`📅 Appointment Creation Summary:`);
      console.log(`📊 Eligible for appointments: ${eligibleForAppointments.length}`);
      console.log(`✅ Appointments created: ${appointmentsCreated}`);
      console.log(`⚠️ Ineligible leads: ${appointmentResults.filter(r => r.status === 'ineligible').length}`);
      console.log(`❌ Failed appointments: ${appointmentResults.filter(r => r.status === 'failed').length}`);
    }

    let processedCount = 0;
    let updatedCount = 0;
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
      error?: string;
    }> = [];

    // First, process Excel rows for new loan cases
    if (excelData?.rows) {
      for (const row of excelData.rows) {
        processedCount++;
        
        // Skip if not a new loan case
        if (row["col_New or Reloan? "]?.trim() !== "New Loan - 新贷款") {
          // console.log(`⏭️ Skipping non-new loan case: ${row["col_New or Reloan? "]}`);
          continue;
        }

        // Parse the timestamp from Excel (which is in GMT+8)
        let excelDate: string;
        try {
          const timestampStr = row.col_Timestamp;
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
            console.log(`📅 Parsed date: ${timestampStr} → ${excelDate}`);
          } else {
            throw new Error('Unsupported date format');
          }
        } catch (error) {
          console.error(`❌ Error parsing timestamp for row ${row.row_number}:`, error);
          console.error(`📝 Raw timestamp value: "${row.col_Timestamp}"`);
          continue;
        }

        // Only process if the Excel row is from today
        if (excelDate !== todaySingapore) {
          console.log(`⏭️ Skipping row ${row.row_number} - not from today (${excelDate} vs ${todaySingapore})`);
          continue;
        }

        // Clean and format the phone number from Excel
        const cleanExcelPhone = row["col_Mobile Number"]?.toString().replace(/\D/g, '');
        if (!cleanExcelPhone) {
          console.log(`⚠️ No phone number found in row ${row.row_number}`);
          continue;
        }

        // Find matching appointment
        // console.log(`🔍 Finding matching appointment for phone "${cleanExcelPhone}"`);
        const matchingAppointment = upcomingAppointments.find(record => {
          const leadPhone = record.lead?.phone_number?.replace(/\+65/g, '');
          console.log(`🔍 Found lead phone "${leadPhone}"`);
          return leadPhone === cleanExcelPhone;
        });

        if (!matchingAppointment) {
          console.log(`❌ No matching appointment found for phone "${cleanExcelPhone}"`);
          continue;
        }

        const { appointment, lead } = matchingAppointment;
        
        if (!lead) {
          console.warn(`⚠️ No lead found for appointment ${appointment.id}`);
          continue;
        }

        // Update appointment status based on code
        const code = row.col_Code?.trim().toUpperCase();
        let newAppointmentStatus = 'upcoming';
        let newLeadStatus = lead.status;
        let newLeadLoanStatus = lead.loan_status;
        let newLeadLoanNotes = lead.loan_notes;
        let newAppointmentLoanStatus = appointment.loan_status;
        let newAppointmentLoanNotes = appointment.loan_notes;
        let updateReason = '';

        // Format eligibility notes based on code
        let eligibilityNotes = '';
        if (code === 'RS') {
          // const rsDetailed = row["col_RS -Detailed"]?.trim() ?? '';
          // const rsReason = row.col_RS.trim() ?? '';
          eligibilityNotes = `RS - Rejected`;
        } else if (code === 'R') {
          eligibilityNotes = 'R - Rejected';
        } else if (code === 'PRS') {
          eligibilityNotes = 'PRS - Customer Rejected';
        } else if (code === 'P') {
          eligibilityNotes = 'P - Done';
        }

        // Update eligibility notes
        if (eligibilityNotes) {
          try {
            await db
              .update(leads)
              .set({
                eligibility_notes: eligibilityNotes,
                updated_at: new Date(),
                updated_by: fallbackUserId
              })
              .where(eq(leads.id, lead.id));
            console.log(`📝 Added eligibility notes to lead ${lead.id}: ${eligibilityNotes}`);
          } catch (error) {
            console.error(`❌ Error updating eligibility notes for lead ${lead.id}:`, error);
          }
        }

        switch (code) {
          case 'P':
            newAppointmentStatus = 'done';
            newLeadStatus = 'done';
            newLeadLoanStatus = 'P';
            newLeadLoanNotes = 'P - Done';
            newAppointmentLoanStatus = 'P';
            newAppointmentLoanNotes = 'P - Done';
            break;
          case 'PRS':
            newAppointmentStatus = 'done';
            newLeadStatus = 'done';
            newLeadLoanStatus = 'PRS';
            newLeadLoanNotes = 'PRS - Customer Rejected';
            newAppointmentLoanStatus = 'PRS';
            newAppointmentLoanNotes = 'PRS - Customer Rejected';
            break;
          case 'RS':
            newAppointmentStatus = 'done';
            newLeadStatus = 'missed/RS';
            newLeadLoanStatus = 'RS';
            newLeadLoanNotes = 'RS - Rejected';
            newAppointmentLoanStatus = 'RS';
            newAppointmentLoanNotes = 'RS - Rejected';
            break;
          case 'R':
            newAppointmentStatus = 'done';
            newLeadStatus = 'done';
            newLeadLoanStatus = 'R';
            newLeadLoanNotes = 'R - Rejected';
            newAppointmentLoanStatus = 'R';
            newAppointmentLoanNotes = 'R - Rejected';
            
            // Call rejection webhook for R codes
            try {
              const cleanPhoneNumber = lead.phone_number?.replace(/^\+65/, '').replace(/[^\d]/g, '') ?? '';
              if (cleanPhoneNumber) {
                console.log(`📞 Calling RS rejection webhook for ${cleanPhoneNumber}`);
                
                const rejectionWebhookUrl = process.env.WORKATO_SEND_REJECTION_WEBHOOK_URL;

                if(!rejectionWebhookUrl) {
                  console.error('❌ WORKATO_SEND_REJECTION_WEBHOOK_URL is not set');
                  return;
                }

                const webhookResponse = await fetch(rejectionWebhookUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    phone_number: cleanPhoneNumber,
                    lead_id: lead.id,
                    lead_name: lead.full_name,
                    appointment_id: appointment.id,
                    code: code,
                    timestamp: new Date().toISOString()
                  })
                });
                
                if (webhookResponse.ok) {
                  const webhookResult = await webhookResponse.json();
                  console.log(`✅ Lead rejection webhook called successfully for ${cleanPhoneNumber}:`, webhookResult);
                  updateReason += ` + Webhook called`;
                } else {
                  console.error(`❌ Lead rejection webhook failed for ${cleanPhoneNumber}:`, webhookResponse.status, webhookResponse.statusText);
                  updateReason += ` + Webhook failed`;
                }
              } else {
                console.warn(`⚠️ No valid phone number found for Lead rejection webhook (Lead ID: ${lead.id})`);
              }
            } catch (webhookError) {
              console.error(`❌ Error calling Lead rejection webhook:`, webhookError);
              updateReason += ` + Webhook error`;
            }
            break;
          default:
            console.log(`⚠️ Unknown code "${code}" for appointment ${appointment.id}`);
            continue;
        }

        // Update appointment status
        console.log(`🔍 Updating appointment ${appointment.id} to ${newAppointmentStatus}`);
        await db
          .update(appointments)
          .set({ 
            status: newAppointmentStatus,
            loan_status: newAppointmentLoanStatus,
            loan_notes: newAppointmentLoanNotes,
            updated_at: new Date(),
            updated_by: fallbackUserId
          })
          .where(eq(appointments.id, appointment.id));
        console.log(`✅ Updated appointment ${appointment.id} to ${newAppointmentStatus}`);

        // Update lead status if it changed
        console.log(`🔍 Updating lead ${lead.id} to ${newLeadStatus}`);
        await updateLead(lead.id, { 
          status: newLeadStatus,
          loan_status: newLeadLoanStatus,
          loan_notes: newLeadLoanNotes,
          updated_at: new Date(),
          updated_by: fallbackUserId
        });
        console.log(`✅ Updated lead ${lead.id} to ${newLeadStatus}`);

        updatedCount++;
        console.log(`✅ Updated appointment ${appointment.id} to ${newAppointmentStatus} (Code: ${code}) - ${updateReason}`);
      }
    }

    // Then, check remaining appointments for time threshold
    for (const record of upcomingAppointments) {
      const appointment = record.appointment;
      const lead = record.lead;
      
      if (!lead) {
        console.warn(`⚠️ No lead found for appointment ${appointment.id}`);
        continue;
      }

      // Skip if this appointment was already processed by Excel data
      if (appointment.status !== 'upcoming') {
        continue;
      }

      // Convert appointment time to Singapore timezone for comparison
      const appointmentTimeUTC = new Date(appointment.start_datetime);
      const appointmentTimeSGT = new Date(appointmentTimeUTC.getTime() + (8 * 60 * 60 * 1000));
      const currentTimeSGT = singaporeTime;

      // Calculate time difference in hours
      const timeDiffMs = currentTimeSGT.getTime() - appointmentTimeSGT.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      console.log(`🕐 Appointment ${appointment.id}: ${format(appointmentTimeSGT, 'HH:mm')} | Current: ${format(currentTimeSGT, 'HH:mm')} | Diff: ${timeDiffHours.toFixed(2)}h`);

      // If appointment is late by threshold hours, mark as missed
      if (timeDiffHours >= thresholdHours) {
        try {
          // Update appointment status
          await db
            .update(appointments)
            .set({
              status: 'missed',
              updated_at: new Date(),
              updated_by: fallbackUserId
            })
            .where(eq(appointments.id, appointment.id));

          // Update lead status
          await updateLead(lead.id, {
            status: 'missed/RS',
            updated_at: new Date(),
            updated_by: fallbackUserId
          });

          updatedCount++;
          console.log(`✅ Marked appointment ${appointment.id} as missed (${timeDiffHours.toFixed(2)}h late)`);
        } catch (error) {
          console.error(`❌ Error updating appointment ${appointment.id}:`, error);
        }
      } else {
        console.log(`ℹ️ No update needed for appointment ${appointment.id}: Time diff ${timeDiffHours.toFixed(2)}h < ${thresholdHours}h`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Appointment status update completed",
      processed: processedCount,
      updated: updatedCount,
      results,
      // Walk-in processing results
      walkInSystem: {
        walkInsDetected: walkInLeads.length,
        walkInsProcessed: walkInsProcessed,
        leadsCreated: walkInsCreated,
        appointmentsCreated: appointmentsCreated,
        walkInResults: walkInResults,
        appointmentResults: appointmentResults
      },
      // Summary
      todaySingapore: todaySingapore,
      targetDate: todaySingapore,
      thresholdHours: thresholdHours
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

// GET endpoint for testing/manual trigger without Excel data
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const thresholdHours = parseFloat(searchParams.get('thresholdHours') ?? '2.5');

    console.log('🔄 Manual trigger: Processing appointments without Excel data');

    // Call the POST method without Excel data
    const response = await POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ thresholdHours }),
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