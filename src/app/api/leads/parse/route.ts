import { NextResponse } from 'next/server';
import { z } from 'zod';

// Define the schema for the parsed lead data
const LeadSchema = z.object({
  fullName: z.string().optional(),
  phoneNumber: z.string().optional(),
  nationality: z.string().optional(),
  amount: z.string().optional(),
  email: z.string().optional(),
  employmentStatus: z.string().optional(),
  loanPurpose: z.string().optional(),
  existingLoans: z.string().optional(),
  idealTenure: z.string().optional(),
  ipAddress: z.string().optional(),
  dateTime: z.string().optional(),
  formUrl: z.string().optional(),
  assignedTo: z.string().optional(),
  source: z.string().optional(),
});

type ParsedLead = z.infer<typeof LeadSchema>;

// Helper function to clean phone numbers
function cleanPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // If it starts with 65, remove it
  if (cleaned.startsWith('65')) {
    return cleaned.substring(2);
  }
  return cleaned;
}

// Helper function to extract amount
function extractAmount(amount: string): string {
  // Remove currency symbols and clean up
  return amount.replace(/[^0-9-]/g, '').trim();
}

// Helper function to parse date and time
function parseDateTime(dateTimeStr: string): string {
  try {
    const date = new Date(dateTimeStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (error) {
    console.error('Error parsing date:', error);
  }
  return dateTimeStr;
}

// Main parsing function
function parseLeadMessage(message: string): ParsedLead {
  const result: ParsedLead = {};

  // Extract full name
  const fullNameRegex = /Full Name:?\s*([^\n\r]+)/i;
  const fullNameMatch = fullNameRegex.exec(message);
  if (fullNameMatch?.[1]) {
    result.fullName = fullNameMatch[1].trim();
  }

  // Extract phone number
  const phoneRegex = /Phone Number:?\s*([^\n\r]+)/i;
  const phoneMatch = phoneRegex.exec(message);
  if (phoneMatch?.[1]) {
    result.phoneNumber = cleanPhoneNumber(phoneMatch[1]);
  }

  // Extract nationality
  const nationalityRegex = /Nationality:?\s*([^\n\r]+)/i;
  const nationalityMatch = nationalityRegex.exec(message);
  if (nationalityMatch?.[1]) {
    result.nationality = nationalityMatch[1].trim();
  }

  // Extract amount
  const amountRegex = /Amount:?\s*([^\n\r]+)/i;
  const amountMatch = amountRegex.exec(message);
  if (amountMatch?.[1]) {
    result.amount = extractAmount(amountMatch[1]);
  }

  // Extract email
  const emailRegex = /Email:?\s*([^\n\r]+)/i;
  const emailMatch = emailRegex.exec(message);
  if (emailMatch?.[1]) {
    result.email = emailMatch[1].trim();
  }

  // Extract employment status
  const employmentRegex = /Employment Status:?\s*([^\n\r]+)/i;
  const employmentMatch = employmentRegex.exec(message);
  if (employmentMatch?.[1]) {
    result.employmentStatus = employmentMatch[1].trim();
  }

  // Extract loan purpose
  const purposeRegex = /Main Purpose of Loan:?\s*([^\n\r]+)/i;
  const purposeMatch = purposeRegex.exec(message);
  if (purposeMatch?.[1]) {
    result.loanPurpose = purposeMatch[1].trim();
  }

  // Extract existing loans
  const existingLoansRegex = /Any Existing Loans\?:?\s*([^\n\r]+)/i;
  const existingLoansMatch = existingLoansRegex.exec(message);
  if (existingLoansMatch?.[1]) {
    result.existingLoans = existingLoansMatch[1].trim();
  }

  // Extract ideal tenure
  const tenureRegex = /Ideal Tenure:?\s*([^\n\r]+)/i;
  const tenureMatch = tenureRegex.exec(message);
  if (tenureMatch?.[1]) {
    result.idealTenure = tenureMatch[1].trim();
  }

  // Extract IP address
  const ipRegex = /IP Address:?\s*([^\n\r]+)/i;
  const ipMatch = ipRegex.exec(message);
  if (ipMatch?.[1]) {
    result.ipAddress = ipMatch[1].trim();
  }

  // Extract date/time
  const dateTimeRegex = /Date\/Time:?\s*([^\n\r]+)/i;
  const dateTimeMatch = dateTimeRegex.exec(message);
  if (dateTimeMatch?.[1]) {
    result.dateTime = parseDateTime(dateTimeMatch[1]);
  }

  // Extract form URL
  const formUrlRegex = /Form URL:?\s*([^\n\r]+)/i;
  const formUrlMatch = formUrlRegex.exec(message);
  if (formUrlMatch?.[1]) {
    result.formUrl = formUrlMatch[1].trim();
  }

  // Extract assigned to
  const assignedRegex = /Assigned to:?\s*([^\n\r]+)/i;
  const assignedMatch = assignedRegex.exec(message);
  if (assignedMatch?.[1]) {
    result.assignedTo = assignedMatch[1].trim();
  }

  // Extract source
  const sourceRegex = /From:?\s*([^\n\r]+)/i;
  const sourceMatch = sourceRegex.exec(message);
  if (sourceMatch?.[1]) {
    result.source = sourceMatch[1].trim();
  }

  return result;
}

// Define the request body schema
const RequestSchema = z.object({
  message: z.string()
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validationResult = RequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error },
        { status: 400 }
      );
    }

    const { message } = validationResult.data;
    const parsedLead = parseLeadMessage(message);

    // Validate the parsed data
    const leadValidationResult = LeadSchema.safeParse(parsedLead);
    if (!leadValidationResult.success) {
      return NextResponse.json(
        { error: 'Invalid lead data', details: leadValidationResult.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsedLead
    });
  } catch (error) {
    console.error('Error parsing lead message:', error);
    return NextResponse.json(
      { error: 'Failed to parse lead message' },
      { status: 500 }
    );
  }
} 