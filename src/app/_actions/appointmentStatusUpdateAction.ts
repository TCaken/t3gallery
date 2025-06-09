"use server";

import { auth } from "@clerk/nextjs/server";

// Types for Excel data structure
interface ExcelRow {
  row_number: number;
  col_Timestamp: string;
  col_UW: string;
  col_RM: string;
  col_Group: string;
  col_Code: string;
  "col_Loan Portal Applied"?: string;
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

interface AppointmentUpdateResult {
  appointmentId: number;
  leadId: number;
  leadName: string;
  oldAppointmentStatus: string;
  newAppointmentStatus: string;
  oldLeadStatus: string;
  newLeadStatus: string;
  reason: string;
  appointmentTime: string;
  timeDiffHours: string;
  error?: string;
}

interface UpdateResponse {
  success: boolean;
  message: string;
  processed: number;
  updated: number;
  results: AppointmentUpdateResult[];
  todaySingapore: string;
  thresholdHours: number;
  error?: string;
  details?: string;
}

/**
 * Update appointment statuses based on Excel data and time thresholds
 */
export async function updateAppointmentStatuses(
  excelData?: ExcelData,
  thresholdHours = 2.5
): Promise<UpdateResponse> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    console.log('🔄 Calling appointment status update API...');
    console.log('📊 Excel data provided:', !!excelData);
    console.log('⏰ Threshold hours:', thresholdHours);

    // Get the base URL for the API call
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/appointments/status-update`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        excelData,
        thresholdHours
      })
    });

    const result = await response.json() as UpdateResponse & { error?: string; details?: string };

    if (!response.ok) {
      console.error('❌ API call failed:', result);
      return {
        success: false,
        message: result.error ?? 'Failed to update appointment statuses',
        processed: 0,
        updated: 0,
        results: [],
        todaySingapore: '',
        thresholdHours,
        error: result.error,
        details: result.details
      };
    }

    console.log('✅ API call successful:', result);
    return result;

  } catch (error) {
    console.error("❌ Error updating appointment statuses:", error);
    return {
      success: false,
      message: "Failed to update appointment statuses",
      processed: 0,
      updated: 0,
      results: [],
      todaySingapore: '',
      thresholdHours,
      error: (error as Error).message
    };
  }
}

/**
 * Update appointment statuses without Excel data (time-based only)
 */
export async function updateAppointmentStatusesByTime(
  thresholdHours = 2.5
): Promise<UpdateResponse> {
  return updateAppointmentStatuses(undefined, thresholdHours);
}

/**
 * Test the appointment status update functionality
 */
export async function testAppointmentStatusUpdate(): Promise<UpdateResponse> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  
  try {
    console.log('🧪 Testing appointment status update...');

    // Get the base URL for the API call
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/appointments/status-update?thresholdHours=2.5`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json() as UpdateResponse & { error?: string; details?: string };

    if (!response.ok) {
      console.error('❌ Test API call failed:', result);
      return {
        success: false,
        message: result.error ?? 'Failed to test appointment status update',
        processed: 0,
        updated: 0,
        results: [],
        todaySingapore: '',
        thresholdHours: 2.5,
        error: result.error,
        details: result.details
      };
    }

    console.log('✅ Test API call successful:', result);
    return result;

  } catch (error) {
    console.error("❌ Error testing appointment status update:", error);
    return {
      success: false,
      message: "Failed to test appointment status update",
      processed: 0,
      updated: 0,
      results: [],
      todaySingapore: '',
      thresholdHours: 2.5,
      error: (error as Error).message
    };
  }
} 