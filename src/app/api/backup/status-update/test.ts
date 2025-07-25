/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { appointments, leads, borrower_appointments, borrowers } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, addHours } from 'date-fns';
import { updateLead } from "~/app/_actions/leadActions";

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

export async function POST(request: NextRequest) {
  try {
    // Get request parameters - handle both JSON and form data from Workato
    let excelData: ExcelData | undefined;
    let thresholdHours = 3;
    
    const contentType = request.headers.get('content-type') ?? '';
    
    if (contentType.includes('application/json')) {
      // Handle JSON format
      try {
        const body = await request.json() as { excelData?: ExcelData; thresholdHours?: number };
        excelData = body.excelData;
        thresholdHours = body.thresholdHours ?? 3;
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
          
          console.log('✅ Successfully parsed form data');
          console.log(`📊 Found ${excelData.rows.length} rows`);
        } else {
          // console.log('❌ No rows data found in form');
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
            // console.log('🔍 Trying URL parameters...');
            const decodedRows = decodeURIComponent(rowsParam);
            const rows = JSON.parse(decodedRows);
            excelData = {
              rows: Array.isArray(rows) ? rows : [rows],
              spreadsheet_id: url.searchParams.get('spreadsheet_id') ?? 'url-param',
              spreadsheet_name: url.searchParams.get('spreadsheet_name') ?? 'URL Parameters',
              sheet: url.searchParams.get('sheet') ?? 'Sheet1'
            };
            thresholdHours = parseFloat(url.searchParams.get('thresholdHours') ?? '3');
            // console.log('✅ Successfully parsed URL parameters');
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
    // console.log('📊 Excel data provided:', !!excelData);
    console.log('⏰ Threshold hours:', thresholdHours);

    // Get today's date in Singapore timezone (UTC+8)
    const now = new Date();
    const singaporeOffset = 8 * 60; // 8 hours in minutes
    const singaporeTime = new Date(now.getTime() + (singaporeOffset * 60 * 1000));
    const todaySingapore = singaporeTime.toISOString().split('T')[0]; // YYYY-MM-DD format

    // console.log('📅 Today (Singapore):', todaySingapore);

    // Fetch all upcoming appointments for today
    const startOfDaySGT = new Date(`${todaySingapore}T00:00:00.000Z`);
    const endOfDaySGT = new Date(`${todaySingapore}T23:59:59.999Z`);
    
    // Convert to UTC for database query
    const startOfDayUTC = new Date(startOfDaySGT.getTime() - (8 * 60 * 60 * 1000));
    const endOfDayUTC = new Date(endOfDaySGT.getTime() - (8 * 60 * 60 * 1000));

    // Fetch lead appointments
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

    // Fetch borrower appointments
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
          gte(borrower_appointments.start_datetime, startOfDayUTC),
          lte(borrower_appointments.start_datetime, endOfDayUTC)
        )
      );

    console.log(`📋 Found ${upcomingAppointments.length} upcoming lead appointments and ${upcomingBorrowerAppointments.length} upcoming borrower appointments for today`);
    
    // Debug: List all found appointments
    upcomingAppointments.forEach(record => {
      const appt = record.appointment;
      const leadData = record.lead;
      const apptTimeSGT = new Date(appt.start_datetime.getTime() + (8 * 60 * 60 * 1000));
      // console.log(`📅 Found lead appointment ${appt.id}: Lead "${leadData?.full_name}" (${leadData?.phone_number}), Time: ${format(apptTimeSGT, 'yyyy-MM-dd HH:mm')}, Status: ${appt.status}`);
    });

    upcomingBorrowerAppointments.forEach(record => {
      const appt = record.appointment;
      const borrowerData = record.borrower;
      const apptTimeSGT = new Date(appt.start_datetime.getTime() + (8 * 60 * 60 * 1000));
      // console.log(`📅 Found borrower appointment ${appt.id}: Borrower "${borrowerData?.full_name}" (${borrowerData?.phone_number}), Time: ${format(apptTimeSGT, 'yyyy-MM-dd HH:mm')}, Status: ${appt.status}`);
    });

    if (upcomingAppointments.length === 0 && upcomingBorrowerAppointments.length === 0) {
      // console.log(`📊 No appointments found - Final Summary:`);
      // console.log(`   Today (Singapore): ${todaySingapore}`);
      // console.log(`   Threshold hours: ${thresholdHours}`);
      // console.log(`   Excel data provided: ${!!excelData}`);
      
      return NextResponse.json({
        success: true,
        message: "No upcoming appointments found for today",
        processed: 0,
        updated: 0,
        todaySingapore,
        thresholdHours,
        results: [],
        summary: {
          excelDataProvided: !!excelData,
          excelRowsProcessed: excelData?.rows?.length ?? 0,
          upcomingLeadAppointmentsFound: 0,
          upcomingBorrowerAppointmentsFound: 0,
          leadAppointmentStatusUpdates: 0,
          borrowerAppointmentStatusUpdates: 0,
          timeBasedMissedUpdates: 0,
          errorCount: 0
        }
      });
    }

    let processedCount = 0;
    let updatedCount = 0;
    const processedAppointmentIds = new Set<number>(); // Track appointments already updated by Excel data
    const processedBorrowerAppointmentIds = new Set<number>(); // Track borrower appointments already updated by Excel data
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

    // Use fallback userId for updates (since auth is commented out)
    const fallbackUserId = "system-update";

    // First, process Excel rows for new loan cases
    if (excelData?.rows) {
      console.log(`📊 Processing ${excelData.rows.length} Excel rows...`);
      
      for (const row of excelData.rows) {
        processedCount++;
        
        // Skip if not a new loan case
        // if (row["col_New or Reloan? "]?.trim() !== "New Loan - 新贷款") {
        //   // console.log(`⏭️ Skipping non-new loan case: ${row["col_New or Reloan? "]}`);
        //   continue;
        // }

        // Parse the timestamp from Excel (which is in GMT+8)
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
            // console.log(`📅 Parsed date: ${timestampStr} → ${excelDate}`);
          } else {
            throw new Error('Unsupported date format');
          }
        } catch (error) {
          console.error(`❌ Error parsing timestamp for row ${row.row_number}:`, error);
          console.error(`📝 Raw timestamp value: "${row.col_Date}"`);
          continue;
        }

        // Only process if the Excel row is from today
        if (excelDate !== todaySingapore) {
          // console.log(`⏭️ Skipping row ${row.row_number} - not from today (${excelDate} vs ${todaySingapore})`);
          continue;
        }

        // Clean and format the phone number from Excel
        const cleanExcelPhone = row["col_Mobile Number"]?.toString().replace(/\D/g, '');
        if (!cleanExcelPhone) {
          // console.log(`⚠️ No phone number found in row ${row.row_number}`);
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
        let additionalLeadNotes = '';
        
        if (code === 'RS') {
          const rsDetailed = row["col_RS -Detailed"]?.trim() ?? '';
          const rsReason = row.col_RS?.trim() ?? '';
          eligibilityNotes = `RS - ${rsReason}`;
          
          // Add detailed reason to lead notes if it has content
          if (rsDetailed) {
            additionalLeadNotes = `RS Details: ${rsDetailed}`;
          }
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
            newLeadLoanNotes = additionalLeadNotes ? `RS - Rejected. ${additionalLeadNotes}` : 'RS - Rejected';
            newAppointmentLoanStatus = 'RS';
            newAppointmentLoanNotes = additionalLeadNotes ? `RS - Rejected. ${additionalLeadNotes}` : 'RS - Rejected';
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

        // Add to results array
        const appointmentTimeUTC = new Date(appointment.start_datetime);
        const appointmentTimeSGT = new Date(appointmentTimeUTC.getTime() + (8 * 60 * 60 * 1000));
        
        results.push({
          appointmentId: appointment.id.toString(),
          leadId: lead.id.toString(),
          leadName: lead.full_name ?? 'Unknown',
          oldAppointmentStatus: appointment.status,
          newAppointmentStatus: newAppointmentStatus,
          oldLeadStatus: lead.status,
          newLeadStatus: newLeadStatus,
          reason: `Excel Code: ${code} - ${eligibilityNotes}${updateReason}`,
          appointmentTime: format(appointmentTimeSGT, 'yyyy-MM-dd HH:mm'),
          timeDiffHours: 'N/A (Excel Update)'
        });

        // Mark this appointment as processed to avoid duplicate updates
        processedAppointmentIds.add(appointment.id);

        updatedCount++;
        console.log(`✅ Updated appointment ${appointment.id} to ${newAppointmentStatus} (Code: ${code}) - ${updateReason}`);
      }
      
      console.log(`📊 Excel processing for lead appointments completed: ${processedAppointmentIds.size} appointments updated from Excel data`);
    }

    // Process Excel rows for borrower appointments (Re Loan - 再贷款)
    if (excelData?.rows) {
      console.log(`📊 Processing ${excelData.rows.length} Excel rows for borrower appointments...`);
      
      for (const row of excelData.rows) {
        processedCount++;
        
        // Check if this is a reloan case for borrower appointments
        if (row["col_New or Reloan? "]?.trim() !== "Re Loan - 再贷款") {
          // console.log(`⏭️ Skipping non-reloan case: ${row["col_New or Reloan? "]}`);
          continue;
        }

        // Parse the timestamp from Excel (which is in GMT+8)
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

        // Find matching borrower appointment
        console.log(`🔍 Finding matching borrower appointment for phone "${cleanExcelPhone}"`);
        const matchingBorrowerAppointment = upcomingBorrowerAppointments.find(record => {
          const borrowerPhone = record.borrower?.phone_number?.replace(/^\+65/, '').replace(/\D/g, '');
          console.log(`🔍 Found borrower phone "${borrowerPhone}"`);
          return borrowerPhone === cleanExcelPhone;
        });

        if (!matchingBorrowerAppointment) {
          console.log(`❌ No matching borrower appointment found for phone "${cleanExcelPhone}"`);
          continue;
        }

        const { appointment: borrowerAppointment, borrower } = matchingBorrowerAppointment;
        
        if (!borrower) {
          console.warn(`⚠️ No borrower found for appointment ${borrowerAppointment.id}`);
          continue;
        }

        // Update borrower appointment status based on code
        const code = row.col_Code?.trim().toUpperCase();
        let newAppointmentStatus = 'upcoming';
        let newBorrowerStatus = borrower.status;
        let newBorrowerLoanStatus = borrower.loan_status;
        let newBorrowerLoanNotes = borrower.loan_notes;
        let newAppointmentLoanStatus = borrowerAppointment.loan_status;
        let newAppointmentLoanNotes = borrowerAppointment.loan_notes;
        let updateReason = '';

        // Format eligibility notes based on code (for borrower)
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
            
            // Call rejection webhook for R codes for borrowers too
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

        // Update borrower appointment status
        console.log(`🔍 Updating borrower appointment ${borrowerAppointment.id} to ${newAppointmentStatus}`);
        await db
          .update(borrower_appointments)
          .set({ 
            status: newAppointmentStatus,
            loan_status: newAppointmentLoanStatus,
            loan_notes: newAppointmentLoanNotes,
            updated_at: new Date(),
            // updated_by: fallbackUserId
          })
          .where(eq(borrower_appointments.id, borrowerAppointment.id));
        console.log(`✅ Updated borrower appointment ${borrowerAppointment.id} to ${newAppointmentStatus}`);

        // Update borrower status if it changed
        console.log(`🔍 Updating borrower ${borrower.id} to ${newBorrowerStatus}`);
        await db
          .update(borrowers)
          .set({
            status: newBorrowerStatus,
            loan_status: newBorrowerLoanStatus,
            loan_notes: newBorrowerLoanNotes,
            updated_at: new Date(),
            // updated_by: fallbackUserId
          })
          .where(eq(borrowers.id, borrower.id));
        console.log(`✅ Updated borrower ${borrower.id} to ${newBorrowerStatus}`);

        // Add to results array
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
          timeDiffHours: 'N/A (Excel Update)'
        });

        // Mark this borrower appointment as processed to avoid duplicate updates
        processedBorrowerAppointmentIds.add(borrowerAppointment.id);

        updatedCount++;
        console.log(`✅ Updated borrower appointment ${borrowerAppointment.id} to ${newAppointmentStatus} (Code: ${code}) - ${updateReason}`);
      }
      
      console.log(`📊 Excel processing for borrower appointments completed: ${processedBorrowerAppointmentIds.size} borrower appointments updated from Excel data`);
    }

    // Then, check remaining appointments for time threshold
    console.log(`🕐 Starting time threshold check for ${upcomingAppointments.length} total appointments (${processedAppointmentIds.size} already processed by Excel)`);
    
    for (const record of upcomingAppointments) {
      const appointment = record.appointment;
      const lead = record.lead;
      
      if (!lead) {
        console.warn(`⚠️ No lead found for appointment ${appointment.id}`);
        continue;
      }

      // Skip if this appointment was already processed by Excel data
      if (processedAppointmentIds.has(appointment.id)) {
        // console.log(`⏭️ Skipping appointment ${appointment.id} - already processed by Excel data`);
        continue;
      }

      // Skip if appointment status is no longer 'upcoming' (safety check)
      if (appointment.status !== 'upcoming') {
        // console.log(`⏭️ Skipping appointment ${appointment.id} - status is ${appointment.status}, not upcoming`);
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

          // Add to results array
          results.push({
            appointmentId: appointment.id.toString(),
            leadId: lead.id.toString(),
            leadName: lead.full_name ?? 'Unknown',
            oldAppointmentStatus: appointment.status,
            newAppointmentStatus: 'missed',
            oldLeadStatus: lead.status,
            newLeadStatus: 'missed/RS',
            reason: `Time threshold exceeded (${timeDiffHours.toFixed(2)}h late, threshold: ${thresholdHours}h)`,
            appointmentTime: format(appointmentTimeSGT, 'yyyy-MM-dd HH:mm'),
            timeDiffHours: timeDiffHours.toFixed(2)
          });

          updatedCount++;
          console.log(`✅ Marked appointment ${appointment.id} as missed (${timeDiffHours.toFixed(2)}h late)`);
        } catch (error) {
          console.error(`❌ Error updating appointment ${appointment.id}:`, error);
          
          // Add error to results array
          results.push({
            appointmentId: appointment.id.toString(),
            leadId: lead.id.toString(),
            leadName: lead.full_name ?? 'Unknown',
            oldAppointmentStatus: appointment.status,
            newAppointmentStatus: appointment.status,
            oldLeadStatus: lead.status,
            newLeadStatus: lead.status,
            reason: `Failed to update: ${(error as Error).message}`,
            appointmentTime: format(appointmentTimeSGT, 'yyyy-MM-dd HH:mm'),
            timeDiffHours: timeDiffHours.toFixed(2),
            error: (error as Error).message
          });
        }
      } else {
        console.log(`ℹ️ No update needed for appointment ${appointment.id}: Time diff ${timeDiffHours.toFixed(2)}h < ${thresholdHours}h`);
      }
    }

    // Then, check remaining borrower appointments for time threshold
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
              // updated_by: fallbackUserId
            })
            .where(eq(borrower_appointments.id, borrowerAppointment.id));

          // Update borrower status
          await db
            .update(borrowers)
            .set({
              status: 'missed/RS',
              updated_at: new Date(),
              // updated_by: fallbackUserId
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
            newLeadStatus: 'follow_up',
            reason: `Time threshold exceeded (${timeDiffHours.toFixed(2)}h late, threshold: ${thresholdHours}h) - Borrower`,
            appointmentTime: format(appointmentTimeSGT, 'yyyy-MM-dd HH:mm'),
            timeDiffHours: timeDiffHours.toFixed(2)
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
            error: (error as Error).message
          });
        }
      } else {
        // console.log(`ℹ️ No update needed for borrower appointment ${borrowerAppointment.id}: Time diff ${timeDiffHours.toFixed(2)}h < ${thresholdHours}h`);
      }
    }

    console.log(`📊 Final Summary:`);
    console.log(`   Total Excel rows processed: ${processedCount}`);
    console.log(`   Total appointments updated: ${updatedCount}`);
    console.log(`   Lead appointments processed by Excel: ${processedAppointmentIds.size}`);
    console.log(`   Borrower appointments processed by Excel: ${processedBorrowerAppointmentIds.size}`);
    console.log(`   Results entries: ${results.length}`);
    console.log(`   Today (Singapore): ${todaySingapore}`);
    console.log(`   Threshold hours: ${thresholdHours}`);

    return NextResponse.json({
      success: true,
      message: `Appointment status update completed. Processed ${processedCount} Excel rows, updated ${updatedCount} appointments.`,
      processed: processedCount,
      updated: updatedCount,
      todaySingapore,
      thresholdHours,
      results,
      summary: {
        excelDataProvided: !!excelData,
        excelRowsProcessed: excelData?.rows?.length ?? 0,
        upcomingLeadAppointmentsFound: upcomingAppointments.length,
        upcomingBorrowerAppointmentsFound: upcomingBorrowerAppointments.length,
        leadAppointmentStatusUpdates: results.filter(r => r.reason.includes('Excel Code') && !r.reason.includes('Borrower')).length,
        borrowerAppointmentStatusUpdates: results.filter(r => r.reason.includes('Excel Code') && r.reason.includes('Borrower')).length,
        timeBasedMissedUpdates: results.filter(r => r.reason.includes('Time threshold')).length,
        errorCount: results.filter(r => r.error).length
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

// GET endpoint for testing/manual trigger without Excel data
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const thresholdHours = parseFloat(searchParams.get('thresholdHours') ?? '3');

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