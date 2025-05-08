'use server';

import { auth } from '@clerk/nextjs/server';

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

export async function sendWhatsAppMessage(
  phone: string, 
  templateId: string, 
  parameters: Record<string, string>,
  deliveryMethod: 'sms' | 'whatsapp' | 'both' = 'whatsapp'
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    console.log('Attempting to send message');
    console.log('Phone number:', phone);
    console.log('Template ID:', templateId);
    console.log('Parameters:', parameters);
    console.log('Delivery Method:', deliveryMethod);
    
    // For now, we'll only support WhatsApp
    // In a real implementation, you would have different logic for SMS and combined sending
    if (deliveryMethod !== 'whatsapp' && deliveryMethod !== 'both') {
      console.log('SMS delivery not implemented yet - would send SMS here');
    }
    
    if (deliveryMethod === 'whatsapp' || deliveryMethod === 'both') {
      const whatsappData: WhatsAppRequest = getTemplateData(templateId, phone);
      console.log('WhatsApp request data:', JSON.stringify(whatsappData, null, 2));

      const response = await fetch('https://api.capcfintech.com/api/bird/v2/wa/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': `${process.env.WHATSAPP_API_KEY}`
        },
        body: JSON.stringify(whatsappData)
      });

      const data = await response.json() as WhatsAppResponse;
      
      if (!response.ok) {
        throw new Error(data.message ?? 'Failed to send WhatsApp message');
      }
      
      return { success: true, data };
    }
    
    // If we get here with SMS only, return success since we logged it
    return { success: true, data: { message: 'SMS delivery logged (not implemented)' } };
  } catch (error) {
    console.error('Error sending message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Helper to get the appropriate template data based on templateId
function getTemplateData(templateId: string, phone: string): WhatsAppRequest {
  // Handle potential undefined phone
  const phoneNumber = phone ? formatPhoneNumber(phone) : '+6500000000';
  
  // Default values for the example template
  const baseRequest: WhatsAppRequest = {
    workspaces: "976e3394-ae10-4b32-9a23-8ecf78da9fe7",
    channels: "8d8c5cd0-e776-5d80-b223-435bd0536927",
    projectId: "ec4f6834-806c-47eb-838b-bc72004f8cca",
    identifierValue: phoneNumber,
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
  
  // In a real application, you would customize the parameters based on the template
  // For now, we'll just return the example template data for all templates
  return baseRequest;
}

// Helper to format phone number
function formatPhoneNumber(phone: string): string {
  if (!phone) return '+6500000000'; // Default fallback number
  
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