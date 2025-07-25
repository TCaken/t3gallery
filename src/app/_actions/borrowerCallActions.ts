'use server';

import { z } from "zod";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { borrower_actions } from "~/server/db/schema";

// Define the response schema for Samespace API
const SamespaceResponseSchema = z.object({
  success: z.boolean(),
  callId: z.string().optional(),
  message: z.string()
});

interface MakeBorrowerCallParams {
  phoneNumber: string;
  borrowerId: number;
  borrowerName: string;
}

export async function makeBorrowerCall({ phoneNumber, borrowerId, borrowerName }: MakeBorrowerCallParams) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, message: "Not authenticated" };
  }

  try {
    // Get the user's email from Clerk
    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return { success: false, message: "User email not found" };
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Get the API key from environment variables
    const apiKey = process.env.SAMESPACE_API_KEY;
    if (!apiKey) {
      return { success: false, message: "Samespace API key not configured" };
    }

    // Construct the username with the user's email
    const username = `${userEmail}@capitalc`;

    // Clean the phone number (remove any non-digit characters except +)
    const cleanedPhoneNumber = "+65" + phoneNumber.replace(/[^\d+]/g, '');

    // Make the API call to Samespace
    const response = await fetch('https://api.capcfintech.com/api/samespace/voice/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        username: username,
        number: cleanedPhoneNumber
      })
    });

    if (!response.ok) {
      if (response.status === 422 && response.statusText === "Unprocessable Entity") {
        throw new Error("Please check Samespace Wave and try again");
      }
      else{
        throw new Error(`API call failed with status: ${response.status} : ${response.statusText}`);
      }
    }

    const data = await response.json();
    const validatedResponse = SamespaceResponseSchema.safeParse(data);

    if (!validatedResponse.success) {
      throw new Error('Invalid response format from Samespace API');
    }

    const result = validatedResponse.data;

    // Log the call action to borrower_actions table
    await db.insert(borrower_actions).values({
      borrower_id: borrowerId,
      user_id: userId,
      action_type: 'call',
      content: JSON.stringify({
        success: result.success,
        callId: result.callId,
        message: result.message,
        phone: cleanedPhoneNumber,
        borrowerName: borrowerName
      }),
      timestamp: new Date(),
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
    console.error('Error making borrower call:', error);
    
    // Log the failed attempt
    await db.insert(borrower_actions).values({
      borrower_id: borrowerId,
      user_id: userId,
      action_type: 'call',
      content: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        phone: phoneNumber,
        borrowerName: borrowerName
      }),
      timestamp: new Date(),
      created_by: userId
    });

    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to make call"
    };
  }
} 