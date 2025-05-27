'use server';

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { lead_actions } from "~/server/db/schema";

// Define the response schema for Samespace API
const SamespaceResponseSchema = z.object({
  success: z.boolean(),
  callId: z.string().optional(),
  message: z.string()
});

interface MakeCallParams {
  phoneNumber: string;
  leadId: number;
}

export async function makeCall({ phoneNumber, leadId }: MakeCallParams) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, message: "Not authenticated" };
  }

  try {
    // Get the API key from environment variables
    const apiKey = process.env.SAMESPACE_API_KEY;
    if (!apiKey) {
      return { success: false, message: "Samespace API key not configured" };
    }

    // Get the username from environment variables or use a default
    const username = process.env.SAMESPACE_USERNAME ?? "cakent@capc.com.sg@capitalc";

    // Clean the phone number (remove any non-digit characters except +)
    const cleanedPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');
    console.log('cleanedPhoneNumber', cleanedPhoneNumber);

    // Make the API call to Samespace
    const response = await fetch('https://api.capcfintech.com/api/samespace/voice/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        username: username,
        number: "6583992504"
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }

    const data = await response.json();
    const validatedResponse = SamespaceResponseSchema.safeParse(data);

    if (!validatedResponse.success) {
      throw new Error('Invalid response format from Samespace API');
    }

    const result = validatedResponse.data;

    // Log the call action regardless of the result
    await db.insert(lead_actions).values({
      lead_id: leadId,
      user_id: userId,
      action_type: 'call',
      content: JSON.stringify({
        success: result.success,
        callId: result.callId,
        message: result.message,
        phone: cleanedPhoneNumber
      }),
      created_by: userId
    });

    // Return appropriate response
    if (result.success) {
      return {
        success: true,
        callId: result.callId,
        message: "Call initiated successfully"
      };
    } else {
      return {
        success: false,
        message: result.message || "Failed to place call"
      };
    }

  } catch (error) {
    console.error('Error making call:', error);
    
    // Log the failed attempt
    await db.insert(lead_actions).values({
      lead_id: leadId,
      user_id: userId,
      action_type: 'call',
      content: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        phone: phoneNumber
      }),
      created_by: userId
    });

    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to make call"
    };
  }
} 