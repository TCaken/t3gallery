/* eslint-disable @typescript-eslint/no-unsafe-argument */
'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from "~/server/db";
import { whatsappTemplates, templateVariables, templateUsageLog, leads, users, appointments, borrowers, appointmentReminderLog } from "~/server/db/schema";
import { eq, and, desc, or } from 'drizzle-orm';
import { env } from '~/env';

// Helper to check if we're in staging mode
function isStaging(): boolean {
  return env.NEXT_PUBLIC_ENVIRONMENT !== 'production';
}

// Helper to check if staging phone redirect is configured
function hasStagingPhoneConfigured(): boolean {
  return isStaging() && !!env.STAGING_TEST_PHONE;
}

interface WhatsAppRequest {
  workspaces: string;
  channels: string;
  projectId: string;
  identifierValue: string;
  parameters: Array<{
    type: string;
    key: string;
    value: string;
  }>;
}

interface WhatsAppResponse {
  message?: string;
  [key: string]: unknown;
}

interface TemplateData {
  template: {
    id: number;
    template_id: string;
    name: string;
    workspace_id: string;
    channel_id: string;
    project_id: string;
    supported_methods: string[];
    default_method: string;
  };
  variables: Array<{
    variable_key: string;
    variable_type: string;
    data_source: string;
    default_value: string | null;
    format_pattern: string | null;
    is_required: boolean;
  }>;
}

