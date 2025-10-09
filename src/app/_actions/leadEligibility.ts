import { db } from "~/server/db";
import { borrowers, leads } from "~/server/db/schema";
import { eq, and, not, or } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

interface EligibilityResponse {
  isEligible: boolean;
  status: string;
  notes: string;
  existingLead?: InferSelectModel<typeof leads> | null;
  existingBorrower?: InferSelectModel<typeof borrowers> | null;
}

// Validate Singapore phone number
function validateSGPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Remove spaces, dashes, and parentheses
  const cleaned = phone.replace(/\s+|-|\(|\)/g, '');
  
  // Check for international format with +65
  if (cleaned.startsWith('+65')) {
    return /^\+65[896]\d{7}$/.test(cleaned);
  }
  
  // Check for local format with 65 prefix
  if (cleaned.startsWith('65')) {
    return /^65[896]\d{7}$/.test(cleaned);
  }
  
  // Check for local format without country code (8 digits)
  return /^[896]\d{7}$/.test(cleaned);
}

async function checkLeadEligibility(phoneNumber: string): Promise<EligibilityResponse> {
  try {
    // First, validate phone number format
    if (!validateSGPhoneNumber(phoneNumber)) {
      return {
        isEligible: false,
        status: 'unqualified',
        notes: 'Invalid phone number format. Must be a valid Singapore phone number.'
      };
    }
    
    // Clean phone number to remove +65 if present
    const cleanPhone = phoneNumber.replace(/^\+65/, '');
    
    // Check against CAPC API
    let response = null;
    if (['83992504'].includes(cleanPhone)) {
      return {
        isEligible: false,
        status: 'unqualified',
        notes: 'Phone number in CAPC lists'
      };
    }
    else{
      response = await fetch('https://api.capcfintech.com/api/atom/check-whether-one-hone-in-the-four-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'a9a47d79-3373-4f1f-abdb-9e818de576c8'
        },
        body: JSON.stringify({ phone: cleanPhone })
      });
  
      if (response.status === 403) {
  
      }
      else if (!response.ok) {
        throw new Error('Failed to check eligibility');
      }
    }

    const lists = await response.json() as string[];
    
    
    // Check if phone exists in leads with status other than unqualified (get the most recent one)
    console.log('phoneNumber', phoneNumber);
    const existingLead = await db.query.leads.findFirst({
      where: and(
        or(eq(leads.phone_number, phoneNumber), eq(leads.phone_number_2, phoneNumber), eq(leads.phone_number_3, phoneNumber)),
        not(eq(leads.status, 'unqualified'))
      ),
      orderBy: (leads, { desc }) => [desc(leads.updated_at)]
    });

    const existingBorrower = await db.query.borrowers.findFirst({
      where: and(
        or(eq(borrowers.phone_number, phoneNumber), eq(borrowers.phone_number_2, phoneNumber), eq(borrowers.phone_number_3, phoneNumber)),
        not(eq(borrowers.status, 'unqualified'))
      ),
      orderBy: (borrowers, { desc }) => [desc(borrowers.updated_at)]
    });

    // If phone exists in our leads (non-unqualified) or in any CAPC lists, mark as ineligible but return existing lead
    if (lists.length > 0 || existingLead || existingBorrower) {
      return {
        isEligible: false,
        status: 'unqualified',
        notes: lists.length > 0
          ? `Found in CAPC lists: ${lists.join(', ')}`
          : existingBorrower ? `Found in CAPC lists: Borrower` :
        existingLead? `Phone number already exists in leads ${existingLead?.id} with status ${existingLead?.status}` : 'Error checking eligibility',
        existingLead: existingLead ?? null,
        existingBorrower: existingBorrower ?? null,
      };
    }

    // If not found anywhere, create as new lead
    return {
      isEligible: true,
      status: 'new',
      notes: 'Not found in any lists or existing leads',
      existingLead: null,
      existingBorrower: null,
    };

  } catch (error) {
    console.error('Error checking eligibility:', error);
    return {
      isEligible: false,
      status: 'unqualified',
      notes: 'Error checking eligibility: ' + (error instanceof Error ? error.message : String(error)),
      existingLead: null,
      existingBorrower: null,
    };
  }
}

export { checkLeadEligibility };

