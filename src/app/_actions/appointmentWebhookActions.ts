"use server";

import { db } from "~/server/db";
import { leads } from "~/server/db/schema";
import { eq } from "drizzle-orm";

// Define the data structure for the webhook
interface AppointmentWebhookData {
  UW?: string;
  RM?: string;
  Group?: string;
  Code?: string;
  "Loan Portal Applied"?: string;
  Manual?: string;
  "Reason for manual"?: string;
  "Full Name"?: string;
  "Mobile Number"?: string;
  "H/P"?: string;
  "New or Reloan?"?: string;
  "Loan Amount $10,000 and above"?: string;
  "Please choose your nationality or Work Pass"?: string;
  "Last 4 digits of the NRIC (including the alphabet)"?: string;
  "Marital Status"?: string;
  "Your Employment Specialisation"?: string;
  "Email Address"?: string;
  "Monthly Income"?: string;
  "Loan Amount Applying?"?: string;
  "Are you a Declared Bankruptcy at the time of this loan application?"?: string;
  "Which year is your bankruptcy discharge?"?: string;
  "What is your work designation?"?: string;
  "For how long have you been working in this company?"?: string;
  "Place of Residence"?: string;
  "Number of Room HDB Flat"?: string;
  "What is the purpose of the Loan?"?: string;
  "How many Moneylender Company do you currently have outstanding loan?"?: string;
  "**Declaration - 声明 **"?: string;
  "Employment Type"?: string;
  // Additional fields for appointment
  "Appointment Date"?: string;
  "Appointment Time"?: string;
  "Appointment Type"?: string;
  "Lead ID"?: string;
  "Created At"?: string;
}

// Function to send appointment data to Workato webhook
export async function sendAppointmentToWebhook(leadId: number, appointmentData?: {
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentType?: string;
  notes?: string;
}) {
  try {
    console.log('Sending appointment to webhook for lead:', leadId);
    
    // Fetch lead data from database
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
    });

    if (!lead) {
      return {
        success: false,
        error: "Lead not found"
      };
    }

    // Map lead data to webhook format
    const webhookData: AppointmentWebhookData = {
      "Lead ID": leadId.toString(),
      "Full Name": lead.full_name ?? "",
      "Mobile Number": lead.phone_number || "",
      "H/P": lead.phone_number || "",
      "Email Address": lead.email ?? "",
      "Loan Amount Applying?": lead.amount ?? "",
      "Monthly Income": lead.employment_salary ?? "",
      "Your Employment Specialisation": lead.employment_status ?? "",
      "Employment Type": lead.employment_status ?? "",
      "What is the purpose of the Loan?": lead.loan_purpose ?? "",
      "Marital Status": "",
      "Place of Residence": lead.residential_status ?? "",
      
      // Appointment specific data
      "Appointment Date": appointmentData?.appointmentDate ?? "",
      "Appointment Time": appointmentData?.appointmentTime ?? "",
      "Appointment Type": appointmentData?.appointmentType ?? "Consultation",
      "Created At": new Date().toISOString(),
      
      // Default values for required fields
      "Manual": "Yes",
      "Reason for manual": "Appointment booking from CRM",
      "Loan Portal Applied": "No",
      "New or Reloan?": "New",
      "Are you a Declared Bankruptcy at the time of this loan application?": "No",
      "**Declaration - 声明 **": "Agreed",
      
      // Fields that might need manual input later
      UW: "",
      RM: "",
      Group: "",
      Code: "",
      "Please choose your nationality or Work Pass": lead.residential_status ?? "",
      "Last 4 digits of the NRIC (including the alphabet)": "",
      "Which year is your bankruptcy discharge?": "",
      "What is your work designation?": "",
      "For how long have you been working in this company?": "",
      "Number of Room HDB Flat": "",
      "How many Moneylender Company do you currently have outstanding loan?": "0",
    };

    // Send to Workato webhook
    const webhookUrl = "https://webhooks.sg.workato.com/webhooks/rest/948768ee-3ac7-4215-b07d-24e2585f7884/new-appointment";
    
    console.log('Sending data to webhook:', webhookData);
    
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
    console.log('Webhook response:', result);

    return {
      success: true,
      message: "Appointment data sent to webhook successfully",
      webhookResponse: result
    };

  } catch (error) {
    console.error('Error sending appointment to webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send appointment to webhook"
    };
  }
}

// Function to send appointment data with custom mapping
export async function sendCustomAppointmentToWebhook(customData: AppointmentWebhookData) {
  try {
    console.log('Sending custom appointment data to webhook');
    
    const webhookUrl = "https://webhooks.sg.workato.com/webhooks/rest/948768ee-3ac7-4215-b07d-24e2585f7884/new-appointment";
    
    // Add timestamp if not provided
    const dataWithTimestamp = {
      ...customData,
      "Created At": customData["Created At"] ?? new Date().toISOString(),
    };
    
    console.log('Sending custom data to webhook:', dataWithTimestamp);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataWithTimestamp),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Webhook response:', result);

    return {
      success: true,
      message: "Custom appointment data sent to webhook successfully",
      webhookResponse: result
    };

  } catch (error) {
    console.error('Error sending custom appointment to webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send custom appointment to webhook"
    };
  }
}

// Function to test the webhook connection
export async function testWebhookConnection() {
  try {
    const testData: AppointmentWebhookData = {
      "Full Name": "Test User",
      "Mobile Number": "12345678",
      "Email Address": "test@example.com",
      "Appointment Date": new Date().toISOString().split('T')[0],
      "Appointment Time": "10:00 AM",
      "Appointment Type": "Test",
      "Lead ID": "0",
      "Created At": new Date().toISOString(),
      "Manual": "Yes",
      "Reason for manual": "Testing webhook connection",
    };

    return await sendCustomAppointmentToWebhook(testData);
  } catch (error) {
    console.error('Error testing webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to test webhook"
    };
  }
} 