// Main function to send WhatsApp message using template
export async function sendWhatsAppMessage(
  phone: string, 
  templateDatabaseId: number,
  customParameters: Record<string, string> = {},
  deliveryMethod?: 'sms' | 'whatsapp' | 'both',
  leadId?: number
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    console.log('Attempting to send message with template database ID:', templateDatabaseId);
    
    // Get template configuration from database using the database ID
    const templateData = await getTemplateConfigurationById(templateDatabaseId);
    if (!templateData) {
      return { success: false, error: 'Template not found or inactive' };
    }

    // Use provided delivery method or template default
    const finalDeliveryMethod = deliveryMethod ?? templateData.template.default_method as ('sms' | 'whatsapp' | 'both');
    
    // Validate delivery method is supported
    if (!templateData.template.supported_methods.includes(finalDeliveryMethod)) {
      return { 
        success: false, 
        error: `Delivery method '${finalDeliveryMethod}' not supported by this template` 
      };
    }

    // Get lead or borrower data if leadId provided
    console.log('Entity ID:', leadId);
    let leadData = null;
    let borrowerData = null;
    
    if (leadId) {
      // First try to find as a lead
      const leadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      
      if (leadResult.length > 0) {
        leadData = leadResult[0];
        console.log('📋 Found lead data for ID:', leadId);
      } else {
        // If not found as lead, try as borrower
        const borrowerResult = await db.select().from(borrowers).where(eq(borrowers.id, leadId)).limit(1);
        if (borrowerResult.length > 0) {
          borrowerData = borrowerResult[0];
          console.log('👤 Found borrower data for ID:', leadId);
        }
      }
    }

    // Get user data
    const userData = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userData[0] ?? null;

    // Build parameters from template configuration
    console.log('Template data:', templateData);
    console.log('Lead data:', leadData);
    console.log('Borrower data:', borrowerData);
    console.log('User data:', user);
    console.log('Custom parameters:', customParameters);
  
    const parameters = await buildTemplateParameters(
      templateData.variables, 
      leadData, 
      user, 
      customParameters,
      borrowerData
    );

    // console.log('Built parameters:', parameters);

    // Log the attempt - only include lead_id if it exists
    const formattedPhone = formatPhoneNumber(phone);
    const logValues: any = {
      template_id: templateData.template.id,
      sent_to: formattedPhone,
      delivery_method: finalDeliveryMethod,
      trigger_type: 'manual',
      parameters_used: parameters,
      sent_by: userId,
    };

    if (leadId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      logValues.lead_id = leadId;
    }

    // // Add staging info to parameters if in staging mode
    // if (hasStagingPhoneConfigured() && phone !== formattedPhone) {
    //   logValues.staging_info = {
    //     original_phone: phone,
    //     redirected_to: formattedPhone,
    //     environment: env.NEXT_PUBLIC_ENVIRONMENT
    //   };
    // }

    const logEntry = await db.insert(templateUsageLog).values(logValues).returning();

    const logId = logEntry[0]?.id;

    // Send WhatsApp message if method includes WhatsApp
    if (finalDeliveryMethod === 'whatsapp' || finalDeliveryMethod === 'both') {
      const whatsappData: WhatsAppRequest = {
        workspaces: templateData.template.workspace_id,
        channels: templateData.template.channel_id,
        projectId: templateData.template.project_id,
        identifierValue: formattedPhone,
        parameters: Object.entries(parameters).map(([key, value]) => ({
          type: "string",
          key,
          value: String(value)
        }))
      };

      console.log('WhatsApp request data:', JSON.stringify(whatsappData, null, 2));

      const response = await fetch('https://api.capcfintech.com/api/bird/v2/wa/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.WHATSAPP_API_KEY
        },
        body: JSON.stringify(whatsappData)
      });

      const data = await response.json() as WhatsAppResponse;
      
      // Update log with response
      if (logId) {
        await db.update(templateUsageLog)
          .set({ 
            status: response.ok ? 'sent' : 'failed',
            api_response: data,
            error_message: response.ok ? null : (data.message ?? 'Unknown error')
          })
          .where(eq(templateUsageLog.id, logId));
      }
      
      if (!response.ok) {
        throw new Error(data.message ?? 'Failed to send WhatsApp message');
      }
      
      return { success: true, data, logId };
    }
    
    // Handle SMS-only delivery
    if (finalDeliveryMethod === 'sms') {
      console.log('SMS delivery requested but not implemented yet');
      // Update log for SMS
      if (logId) {
        await db.update(templateUsageLog)
          .set({ 
            status: 'sent',
            error_message: 'SMS delivery logged (not implemented)'
          })
          .where(eq(templateUsageLog.id, logId));
      }
      return { success: true, data: { message: 'SMS delivery logged (not implemented)' }, logId };
    }

    return { success: false, error: 'Invalid delivery method' };
  } catch (error) {
    console.error('Error sending message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Function to send auto-triggered messages based on status change
export async function sendAutoTriggeredMessage(
  leadId: number,
  newStatus: string,
  phone: string
) {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: 'Not authenticated' };

    // Determine customer type by checking if this is a lead or borrower
    let customerType: 'new' | 'reloan' = 'new'; // Default to new
    
    // First check if it's a lead
    const leadResult = await db.select({ lead_type: leads.lead_type })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (leadResult.length > 0) {
      // It's a lead - use lead_type to determine customer type
      customerType = leadResult[0]!.lead_type === 'reloan' ? 'reloan' : 'new';
      console.log(`📋 Lead ${leadId}: lead_type="${leadResult[0]!.lead_type}" → customer_type="${customerType}"`);
    } else {
      // Check if it's a borrower (existing customers are always reloan type)
      const borrowerResult = await db.select({ id: borrowers.id })
        .from(borrowers)
        .where(eq(borrowers.id, leadId))
        .limit(1);
      
      if (borrowerResult.length > 0) {
        customerType = 'reloan'; // Borrowers are always reloan customers
        console.log(`👥 Borrower ${leadId}: customer_type="${customerType}"`);
      }
    }

    console.log(`🎯 Auto-trigger search: status="${newStatus}", customer_type="${customerType}"`);

    // Find templates that auto-trigger on this status AND match customer type
    const templates = await db.select({
      id: whatsappTemplates.id,
      template_id: whatsappTemplates.template_id,
      name: whatsappTemplates.name,
      workspace_id: whatsappTemplates.workspace_id,
      channel_id: whatsappTemplates.channel_id,
      project_id: whatsappTemplates.project_id,
      customer_type: whatsappTemplates.customer_type,
      supported_methods: whatsappTemplates.supported_methods,
      default_method: whatsappTemplates.default_method,
      trigger_on_status: whatsappTemplates.trigger_on_status,
    })
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.is_active, true),
        eq(whatsappTemplates.auto_send, true),
        eq(whatsappTemplates.customer_type, customerType) // Filter by customer type
      )
    );

    const applicableTemplates = templates.filter(template => {
      const triggerStatuses = template.trigger_on_status as string[];
      return triggerStatuses?.includes(newStatus);
    });

    if (applicableTemplates.length === 0) {
      return { success: true, message: 'No auto-trigger templates found for this status' };
    }

    const results = [];
    for (const template of applicableTemplates) {
      console.log('Sending auto-trigger template:', template.name);
      try {
        const result = await sendWhatsAppMessage(
          phone,
          template.id,
          {},
          template.default_method as ('sms' | 'whatsapp' | 'both'),
          leadId
        );
        
        // Update the log entry to mark as auto-triggered
        if (result.success && result.logId) {
          await db.update(templateUsageLog)
            .set({ trigger_type: 'auto_status_change' })
            .where(eq(templateUsageLog.id, result.logId));
        }
        
        results.push({ templateId: template.template_id, result });
      } catch (error) {
        console.error(`Error sending auto-trigger template ${template.template_id}:`, error);
        results.push({ 
          templateId: template.template_id, 
          result: { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error('Error in sendAutoTriggeredMessage:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Ascend Appointment Reminder - Send hardcoded template
export async function ascendAppointmentReminder(
  customerName: string,
  phoneNumber: string,
  appointmentDate: string,
  timeSlot: string,
  app = 'unknown' // Who is requesting this reminder
) {
  try {
    console.log('🔔 Sending Ascend appointment reminder:', {
      customerName,
      phoneNumber,
      appointmentDate,
      timeSlot,
      app
    });

    // Hardcoded template configuration based on your provided structure
    const workspaceId = "976e3394-ae10-4b32-9a23-8ecf78da9fe7";
    const channelId = "36f8cbb8-4397-48b5-a9d7-0036ba9c2c77";
    const projectId = "20144ad5-88f2-4336-be9e-9c30b2c0a89b";

    // Format phone number early for use in both data and logging
    const formattedPhone = formatPhoneNumber(phoneNumber);

    const whatsappData: WhatsAppRequest = {
      workspaces: workspaceId,
      channels: channelId,
      projectId: projectId,
      identifierValue: formattedPhone,
      parameters: [
        { type: "string", key: "customer_name", value: customerName },
        { type: "string", key: "appt_date", value: appointmentDate },
        { type: "string", key: "time_slot", value: timeSlot }
      ]
    };

    // Log the attempt to database first
    const logEntry = await db.insert(appointmentReminderLog).values({
      customer_name: customerName,
      phone_number: phoneNumber,
      appointment_date: appointmentDate,
      time_slot: timeSlot,
      app: app,
      status: 'pending',
      workspace_id: workspaceId,
      channel_id: channelId,
      project_id: projectId,
      // Add original phone for staging tracking
      ...(hasStagingPhoneConfigured() && phoneNumber !== formattedPhone && {
        original_phone_number: phoneNumber,
        staging_redirect: true
      })
    }).returning();

    const logId = logEntry[0]?.id;

    console.log('📱 WhatsApp request data:', JSON.stringify(whatsappData, null, 2));

    // Send the WhatsApp message
    const response = await fetch('https://api.capcfintech.com/api/bird/v2/wa/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.WHATSAPP_API_KEY
      },
      body: JSON.stringify(whatsappData)
    });

    const data = await response.json() as WhatsAppResponse;
    
    console.log('📬 WhatsApp API response:', data);

    // Update log with response
    if (logId) {
      await db.update(appointmentReminderLog)
        .set({ 
          status: response.ok ? 'sent' : 'failed',
          api_response: data,
          error_message: response.ok ? null : (data.message ?? 'Unknown error')
        })
        .where(eq(appointmentReminderLog.id, logId));
    }

    if (!response.ok) {
      throw new Error(data.message ?? 'Failed to send WhatsApp appointment reminder');
    }

    return { 
      success: true, 
      data,
      message: `Appointment reminder sent to ${customerName} at ${phoneNumber}`,
      logId: logId
    };
    
  } catch (error) {
    console.error('❌ Error sending Ascend appointment reminder:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get template configuration from database by ID
async function getTemplateConfigurationById(templateDatabaseId: number): Promise<TemplateData | null> {
  try {
    const templates = await db.select()
      .from(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.id, templateDatabaseId),
          eq(whatsappTemplates.is_active, true)
        )
      )
      .limit(1);

    if (templates.length === 0) return null;

    const template = templates[0]!;

    const variables = await db.select()
      .from(templateVariables)
      .where(eq(templateVariables.template_id, template.id));

    return {
      template: {
        id: template.id,
        template_id: template.template_id,
        name: template.name,
        workspace_id: template.workspace_id,
        channel_id: template.channel_id,
        project_id: template.project_id,
        supported_methods: template.supported_methods as string[],
        default_method: template.default_method ?? 'whatsapp',
      },
      variables: variables.map(v => ({
        variable_key: v.variable_key,
        variable_type: v.variable_type ?? 'string',
        data_source: v.data_source,
        default_value: v.default_value,
        format_pattern: v.format_pattern,
        is_required: v.is_required ?? true,
      }))
    };
  } catch (error) {
    console.error('Error getting template configuration by ID:', error);
    return null;
  }
}

// Get template configuration from database
async function getTemplateConfiguration(templateId: string): Promise<TemplateData | null> {
  try {
    const templates = await db.select()
      .from(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.template_id, templateId),
          eq(whatsappTemplates.is_active, true)
        )
      )
      .limit(1);

    if (templates.length === 0) return null;

    const template = templates[0]!;

    const variables = await db.select()
      .from(templateVariables)
      .where(eq(templateVariables.template_id, template.id));

    return {
      template: {
        id: template.id,
        template_id: template.template_id,
        name: template.name,
        workspace_id: template.workspace_id,
        channel_id: template.channel_id,
        project_id: template.project_id,
        supported_methods: template.supported_methods as string[],
        default_method: template.default_method,
      },
      variables: variables.map(v => ({
        variable_key: v.variable_key,
        variable_type: v.variable_type ?? 'string',
        data_source: v.data_source,
        default_value: v.default_value,
        format_pattern: v.format_pattern,
        is_required: v.is_required ?? true,
      }))
    };
  } catch (error) {
    console.error('Error getting template configuration:', error);
    return null;
  }
}

// Build parameters from template variables and data sources
async function buildTemplateParameters(
  variables: TemplateData['variables'],
  leadData: any,
  userData: any,
  customParameters: Record<string, string>,
  borrowerData?: any // Add borrower data support
): Promise<Record<string, string>> {
  const parameters: Record<string, string> = {};

  // Get appointment data if we have lead or borrower data
  let appointmentData = null;
  const entityId = leadData?.id ?? borrowerData?.id;
  const entityType = leadData ? 'lead' : borrowerData ? 'borrower' : null;
  
  console.log(`🔄 Building template parameters for ${entityType} ${entityId}`);
  console.log('Lead data:', leadData);
  console.log('Borrower data:', borrowerData);
  
  if (entityId) {
    if (entityType === 'lead') {
      appointmentData = await getAppointmentDataForLead(entityId);
    } else if (entityType === 'borrower') {
      // Get borrower appointment data
      appointmentData = await getBorrowerAppointmentData(entityId);
    }
  }

  console.log('Appointment data:', appointmentData);

  for (const variable of variables) {
    let value = customParameters[variable.variable_key];

    if (!value) {
      value = extractValueFromDataSource(variable.data_source, leadData, userData, appointmentData, borrowerData);
    }

    if (!value && variable.default_value) {
      value = variable.default_value;
    }

    if (!value && variable.is_required) {
      console.warn(`Required variable ${variable.variable_key} has no value`);
      value = `[${variable.variable_key}]`; // Placeholder for missing required values
    }

    if (value) {
      // Apply formatting if specified
      if (variable.format_pattern && variable.variable_type === 'date') {
        value = formatDate(value, variable.format_pattern);
      }
      parameters[variable.variable_key] = value;
    }
  }

  return parameters;
}

// Extract value from data source string (e.g., "lead.full_name", "borrower.full_name", "user.email", "system.date", "appointment.booked_date")
function extractValueFromDataSource(
  dataSource: string, 
  leadData: any, 
  userData: any,
  appointmentData?: { booked: any; missed: any; latest: any } | null,
  borrowerData?: any
): string | null {
  const parts = dataSource.split('.');
  if (parts.length !== 2) return null;
  
  const [source, field] = parts;
  
  if (!source || !field) return null; // Handle undefined parts

  switch (source) {
    case 'lead':
      return leadData?.[field] ?? null;
    case 'borrower':
      return borrowerData?.[field] ?? null;
    case 'user':
      return userData?.[field] ?? null;
    case 'appointment':
      return extractAppointmentValue(field, appointmentData);
    case 'system':
      switch (field) {
        case 'date':
          return new Date().toISOString().split('T')[0] ?? null;
        case 'datetime':
          return new Date().toISOString();
        case 'time':
          return new Date().toTimeString().split(' ')[0] ?? null;
        default:
          return null;
      }
    default:
      return null;
  }
}

// Extract appointment-related values
function extractAppointmentValue(
  field: string, 
  appointmentData?: { booked: any; missed: any; latest: any } | null
): string | null {
  if (!appointmentData) {
    // Return fallback message for missing appointment data
    if (field.includes('booked') || field.includes('missed') || field.includes('latest')) {
      return "Please check with your agent via chat for appointment details";
    }
    return null;
  }

  const formatDateTime = (datetime: Date | string | null, format: 'date' | 'time' | 'datetime'): string | null => {
    if (!datetime) return null;
    
    try {
      const date = new Date(datetime);
      if (isNaN(date.getTime())) return null;
      
      // Convert to Singapore time (UTC+8)
      const singaporeTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
      
      switch (format) {
        case 'date':
          return singaporeTime.toISOString().split('T')[0] ?? null; // YYYY-MM-DD format
        case 'time':
          // Format time as HH:MM in 24-hour format for Singapore
          const timeString = singaporeTime.toISOString().split('T')[1]?.split('.')[0];
          return timeString ? timeString.substring(0, 5) : null; // HH:MM format
        case 'datetime':
          // Format as YYYY-MM-DD HH:MM (Singapore time)
          const dateString = singaporeTime.toISOString().split('T')[0];
          const timeStr = singaporeTime.toISOString().split('T')[1]?.split('.')[0]?.substring(0, 5);
          return dateString && timeStr ? `${dateString} ${timeStr}` : null;
        default:
          return null;
      }
    } catch {
      return null;
    }
  };

  switch (field) {
    // Booked appointment (upcoming or done)
    case 'booked_date':
      return appointmentData.booked?.start_datetime 
        ? formatDateTime(appointmentData.booked.start_datetime, 'date')
        : "No appointment date";
    case 'booked_time':
      return appointmentData.booked?.start_datetime 
        ? formatDateTime(appointmentData.booked.start_datetime, 'time')
        : "No appointment time";
    case 'booked_datetime':
      return appointmentData.booked?.start_datetime 
        ? formatDateTime(appointmentData.booked.start_datetime, 'datetime')
        : "No appointment date and time";

    // Missed appointment (cancelled or missed)
    case 'missed_date':
      return appointmentData.missed?.start_datetime 
        ? formatDateTime(appointmentData.missed.start_datetime, 'date')
        : "No missed appointment date";
    case 'missed_time':
      return appointmentData.missed?.start_datetime 
        ? formatDateTime(appointmentData.missed.start_datetime, 'time')
        : "No missed appointment time";
    case 'missed_datetime':
      return appointmentData.missed?.start_datetime 
        ? formatDateTime(appointmentData.missed.start_datetime, 'datetime')
        : "No missed appointment date and time";

    // Latest appointment (any status)
    case 'latest_date':
      return appointmentData.latest?.start_datetime 
        ? formatDateTime(appointmentData.latest.start_datetime, 'date')
        : "No appointment date";
    case 'latest_time':
      return appointmentData.latest?.start_datetime 
        ? formatDateTime(appointmentData.latest.start_datetime, 'time')
        : "No appointment time";
    case 'latest_datetime':
      return appointmentData.latest?.start_datetime 
        ? formatDateTime(appointmentData.latest.start_datetime, 'datetime')
        : "No appointment date and time";
    case 'latest_status':
      return appointmentData.latest?.status ?? "No appointment";

    default:
      return null;
  }
}

// Format date according to pattern
function formatDate(dateValue: string, pattern: string): string {
  try {
    const date = new Date(dateValue);
    // Simple patterns - extend as needed
    switch (pattern) {
      case 'YYYY-MM-DD':
        return date.toISOString().split('T')[0]!;
      case 'DD/MM/YYYY':
        return date.toLocaleDateString('en-GB');
      case 'MM/DD/YYYY':
        return date.toLocaleDateString('en-US');
      default:
        return dateValue;
    }
  } catch {
    return dateValue;
  }
}

// Helper to format phone number with environment-specific routing
function formatPhoneNumber(phone: string): string {
  // In non-production environments, route all messages to staging test phone if configured
  if (hasStagingPhoneConfigured()) {
    console.log(`🧪 STAGING MODE (${process.env.NEXT_PUBLIC_ENVIRONMENT}): Redirecting message from ${phone} to test number ${env.STAGING_TEST_PHONE}`);
    return formatPhoneNumberInternal(process.env.STAGING_TEST_PHONE!);
  }
  
  return formatPhoneNumberInternal(phone);
}

// Internal phone formatting logic
function formatPhoneNumberInternal(phone: string): string {
  // Strip any non-numeric characters
  const digits = phone.replace(/\D/g, '');
  
  // Ensure phone has country code
  if (digits.startsWith('65')) {
    return `+${digits}`;
  } else if (!digits.startsWith('+')) {
    return `+65${digits}`;
  }
  
  return phone;
}

// Get appointment data for a lead
async function getAppointmentDataForLead(leadId: number) {
  try {
    // Get the latest booked appointment (upcoming or done)
    const bookedAppointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.lead_id, leadId),
        or(
          eq(appointments.status, 'upcoming'),
          eq(appointments.status, 'done')
        )
      ),
      orderBy: [desc(appointments.created_at)]
    });

    // Get the latest missed appointment (cancelled or missed)
    const missedAppointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.lead_id, leadId),
        or(
          eq(appointments.status, 'cancelled'),
          eq(appointments.status, 'missed')
        )
      ),
      orderBy: [desc(appointments.created_at)]
    });

    // Get the latest appointment regardless of status
    const latestAppointment = await db.query.appointments.findFirst({
      where: eq(appointments.lead_id, leadId),
      orderBy: [desc(appointments.created_at)]
    });

    return {
      booked: bookedAppointment,
      missed: missedAppointment,
      latest: latestAppointment
    };
  } catch (error) {
    console.error('Error fetching appointment data for lead:', error);
    return {
      booked: null,
      missed: null,
      latest: null
    };
  }
}

