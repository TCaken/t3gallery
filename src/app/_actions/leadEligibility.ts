import { db } from "~/server/db";
import { leads } from "~/server/db/schema";
import { eq } from "drizzle-orm";

interface EligibilityResponse {
  isEligible: boolean;
  status: string;
  notes: string;
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
    const response = await fetch('https://api.capcfintech.com/api/atom/check-whether-one-hone-in-the-four-lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'a9a47d79-3373-4f1f-abdb-9e818de576c8'
      },
      body: JSON.stringify({ phone: cleanPhone })
    });

    if (!response.ok) {
      throw new Error('Failed to check eligibility');
    }

    const lists = await response.json() as string[];
    
    // Check if phone exists in leads
    const existingLead = await db.query.leads.findFirst({
      where: eq(leads.phone_number, phoneNumber)
    });

    // If phone exists in our leads or in any CAPC lists, mark as unqualified
    if (existingLead || lists.length > 0) {
      return {
        isEligible: false,
        status: 'unqualified',
        notes: existingLead 
          ? 'Phone number already exists in leads'
          : `Found in CAPC lists: ${lists.join(', ')}`
      };
    }

    // If not found anywhere, create as new lead
    return {
      isEligible: true,
      status: 'new',
      notes: 'Not found in any lists or existing leads'
    };

  } catch (error) {
    console.error('Error checking eligibility:', error);
    return {
      isEligible: true,
      status: 'new',
      notes: 'Error checking eligibility, defaulting to new'
    };
  }
}

export { checkLeadEligibility };

