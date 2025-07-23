'use server';

import { 
  createAppointmentWorkflow,
  updateLeadStatusWorkflow,
  cancelAppointmentWorkflow,
  completeAppointmentWorkflow,
  followUpWorkflow,
  noAnswerWorkflow,
  sendManualWhatsAppWorkflow
} from './transactionOrchestrator';
import { ascendAppointmentReminder } from './whatsappActions';

/**
 * CLIENT USAGE EXAMPLES
 * 
 * These show how the client/frontend would call the orchestrator
 * instead of calling individual actions directly.
 */

/**
 * Example 1: Client wants to book an appointment
 * Instead of: createAppointment() + updateLead() + sendWhatsApp()
 * They call: createAppointmentWorkflow()
 */
export async function bookAppointmentExample(
  leadId: number, 
  timeslotId: number, 
  notes: string,
  phone: string
) {
  // Single call that coordinates multiple actions
  const result = await createAppointmentWorkflow({
    leadId,
    timeslotId,
    notes,
    isUrgent: false,
    phone
  });

  // Client gets comprehensive result
  if (result.success) {
    console.log('✅ Appointment booked successfully');
    console.log(`Executed ${result.results.length} actions:`);
    result.results.forEach(r => {
      console.log(`- ${r.action}: ${r.success ? 'SUCCESS' : 'FAILED'}`);
    });
  } else {
    console.log('❌ Booking failed:', result.error);
    if (result.rollbackAttempted) {
      console.log('🔄 Rollback attempted');
    }
  }

  return result;
}

/**
 * Example 2: Client wants to mark lead as "no answer" with notification
 */
export async function markNoAnswerExample(leadId: number, phone: string, notes?: string) {
  const result = await noAnswerWorkflow({
    leadId,
    phone,
    notes
  });

  if (result.success) {
    console.log('✅ Lead marked as no answer and notification sent');
  } else {
    console.log('❌ Failed to process no answer:', result.error);
  }

  return result;
}

/**
 * Example 3: Client wants to cancel appointment with notification
 */
export async function cancelAppointmentExample(
  appointmentId: number, 
  leadId: number, 
  phone: string
) {
  const result = await cancelAppointmentWorkflow({
    appointmentId,
    leadId,
    phone,
    sendNotification: true
  });

  return result;
}

/**
 * Example 4: Client wants to complete appointment workflow
 */
export async function completeAppointmentExample(
  appointmentId: number,
  leadId: number,
  phone: string
) {
  const result = await completeAppointmentWorkflow({
    appointmentId,
    leadId,
    phone
  });

  return result;
}

/**
 * Example 5: Custom workflow - update lead with multiple fields
 */
export async function updateLeadWithNotificationExample(
  leadId: number,
  newStatus: string,
  phone: string,
  additionalNotes?: string
) {
  const result = await updateLeadStatusWorkflow({
    leadId,
    status: newStatus,
    updates: additionalNotes ? { notes: additionalNotes } : undefined,
    phone,
    sendNotification: true
  });

  return result;
}

/**
 * Example 6: Manual WhatsApp sending
 */
export async function sendManualWhatsAppExample(
  phone: string,
  templateDatabaseId: number,
  parameters?: Record<string, string>
) {
  const result = await sendManualWhatsAppWorkflow({
    phone,
    templateDatabaseId,
    parameters,
    deliveryMethod: 'whatsapp'
  });

  if (result.success) {
    console.log('✅ Manual WhatsApp sent successfully');
    console.log('Message result:', result.results[0]?.result?.data);
  } else {
    console.log('❌ Failed to send WhatsApp:', result.error);
  }

  return result;
}

/**
 * Example 7: Send Ascend Appointment Reminder
 */
export async function sendAscendAppointmentReminderExample(
  customerName: string,
  phoneNumber: string,
  appointmentDate: string,
  timeSlot: string,
  app: string = 'workflow-example'
) {
  console.log('📬 Sending Ascend appointment reminder...');
  
  const result = await ascendAppointmentReminder(
    customerName,
    phoneNumber,
    appointmentDate,
    timeSlot,
    app
  );

  if (result.success) {
    console.log('✅ Ascend appointment reminder sent successfully');
    console.log('Message:', result.message);
    console.log('Log ID:', result.logId);
    console.log('API Response:', result.data);
  } else {
    console.log('❌ Failed to send Ascend appointment reminder:', result.error);
  }

  return result;
}

/**
 * REAL WORLD EXAMPLE: How the appointment page now works
 */
export async function realWorldAppointmentBooking(
  leadId: number,
  timeslotId: number,
  notes: string,
  leadPhoneNumber: string
) {
  // Before: Client had to coordinate multiple actions manually
  // Now: Single orchestrated call handles everything
  
  const result = await createAppointmentWorkflow({
    leadId,
    timeslotId,
    notes,
    isUrgent: false,
    phone: leadPhoneNumber
  });

  // The orchestrator automatically:
  // 1. Creates the appointment (manages timeslot capacity)
  // 2. Updates lead status to 'booked' (which automatically triggers WhatsApp via updateLead)
  // 3. Handles rollback if any step fails
  // Note: WhatsApp sending is built into updateLead, so no separate WhatsApp action needed

  if (result.success) {
    console.log('✅ Complete appointment workflow succeeded');
    console.log(`Actions completed: ${result.results.length}`);
    
    // Each action result is available for detailed analysis
    result.results.forEach((actionResult, index) => {
      console.log(`${index + 1}. ${actionResult.action}: ${actionResult.success ? 'SUCCESS' : 'FAILED'}`);
      if (actionResult.result?.data) {
        console.log('   Data:', actionResult.result.data);
      }
    });
    
    return { success: true, message: 'Appointment booked successfully' };
  } else {
    console.error('❌ Appointment workflow failed:', result.error);
    
    if (result.rollbackAttempted) {
      console.log('🔄 System attempted to rollback changes');
    }
    
    // Show which specific action failed
    const failedAction = result.results.find(r => !r.success);
    if (failedAction) {
      console.log(`Failed at: ${failedAction.action}`);
    }
    
    return { success: false, error: result.error };
  }
}

/**
 * ARCHITECTURE BENEFITS:
 * 
 * 🎯 Client Benefits:
 * - Single function call for complex workflows
 * - Automatic error handling and rollback
 * - Consistent result format
 * - No need to coordinate multiple actions
 * 
 * 🔧 Developer Benefits:
 * - Orchestrator handles coordination logic
 * - Individual actions stay focused on business logic
 * - Easy to add new workflows
 * - Clear separation of concerns
 * 
 * 📊 Operational Benefits:
 * - Comprehensive logging of what succeeded/failed
 * - Rollback attempts for data consistency
 * - Better observability of complex operations
 */ 