// Get appointment data for a borrower
async function getBorrowerAppointmentData(borrowerId: number) {
  try {
    // Import borrower_appointments here to avoid circular dependency
    const { borrower_appointments } = await import('~/server/db/schema');
    
    // Get the latest booked appointment (upcoming or done)
    const bookedAppointment = await db.query.borrower_appointments.findFirst({
      where: and(
        eq(borrower_appointments.borrower_id, borrowerId),
        or(
          eq(borrower_appointments.status, 'upcoming'),
          eq(borrower_appointments.status, 'done')
        )
      ),
      orderBy: [desc(borrower_appointments.created_at)]
    });

    // Get the latest missed appointment (cancelled or missed)
    const missedAppointment = await db.query.borrower_appointments.findFirst({
      where: and(
        eq(borrower_appointments.borrower_id, borrowerId),
        or(
          eq(borrower_appointments.status, 'cancelled'),
          eq(borrower_appointments.status, 'missed')
        )
      ),
      orderBy: [desc(borrower_appointments.created_at)]
    });

    // Get the latest appointment regardless of status
    const latestAppointment = await db.query.borrower_appointments.findFirst({
      where: eq(borrower_appointments.borrower_id, borrowerId),
      orderBy: [desc(borrower_appointments.created_at)]
    });

    return {
      booked: bookedAppointment,
      missed: missedAppointment,
      latest: latestAppointment
    };
  } catch (error) {
    console.error('Error fetching appointment data for borrower:', error);
    return {
      booked: null,
      missed: null,
      latest: null
    };
  }
}

