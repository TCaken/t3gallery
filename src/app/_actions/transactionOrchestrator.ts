'use server';

import { auth } from "@clerk/nextjs/server";

// Import existing actions
import { createAppointment, cancelAppointment, updateAppointmentStatus } from "./appointmentAction";
import { updateLead } from "./leadActions";
import { sendAutoTriggeredMessage, sendWhatsAppMessage } from "./whatsappActions";

// Import types from separate file (can't export types from 'use server' files)
import type { ActionResult, OrchestrationResult } from "./types";
import { TransactionCoordinator } from "./types";

// High-level workflow functions that coordinate multiple actions

/**
 * Create appointment with lead update and WhatsApp notification
 */
export async function createAppointmentWorkflow(data: {
  leadId: number;
  timeslotId: number;
  notes: string;
  isUrgent: boolean;
  phone: string;
}) {
  const { userId } = await auth();
  if (!userId) {
    return { 
      success: false, 
      error: 'Not authenticated',
      results: []
    };
  }

  const coordinator = new TransactionCoordinator();
  
  const actions = [
    // 1. Create the appointment (without updating lead status)
    async (): Promise<ActionResult> => {
      const result = await createAppointment({
        leadId: data.leadId,
        timeslotId: data.timeslotId,
        notes: data.notes,
        isUrgent: data.isUrgent
      });
      
      return {
        success: result.success,
        message: result.success ? 'Appointment created successfully' : undefined,
        error: result.success ? undefined : ('message' in result ? result.message : 'Failed to create appointment'),
        data: result.success && 'appointment' in result ? { appointment: result.appointment } : undefined
      };
    },
    
    // 2. Update lead status to 'booked' (this automatically triggers WhatsApp notification)
    async (): Promise<ActionResult> => {
      const result = await updateLead(data.leadId, {
        status: 'booked'
      });
      
      return {
        success: result.success,
        message: result.success ? 'Lead status updated and notification sent' : undefined,
        error: result.success ? undefined : result.message,
        data: { lead: result.lead }
      };
    }
  ];
  
  return await coordinator.execute(actions, ['createAppointment', 'updateLeadStatus']);
}

/**
 * Update lead status with optional WhatsApp notification
 */
export async function updateLeadStatusWorkflow(data: {
  leadId: number;
  status: string;
  updates?: Record<string, string | number | Date | boolean | null | undefined>;
  phone?: string;
  sendNotification?: boolean;
}) {
  const coordinator = new TransactionCoordinator();
  
  const actions: Array<() => Promise<ActionResult>> = [
    // Update the lead (this automatically triggers WhatsApp if status changes)
    async (): Promise<ActionResult> => {
      const result = await updateLead(data.leadId, {
        status: data.status,
        ...data.updates
      });
      return {
        success: result.success,
        message: result.success ? result.message : undefined,
        error: result.success ? undefined : (result.message ?? 'Failed to update lead'),
        data: { lead: result.lead }
      };
    }
  ];
  
  const actionNames = ['updateLead'];
  
  // Note: WhatsApp notification is automatically handled by updateLead when status changes
  // No need for separate WhatsApp action
  
  return await coordinator.execute(actions, actionNames);
}

/**
 * Cancel appointment with lead status update and notification
 */
export async function cancelAppointmentWorkflow(data: {
  appointmentId: number;
  leadId: number;
  phone?: string;
  sendNotification?: boolean;
}) {
  const coordinator = new TransactionCoordinator();
  
  const actions: Array<() => Promise<ActionResult>> = [
    // Cancel the appointment (this also updates lead status automatically)
    async (): Promise<ActionResult> => {
      const result = await cancelAppointment(data.appointmentId);
      return {
        success: result.success,
        message: result.success ? result.message : undefined,
        error: result.success ? undefined : result.message,
        data: {}
      };
    }
  ];
  
  const actionNames = ['cancelAppointment'];
  
  // Note: Lead status update and WhatsApp notification should be handled by cancelAppointment
  // If we need separate notification, we would use updateLead afterwards
  
  return await coordinator.execute(actions, actionNames);
}

/**
 * Complete appointment workflow (mark as done + send completion message)
 */
export async function completeAppointmentWorkflow(data: {
  appointmentId: number;
  leadId: number;
  phone?: string;
}) {
  const coordinator = new TransactionCoordinator();
  
  const actions: Array<() => Promise<ActionResult>> = [
    // Update appointment status to 'done' (this also updates lead status automatically)
    async (): Promise<ActionResult> => {
      const result = await updateAppointmentStatus(data.appointmentId, 'done');
      return {
        success: result.success,
        message: result.success ? result.message : undefined,
        error: result.success ? undefined : result.message,
        data: {}
      };
    }
  ];
  
  const actionNames = ['updateAppointmentStatus'];
  
  // Note: Lead status update and WhatsApp notification should be handled by updateAppointmentStatus
  // If we need additional notification, we would use updateLead afterwards
  
  return await coordinator.execute(actions, actionNames);
}

/**
 * Follow-up workflow (update lead to follow_up + send WhatsApp)
 */
export async function followUpWorkflow(data: {
  leadId: number;
  notes?: string;
  phone: string;
}) {
  return await updateLeadStatusWorkflow({
    leadId: data.leadId,
    status: 'follow_up',
    updates: data.notes ? { notes: data.notes } : undefined,
    phone: data.phone,
    sendNotification: true
  });
}

/**
 * No answer workflow (update lead to no_answer + send WhatsApp)
 */
export async function noAnswerWorkflow(data: {
  leadId: number;
  notes?: string;
  phone: string;
}) {
  return await updateLeadStatusWorkflow({
    leadId: data.leadId,
    status: 'no_answer',
    updates: data.notes ? { notes: data.notes } : undefined,
    phone: data.phone,
    sendNotification: true
  });
}

/**
 * Manual WhatsApp workflow (send template only)
 */
export async function sendManualWhatsAppWorkflow(data: {
  phone: string;
  templateDatabaseId: number;
  parameters?: Record<string, string>;
  deliveryMethod?: 'sms' | 'whatsapp' | 'both';
}) {
  const { userId } = await auth();
  if (!userId) {
    return { 
      success: false, 
      error: 'Not authenticated',
      results: []
    };
  }

  const coordinator = new TransactionCoordinator();
  
  const actions: Array<() => Promise<ActionResult>> = [
    // Send WhatsApp message
    async (): Promise<ActionResult> => {
      const result = await sendWhatsAppMessage(
        data.phone,
        data.templateDatabaseId,
        data.parameters ?? {},
        data.deliveryMethod ?? 'whatsapp'
      );
      
      return {
        success: result.success,
        message: result.success ? 'WhatsApp message sent successfully' : undefined,
        error: result.success ? undefined : result.error,
        data: { messageResult: result }
      };
    }
  ];
  
  const actionNames = ['sendWhatsAppMessage'];
  
  return await coordinator.execute(actions, actionNames);
} 