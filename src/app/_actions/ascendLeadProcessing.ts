import { db } from "~/server/db";
import { leads } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { checkLeadEligibility } from "./leadEligibility";
import { createLead } from "./leadActions";

// Singapore phone number formatting function
const formatSGPhoneNumber = (phone: string) => {
  // Remove all non-digit characters except '+'
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with +65, return as is
  if (cleaned.startsWith('+65')) {
    return cleaned;
  }
  
  // If it starts with 65, add the +
  if (cleaned.startsWith('65') && cleaned.length === 10) {
    return '+' + cleaned;
  }
  
  // If it's 8 digits, assume Singapore number
  if (cleaned.length === 8 && /^[8-9]/.test(cleaned)) {
    return '+65' + cleaned;
  }
  
  return cleaned;
};

interface LeadProcessingResult {
  success: boolean;
  message: string;
  data?: {
    leadId?: number;
    leadType: 'new' | 'reloan' | 'duplicate';
    ascendStatus: string;
    airconnectLink?: string;
    eligibilityResult?: unknown;
    note?: string;
  };
  error?: string;
}

/**
 * Process lead based on phone number with comprehensive eligibility checking
 * This function implements the flow:
 * 1. Check lead eligibility (ATOM/CAPC lists)
 * 2. If found in ATOM → mark as reloan
 * 3. If duplicate in AirConnect → set ascend_status to manual_verification_required with link
 * 4. If new → create lead and set ascend_status to manual_verification_required with link
 */