// Get all available templates for UI (optionally filtered by customer type)
export async function getAvailableTemplates(customerType?: 'reloan' | 'new') {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: 'Not authenticated' };

    const query = db.select({
      id: whatsappTemplates.id,
      template_id: whatsappTemplates.template_id,
      name: whatsappTemplates.name,
      description: whatsappTemplates.description,
      customer_type: whatsappTemplates.customer_type,
      supported_methods: whatsappTemplates.supported_methods,
      default_method: whatsappTemplates.default_method,
      trigger_on_status: whatsappTemplates.trigger_on_status,
      auto_send: whatsappTemplates.auto_send,
    })
    .from(whatsappTemplates);

    // Apply filters
    const conditions = [eq(whatsappTemplates.is_active, true)];
    if (customerType) {
      conditions.push(eq(whatsappTemplates.customer_type, customerType));
    }

    const templates = await query.where(and(...conditions));

    return { success: true, templates };
  } catch (error) {
    console.error('Error fetching templates:', error);
    return { success: false, error: 'Failed to fetch templates' };
  }
}

// Legacy function for backward compatibility - remove after migration
function getTemplateData(templateId: string, phone: string): WhatsAppRequest {
  const phoneNumber = phone ? formatPhoneNumber(phone) : '+6583992504';
  
  return {
    workspaces: "976e3394-ae10-4b32-9a23-8ecf78da9fe7",
    channels: "8d8c5cd0-e776-5d80-b223-435bd0536927",
    projectId: "ec4f6834-806c-47eb-838b-bc72004f8cca",
    identifierValue: "6583992504", //phoneNumber,
    parameters: [
      {
        "type": "string", 
        "key": "Date", 
        "value": new Date().toISOString().split('T')[0] ?? '2023-01-01'
      },
      {
        "type": "string", "key": "Account_ID", "value": "222972"
      },
      {
        "type": "string", "key": "Loan_Balance", "value": "615.24"
      }
    ]
  };
} 