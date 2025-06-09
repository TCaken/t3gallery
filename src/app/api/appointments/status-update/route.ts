import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { appointments, leads } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, addHours } from 'date-fns';

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
    
    const contentType = request.headers.get('content-type') ?? '';
    console.log('📥 Content-Type:', contentType);
    
    if (contentType.includes('application/json')) {
      // Handle JSON format
      try {
        const body = await request.json() as { excelData?: ExcelData; thresholdHours?: number };
        excelData = body.excelData;
        thresholdHours = body.thresholdHours ?? 2.5;
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
            thresholdHours = parseFloat(thresholdParam) || 2.5;
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

    // Get today's date in Singapore timezone (UTC+8)
    const now = new Date();
    const singaporeOffset = 8 * 60; // 8 hours in minutes
    const singaporeTime = new Date(now.getTime() + (singaporeOffset * 60 * 1000));
    const todaySingapore = singaporeTime.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log('📅 Today (Singapore):', todaySingapore);

    // Fetch all upcoming appointments for today
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

    console.log(`📋 Found ${upcomingAppointments.length} upcoming appointments for today`);
    
    // Debug: List all found appointments
    upcomingAppointments.forEach(record => {
      const appt = record.appointment;
      const leadData = record.lead;
      const apptTimeSGT = new Date(appt.start_datetime.getTime() + (8 * 60 * 60 * 1000));
      console.log(`📅 Found appointment ${appt.id}: Lead "${leadData?.full_name}" (${leadData?.phone_number}), Time: ${format(apptTimeSGT, 'yyyy-MM-dd HH:mm')}, Status: ${appt.status}`);
    });

    if (upcomingAppointments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No upcoming appointments found for today",
        processed: 0,
        updated: 0
      });
    }

    let processedCount = 0;
    let updatedCount = 0;
    const results = [];

    // Use fallback userId for updates (since auth is commented out)
    const fallbackUserId = "system-update";

    // Process each appointment
    for (const record of upcomingAppointments) {
      const appointment = record.appointment;
      const lead = record.lead;
      
      if (!lead) {
        console.warn(`⚠️ No lead found for appointment ${appointment.id}`);
        continue;
      }

      processedCount++;

      // Convert appointment time to Singapore timezone for comparison
      const appointmentTimeUTC = new Date(appointment.start_datetime);
      const appointmentTimeSGT = new Date(appointmentTimeUTC.getTime() + (8 * 60 * 60 * 1000));
      const currentTimeSGT = singaporeTime;

      // Calculate time difference in hours
      const timeDiffMs = currentTimeSGT.getTime() - appointmentTimeSGT.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      console.log(`🕐 Appointment ${appointment.id}: ${format(appointmentTimeSGT, 'HH:mm')} | Current: ${format(currentTimeSGT, 'HH:mm')} | Diff: ${timeDiffHours.toFixed(2)}h`);

      let shouldUpdateToMissed = false;
      let shouldUpdateToDone = false;
      let newLeadStatus = '';
      let updateReason = '';

      // Check if Excel data is provided and find matching row
      let matchingExcelRow: ExcelRow | undefined;
      if (excelData?.rows) {
        // Try to match by phone number (remove any formatting)
        const cleanLeadPhone = lead.phone_number?.replace(/[^\d]/g, '') ?? '';
        
        console.log(`🔍 Debug appointment ${appointment.id}: Lead phone "${lead.phone_number}" → cleaned "${cleanLeadPhone}"`);
        
        matchingExcelRow = excelData.rows.find(row => {
          const cleanExcelPhone = row["col_Mobile Number"]?.toString().replace(/[^\d]/g, '') ?? '';
          
          // Handle Singapore phone number matching
          // Database: +6581467005 → 6581467005
          // Excel: 81467005 → 81467005
          // We need to match both formats
          let isMatch = false;
          
          if (cleanExcelPhone && cleanLeadPhone) {
            // Direct match
            isMatch = cleanExcelPhone === cleanLeadPhone;
            
            // If no direct match, try adding/removing Singapore country code (65)
            if (!isMatch) {
              // Case 1: Excel has 8 digits, database has 65 + 8 digits
              if (cleanExcelPhone.length === 8 && cleanLeadPhone === `65${cleanExcelPhone}`) {
                isMatch = true;
              }
              // Case 2: Excel has 65 + 8 digits, database has 8 digits
              else if (cleanLeadPhone.length === 8 && cleanExcelPhone === `65${cleanLeadPhone}`) {
                isMatch = true;
              }
              // Case 3: Both have country code but different format
              else if (cleanExcelPhone.startsWith('65') && cleanLeadPhone.startsWith('65')) {
                isMatch = cleanExcelPhone === cleanLeadPhone;
              }
            }
          }
          
        //   if (cleanExcelPhone) {
        //     console.log(`📊 Checking Excel row ${row.row_number}: "${row["col_Mobile Number"]}" → cleaned "${cleanExcelPhone}", Code: "${row.col_Code}", Match: ${isMatch}`);
        //   }
          
          return isMatch;
        });

        if (matchingExcelRow) {
          console.log(`📊 Found Excel match for appointment ${appointment.id}: Code="${matchingExcelRow.col_Code}"`);
          
          // Process based on Excel Code
          const code = matchingExcelRow.col_Code?.trim().toUpperCase();
          
                    // ANY code found means appointment is done
          if (code && code.length > 0) {
            shouldUpdateToDone = true;
            
            // Lead status depends on the specific code
            if (code === 'RS') {
              newLeadStatus = 'missed/RS';
              updateReason = `Excel Code: ${code} → Appointment Done, Lead missed/RS`;
              
              // Call RS rejection webhook for RS codes
              try {
                const cleanPhoneNumber = lead.phone_number?.replace(/^\+65/, '').replace(/[^\d]/g, '') ?? '';
                if (cleanPhoneNumber) {
                  console.log(`📞 Calling RS rejection webhook for ${cleanPhoneNumber}`);
                  
                  const webhookResponse = await fetch('https://webhooks.sg.workato.com/webhooks/rest/948768ee-3ac7-4215-b07d-24e2585f7884/rs-rejection', {
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
                    console.log(`✅ RS rejection webhook called successfully for ${cleanPhoneNumber}:`, webhookResult);
                    updateReason += ` + Webhook called`;
                  } else {
                    console.error(`❌ RS rejection webhook failed for ${cleanPhoneNumber}:`, webhookResponse.status, webhookResponse.statusText);
                    updateReason += ` + Webhook failed`;
                  }
                } else {
                  console.warn(`⚠️ No valid phone number found for RS rejection webhook (Lead ID: ${lead.id})`);
                }
              } catch (webhookError) {
                console.error(`❌ Error calling RS rejection webhook:`, webhookError);
                updateReason += ` + Webhook error`;
              }
            } else {
              newLeadStatus = 'done';
              updateReason = `Excel Code: ${code} → Appointment Done, Lead done`;
            }
          }
        }
      }

      // If no Excel data or no match, check time threshold
      if (!shouldUpdateToDone && timeDiffHours >= thresholdHours) {
        shouldUpdateToMissed = true;
        updateReason = `Time threshold exceeded: ${timeDiffHours.toFixed(2)}h >= ${thresholdHours}h → Appointment missed, Lead missed/RS`;
      }

      // Update appointment and lead if needed
      if (shouldUpdateToDone || shouldUpdateToMissed) {
        try {
          const newAppointmentStatus = shouldUpdateToDone ? 'done' : 'missed';
          const defaultLeadStatus = shouldUpdateToMissed ? 'missed/RS' : 'done';
          const finalLeadStatus = newLeadStatus || defaultLeadStatus;

          // Update appointment status
          await db
            .update(appointments)
            .set({
              status: newAppointmentStatus,
              updated_at: new Date(),
              updated_by: fallbackUserId
            })
            .where(eq(appointments.id, appointment.id));

          // Update lead status
          await db
            .update(leads)
            .set({
              status: finalLeadStatus,
              updated_at: new Date(),
              updated_by: fallbackUserId
            })
            .where(eq(leads.id, lead.id));

          updatedCount++;
          
          results.push({
            appointmentId: appointment.id,
            leadId: lead.id,
            leadName: lead.full_name,
            oldAppointmentStatus: 'upcoming',
            newAppointmentStatus,
            oldLeadStatus: lead.status,
            newLeadStatus: finalLeadStatus,
            reason: updateReason,
            appointmentTime: format(appointmentTimeSGT, 'HH:mm'),
            timeDiffHours: timeDiffHours.toFixed(2)
          });

          console.log(`✅ Updated appointment ${appointment.id}: ${newAppointmentStatus} | Lead: ${finalLeadStatus} | Reason: ${updateReason}`);
        } catch (error) {
          console.error(`❌ Error updating appointment ${appointment.id}:`, error);
          results.push({
            appointmentId: appointment.id,
            leadId: lead.id,
            leadName: lead.full_name,
            error: `Failed to update: ${(error as Error).message}`,
            reason: updateReason
          });
        }
      } else {
        console.log(`ℹ️ No update needed for appointment ${appointment.id}: Time diff ${timeDiffHours.toFixed(2)}h < ${thresholdHours}h, No Excel match`);
      }
    }

    console.log(`🎯 Process completed: ${processedCount} processed, ${updatedCount} updated`);

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} appointments, updated ${updatedCount}`,
      processed: processedCount,
      updated: updatedCount,
      results,
      todaySingapore,
      thresholdHours
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