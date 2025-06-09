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

    // Helper function to format date as DD-MM-YYYY
    const formatAppointmentDate = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      } catch {
        return dateStr;
      }
    };

    // Helper function to mask phone number
    const maskPhoneNumber = (phone: string) => {
      if (!phone) return "";
      // Remove any non-digits and get last 4 digits
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length >= 5) {
        const lastFive = cleaned.slice(-5);
        return `***${lastFive}`;
      }
      return phone;
    };

    // Helper function to map source to loan portal
    const mapSourceToLoanPortal = (source: string) => {
      const mapping: Record<string, string> = {
        "SEO": "SEO",
        "SEM": "SEM", 
        "1% Loan": "1%",
        "1% Carousell": "1% Carousell",
        "Cashlender": "Cashlender", 
        "EZcredit": "EZcredit",
        "Lendela": "Lendela",
        "L.E": "L.E",
        "L.A": "L.A", 
        "MoneyRight": "M.R",
        "OMY.sg": "OMY",
        "LendingPot": "LDP",
        "ROSHI": "ROSHI",
        "Loanable": "L.A", // Assuming Loanable maps to L.A
        "MoneyIQ": "L.E", // Assuming MoneyIQ maps to L.E
        "Other": ""
      };
      return mapping[source ?? ""] ?? source ?? "";
    };

    // Format the lead name with (NEW) suffix
    const formattedName = lead.full_name ? `${lead.full_name.toUpperCase()}` : "";
    const cleanPhoneNumber = lead.phone_number?.replace(/^\+65/, '') ?? "";
    const maskedPhone = maskPhoneNumber(lead.phone_number ?? "");

    // Map lead data to webhook format
    const webhookData: AppointmentWebhookData = {
      "Lead ID": leadId.toString(),
      "Full Name": formattedName,
      "Mobile Number": cleanPhoneNumber,
      "H/P": maskedPhone,
      "Email Address": lead.email ?? "",
      "Loan Amount Applying?": lead.amount ?? "",
      "Monthly Income": lead.employment_salary ?? "",
      "Your Employment Specialisation": lead.employment_status ?? "",
      "Employment Type": lead.employment_status ?? "",
      "What is the purpose of the Loan?": "New Loan - 新贷款",
      "Marital Status": "", // marital_status field doesn't exist in schema
      "Place of Residence": lead.residential_status ?? "",
      
      // Appointment specific data  
      "Appointment Date": appointmentData?.appointmentDate ? formatAppointmentDate(appointmentData.appointmentDate) : "",
      "Appointment Time": appointmentData?.appointmentTime ?? "",
      "Appointment Type": appointmentData?.appointmentType ?? "Consultation",
      "Created At": formatAppointmentDate(new Date().toISOString()),
      
      // Default values for required fields
      "Manual": "Yes",
      "Reason for manual": "Appointment booking from CRM",
      "Loan Portal Applied": mapSourceToLoanPortal(lead.source ?? ""),
      "New or Reloan?": "New Loan - 新贷款",
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
      "What is your work designation?": lead.employment_status ?? "",
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
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    
    const testData: AppointmentWebhookData = {
      "Full Name": "TEST USER (NEW)",
      "Mobile Number": "91234567",
      "H/P": "***4567",
      "Email Address": "test@example.com",
      "Appointment Date": formattedDate,
      "Appointment Time": "10:00:00",
      "Appointment Type": "Consultation",
      "Lead ID": "0",
      "Created At": formattedDate,
      "Manual": "Yes",
      "Reason for manual": "Testing webhook connection",
      "Loan Portal Applied": "SEO",
      "New or Reloan?": "New Loan - 新贷款",
      "What is the purpose of the Loan?": "New Loan - 新贷款",
      "Are you a Declared Bankruptcy at the time of this loan application?": "No",
      "**Declaration - 声明 **": "Agreed",
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