export async function processAscendLead(
  phoneNumber: string,
  customerName: string,
  customerHyperLink: string,
  additionalData?: {
    email?: string;
    source?: string;
    app?: string;
  }
): Promise<LeadProcessingResult> {
  try {
    console.log('🔄 Processing Ascend lead:', {
      phoneNumber,
      customerName,
      customerHyperLink,
      additionalData
    });

    // Format phone number
    const formattedPhone = formatSGPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return {
        success: false,
        message: 'Invalid phone number format',
        error: 'Invalid phone number format'
      };
    }

    // Step 1: Check lead eligibility
    const eligibilityResult = await checkLeadEligibility(formattedPhone);
    console.log('📊 Eligibility check result:', eligibilityResult);

    const systemUser = process.env.SYSTEM_USER_ID ?? 'system';

    // Step 2: Determine lead type and action based on eligibility result
    if (eligibilityResult.isEligible) {
      // New lead - not found in any lists or existing leads
      console.log('✅ New lead - creating new lead record');
      
      const createResult = await createLead({
        phone_number: formattedPhone,
        full_name: customerName,
        email: additionalData?.email ?? '',
        source: 'Ascend',
        lead_type: 'new',
        ascend_status: 'manual_verification_required',
        airconnect_verification_link: customerHyperLink,
        created_by: systemUser,
        bypassEligibility: true // Skip eligibility check since we already did it
      });

      if (createResult.success && createResult.lead) {
        return {
          success: true,
          message: `New lead created successfully. Lead ID: ${createResult.lead.id}`,
          data: {
            leadId: createResult.lead.id,
            leadType: 'new',
            ascendStatus: 'manual_verification_required',
            airconnectLink: customerHyperLink,
            eligibilityResult
          }
        };
              } else {
          return {
            success: false,
            message: 'Failed to create new lead',
            error: (createResult as { error?: string }).error ?? 'Failed to create new lead'
          };
        }
    } else {
      // Lead is not eligible - check why
      if (eligibilityResult.notes.includes('CAPC lists')) {
        // Found in ATOM/CAPC lists - this is a reloan customer
        // For reloan customers, we don't create a new lead, just log the verification
        console.log('🔄 Reloan customer - found in ATOM/CAPC lists, no new lead created');
        
        return {
          success: true,
          message: `Reloan customer identified in CAPC lists. No new lead created - separate reloan flow required.`,
          data: {
            leadType: 'reloan',
            ascendStatus: 'reloan_customer_identified',
            airconnectLink: customerHyperLink,
            eligibilityResult,
            note: 'This customer should be processed through the reloan customer flow'
          }
        };
      } else if (eligibilityResult.existingLead) {
        // Duplicate lead in AirConnect - update existing lead
        console.log('🔄 Duplicate lead found - updating existing lead:', eligibilityResult.existingLead.id);
        
        try {
          const updatedLead = await db.update(leads)
            .set({
              ascend_status: 'manual_verification_required',
              airconnect_verification_link: customerHyperLink,
              updated_at: new Date(),
              updated_by: 'ascend-system'
            })
            .where(eq(leads.id, eligibilityResult.existingLead.id))
            .returning();

          if (updatedLead.length > 0) {
            return {
              success: true,
              message: `Duplicate lead updated successfully. Lead ID: ${eligibilityResult.existingLead.id}`,
              data: {
                leadId: eligibilityResult.existingLead.id,
                leadType: 'duplicate',
                ascendStatus: 'manual_verification_required',
                airconnectLink: customerHyperLink,
                eligibilityResult
              }
            };
          } else {
            return {
              success: false,
              message: 'Failed to update existing lead',
              error: 'Failed to update existing lead'
            };
          }
        } catch (updateError) {
          console.error('❌ Error updating existing lead:', updateError);
          return {
            success: false,
            message: 'Failed to update existing lead',
            error: 'Failed to update existing lead: ' + (updateError instanceof Error ? updateError.message : 'Unknown error')
          };
        }
      } else {
        // Other ineligibility reasons
        return {
          success: false,
          message: 'Lead not eligible',
          error: `Lead not eligible: ${eligibilityResult.notes}`
        };
      }
    }

  } catch (error) {
    console.error('❌ Error processing Ascend lead:', error);
    return {
      success: false,
      message: 'Error processing lead',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}


export async function processReloanCustomer(
  phoneNumber: string,
  customerName: string,
  customerHyperLink: string,
  additionalData?: {
    email?: string;
    source?: string;
    app?: string;
  }
): Promise<LeadProcessingResult> {
  try {
    console.log('🔄 Processing reloan customer:', {
      phoneNumber,
      customerName,
      customerHyperLink,
      additionalData
    });

    // Format phone number
    const formattedPhone = formatSGPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return {
        success: false,
        message: 'Invalid phone number format',
        error: 'Invalid phone number format'
      };
    }

    // For reloan customers, we might want to:
    // 1. Check if they already have a borrower record
    // 2. Create/update borrower record instead of lead
    // 3. Set up appointment booking flow
    // 4. Send reloan-specific communications

    // For now, we'll just log the reloan customer identification
    // This can be extended based on your reloan customer workflow requirements

    return {
      success: true,
      message: `Reloan customer processed successfully. Phone: ${formattedPhone}`,
      data: {
        leadType: 'reloan',
        ascendStatus: 'reloan_customer_processed',
        airconnectLink: customerHyperLink,
        note: 'Reloan customer - ready for reloan workflow'
      }
    };

  } catch (error) {
    console.error('❌ Error processing reloan customer:', error);
    return {
      success: false,
      message: 'Error processing reloan customer',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Process appointment reminder with lead processing
 * This function implements the same flow as manual verification but for appointment reminders
 */
export async function processAppointmentReminderWithLeadProcessing(
  customerName: string,
  phoneNumber: string,
  appointmentDate: string,
  timeSlot: string,
  app = 'ascend',
  requestBody?: unknown
): Promise<{ success: boolean; message?: string; error?: string; data?: unknown }> {
  try {
    console.log('📞 Processing appointment reminder with lead processing:', {
      customerName,
      phoneNumber,
      appointmentDate,
      timeSlot,
      app,
      requestBody
    });

    // First, process the lead according to the appointment flow
    const leadProcessingResult = await processAscendLeadForAppointment(
      phoneNumber,
      customerName,
      appointmentDate,
      timeSlot,
      {
        app,
        source: 'Ascend Appointment Reminder'
      }
    );

    if (!leadProcessingResult.success) {
      return {
        success: false,
        error: leadProcessingResult.error
      };
    }

    // Import the original ascendAppointmentReminder function
    const { ascendAppointmentReminder } = await import('./whatsappActions');
    
    // Send the appointment reminder
    const reminderResult = await ascendAppointmentReminder(
      customerName,
      phoneNumber,
      appointmentDate,
      timeSlot,
      app,
      requestBody
    );

    if (reminderResult.success) {
      return {
        success: true,
        message: `${leadProcessingResult.message}. ${reminderResult.message}`,
        data: {
          leadProcessing: leadProcessingResult.data,
          reminder: reminderResult.data
        }
      };
    } else {
      return {
        success: false,
        error: reminderResult.error
      };
    }

  } catch (error) {
    console.error('❌ Error in processAppointmentReminderWithLeadProcessing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process lead for appointment reminder - similar to manual verification but with booking_appointment status
 */
export async function processAscendLeadForAppointment(
  phoneNumber: string,
  customerName: string,
  appointmentDate: string,
  timeSlot: string,
  additionalData?: {
    email?: string;
    source?: string;
    app?: string;
  }
): Promise<LeadProcessingResult> {
  try {
    console.log('🔄 Processing Ascend lead for appointment:', {
      phoneNumber,
      customerName,
      appointmentDate,
      timeSlot,
      additionalData
    });

    // Format phone number
    const formattedPhone = formatSGPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return {
        success: false,
        message: 'Invalid phone number format',
        error: 'Invalid phone number format'
      };
    }

    // Step 1: Check lead eligibility
    const eligibilityResult = await checkLeadEligibility(formattedPhone);
    console.log('📊 Eligibility check result for appointment:', eligibilityResult);

    const systemUser = process.env.SYSTEM_USER_ID ?? 'system';

    // Step 2: Determine lead type and action based on eligibility result
    if (eligibilityResult.isEligible) {
      // New lead - not found in any lists or existing leads
      console.log('✅ New lead for appointment - creating new lead record');
      
      const createResult = await createLead({
        phone_number: formattedPhone,
        full_name: customerName,
        email: additionalData?.email ?? '',
        source: 'Ascend',
        lead_type: 'new',
        ascend_status: 'booking_appointment',
        airconnect_verification_link: `Appointment: ${appointmentDate} ${timeSlot}`,
        created_by: systemUser,
        bypassEligibility: true // Skip eligibility check since we already did it
      });

      if (createResult.success && createResult.lead) {
        return {
          success: true,
          message: `New lead created for appointment. Lead ID: ${createResult.lead.id}`,
          data: {
            leadId: createResult.lead.id,
            leadType: 'new',
            ascendStatus: 'booking_appointment',
            airconnectLink: `Appointment: ${appointmentDate} ${timeSlot}`,
            eligibilityResult
          }
        };
      } else {
        return {
          success: false,
          message: 'Failed to create new lead for appointment',
          error: (createResult as { error?: string }).error ?? 'Failed to create new lead for appointment'
        };
      }
    } else {
      // Lead is not eligible - check why
      if (eligibilityResult.notes.includes('CAPC lists')) {
        // Found in ATOM/CAPC lists - this is a reloan customer
        // For reloan customers, we don't create a new lead, just log the appointment reminder
        console.log('🔄 Reloan customer appointment - found in ATOM/CAPC lists, no new lead created');
        
        return {
          success: true,
          message: `Reloan customer appointment identified in CAPC lists. No new lead created - separate reloan flow required.`,
          data: {
            leadType: 'reloan',
            ascendStatus: 'reloan_customer_appointment',
            airconnectLink: `Appointment: ${appointmentDate} ${timeSlot}`,
            eligibilityResult,
            note: 'This customer should be processed through the reloan customer flow'
          }
        };
      } else if (eligibilityResult.existingLead) {
        // Duplicate lead in AirConnect - update existing lead
        console.log('🔄 Duplicate lead found for appointment - updating existing lead:', eligibilityResult.existingLead.id);
        
        try {
          const updatedLead = await db.update(leads)
            .set({
              ascend_status: 'booking_appointment',
              airconnect_verification_link: `Appointment: ${appointmentDate} ${timeSlot}`,
              updated_at: new Date(),
              updated_by: systemUser
            })
            .where(eq(leads.id, eligibilityResult.existingLead.id))
            .returning();

          if (updatedLead.length > 0) {
            return {
              success: true,
              message: `Duplicate lead updated for appointment. Lead ID: ${eligibilityResult.existingLead.id}`,
              data: {
                leadId: eligibilityResult.existingLead.id,
                leadType: 'duplicate',
                ascendStatus: 'booking_appointment',
                airconnectLink: `Appointment: ${appointmentDate} ${timeSlot}`,
                eligibilityResult
              }
            };
          } else {
            return {
              success: false,
              message: 'Failed to update existing lead for appointment',
              error: 'Failed to update existing lead for appointment'
            };
          }
        } catch (updateError) {
          console.error('❌ Error updating existing lead for appointment:', updateError);
          return {
            success: false,
            message: 'Failed to update existing lead for appointment',
            error: 'Failed to update existing lead for appointment: ' + (updateError instanceof Error ? updateError.message : 'Unknown error')
          };
        }
      } else {
        // Other ineligibility reasons
        return {
          success: false,
          message: 'Lead not eligible for appointment',
          error: `Lead not eligible: ${eligibilityResult.notes}`
        };
      }
    }

  } catch (error) {
    console.error('❌ Error processing Ascend lead for appointment:', error);
    return {
      success: false,
      message: 'Error processing lead for appointment',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Enhanced storeManualVerification that includes lead processing
 */
export async function storeManualVerificationWithLeadProcessing(
  customerName: string,
  phoneNumber: string,
  customerHyperLink: string,
  app = 'ascend',
  requestBody?: unknown
): Promise<{ success: boolean; message?: string; error?: string; data?: unknown }> {
  try {
    console.log('📝 Storing manual verification with lead processing:', {
      customerName,
      phoneNumber,
      customerHyperLink,
      app,
      requestBody
    });

    // First, process the lead according to the new flow
    const leadProcessingResult = await processAscendLead(
      phoneNumber,
      customerName,
      customerHyperLink,
      {
        app,
        source: 'Ascend Manual Verification'
      }
    );

    if (!leadProcessingResult.success) {
      return {
        success: false,
        error: leadProcessingResult.error
      };
    }

    // Import the original storeManualVerification function
    const { storeManualVerification } = await import('./whatsappActions');
    
    // Store the manual verification log entry
    const verificationResult = await storeManualVerification(
      customerName,
      phoneNumber,
      customerHyperLink,
      app,
      requestBody
    );

    if (verificationResult.success) {
      return {
        success: true,
        message: `${leadProcessingResult.message}. ${verificationResult.message}`,
        data: {
          leadProcessing: leadProcessingResult.data,
          verification: verificationResult.data
        }
      };
    } else {
      return {
        success: false,
        error: verificationResult.error
      };
    }

  } catch (error) {
    console.error('❌ Error in storeManualVerificationWithLeadProcessing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
