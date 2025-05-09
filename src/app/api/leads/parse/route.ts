import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createLead } from '~/app/_actions/leadActions';

// Define the request schema
const RequestSchema = z.object({
  message: z.string(),
  subject: z.string().optional(),
});

// Define the lead schema
const LeadSchema = z.object({
  full_name: z.string().max(255).optional(),
  phone_number: z.string().max(20),
  nationality: z.string().max(100).optional(),
  amount: z.string().max(50).optional(),
  email: z.string().max(255).optional(),
  employment_status: z.string().max(100).optional(),
  loan_purpose: z.string().max(100).optional(),
  existing_loans: z.string().max(50).optional(),
  ideal_tenure: z.string().max(50).optional(),
  ip_address: z.string().max(50).optional(),
  date_time: z.string().max(50).optional(),
  form_url: z.string().max(255).optional(),
  assigned_to: z.string().max(256).optional(),
  source: z.string().max(100).optional(),
});

// Define the Workato request schema
const WorkatoRequestSchema = z.object({
  request: z.object({
    body: z.object({
      message: z.string(),
      subject: z.string().optional(),
    }),
  }),
});

// Helper function to clean phone number
function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If it starts with 65, remove it and add +65
  if (cleaned.startsWith('65')) {
    return `+65${cleaned.slice(2)}`;
  }
  
  // If it doesn't start with +65, add it
  if (!cleaned.startsWith('+65')) {
    return `+65${cleaned}`;
  }
  
  return cleaned;
}

// Helper function to extract amount
function extractAmount(amount: string): string {
  if (!amount) return '';
  
  // Check if amount contains "to" for range
  if (amount.toLowerCase().includes('to')) {
    const [min, max] = amount.split(/to/i).map(part => {
      // Remove currency symbols and clean up, but keep the minus sign
      return part.replace(/[^0-9-]/g, '').trim();
    });
    return `${min} to ${max}`;
  }
  
  // Remove currency symbols and clean up, but keep the minus sign
  return amount.replace(/[^0-9-]/g, '').trim();
}

// Helper function to validate email
function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

// Helper function to clean existing loans value
function cleanExistingLoans(value: string): string {
  if (!value) return '';
  // Remove the "?:" prefix if present
  return value.replace(/^\?:\s*/, '').trim();
}

// Helper function to determine lead source
function determineLeadSource(message: string, formUrl?: string, subject?: string): string {
  // Check form URL first
  if (formUrl) {
    if (formUrl.includes('omy.sg')) return 'OMY.sg';
    if (formUrl.includes('1percent.sg')) return '1% Loan';
    if (formUrl.includes('moneyright.sg')) return 'MoneyRight';
    if (formUrl.includes('loanable.sg')) return 'Loanable';
    if (formUrl.includes('crawfort.com')) return 'Crawfort';
  }

  // Check subject if provided
  if (subject) {
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes('moneyright') || subjectLower.includes('1% interest')) return 'MoneyRight';
    if (subjectLower.includes('1% loan') || subjectLower.includes('one percent')) return '1% Loan';
    if (subjectLower.includes('loanable') || subjectLower.includes('clientsuccessemail.com')) return 'Loanable';
    if (subjectLower.includes('crawfort')) return 'Crawfort';
  }

  // Then check message content
  const sourceChecks = [
    { source: 'OMY.sg', keywords: ['OMY.sg', 'OMY', 'get-personal-loan'] },
    { source: '1% Loan', keywords: ['1% Loan', '1%', 'One Percent'] },
    { source: 'MoneyRight', keywords: ['MoneyRight', '1% Interest'] },
    { source: 'Loanable', keywords: ['Loanable', 'loanable.sg', 'clientsuccessemail.com'] },
    { source: 'Crawfort', keywords: ['Crawfort', 'crawfort.com', 'personal-loan-singapore'] }
  ];

  for (const check of sourceChecks) {
    if (check.keywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()))) {
      return check.source;
    }
  }

  // Try to extract from "From:" field
  const fromRegex = /From:?\s*([^\n\r]+)/i;
  const fromMatch = fromRegex.exec(message);
  if (fromMatch?.[1]) {
    const fromValue = fromMatch[1].trim();
    if (fromValue.includes('@')) {
      const domain = fromValue.split('@')[1]?.toLowerCase() ?? '';
      if (domain.includes('omy.sg')) return 'OMY.sg';
      if (domain.includes('1percent.sg')) return '1% Loan';
      if (domain.includes('moneyright.sg')) return 'MoneyRight';
      if (domain.includes('loanable.sg') || domain.includes('clientsuccessemail.com')) return 'Loanable';
      if (domain.includes('crawfort.com')) return 'Crawfort';
    }
    return fromValue;
  }

  return 'Unknown';
}

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    console.log(body);
    
    // Try to validate as Workato request first
    const workatoValidation = WorkatoRequestSchema.safeParse(body);
    const requestBody = workatoValidation.success ? workatoValidation.data.request.body : body;

    const validationResult = RequestSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validationResult.error },
        { status: 400 }
      );
    }

    const { message, subject } = validationResult.data;

    // Extract lead information using regex
    const fullNameRegex = /Full Name:?\s*([^\n\r]+)/i;
    const phoneRegex = /(?:Phone|Mobile|Contact)(?:\s*Number)?:?\s*([^\n\r]+)/i;
    const nationalityRegex = /Nationality:?\s*([^\n\r]+)/i;
    const amountRegex = /Amount:?\s*([^\n\r]+)/i;
    const emailRegex = /Email:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const employmentRegex = /Employment Status:?\s*([^\n\r]+)/i;
    const purposeRegex = /(?:Main Purpose of Loan|Loan Purpose):?\s*([^\n\r]+)/i;
    const existingLoansRegex = /(?:Any Existing Loans|Existing Loans):?\s*([^\n\r]+)/i;
    const idealTenureRegex = /Ideal Tenure:?\s*([^\n\r]+)/i;
    const ipRegex = /(?:IP|Remote IP):?\s*([0-9.]+)/i;
    const dateTimeRegex = /(?:Date\/Time|Date):?\s*([^\n\r]+)/i;
    const formUrlRegex = /(?:Form URL|Page URL|Lead from page URL):?\s*([^\n\r]+)/i;
    const assignedToRegex = /Assigned to:?\s*([^\n\r]+)/i;

    // Extract matches
    const fullNameMatch = fullNameRegex.exec(message);
    const phoneMatch = phoneRegex.exec(message);
    const nationalityMatch = nationalityRegex.exec(message);
    const amountMatch = amountRegex.exec(message);
    const emailMatch = emailRegex.exec(message);
    const employmentMatch = employmentRegex.exec(message);
    const purposeMatch = purposeRegex.exec(message);
    const existingLoansMatch = existingLoansRegex.exec(message);
    const idealTenureMatch = idealTenureRegex.exec(message);
    const ipMatch = ipRegex.exec(message);
    const dateTimeMatch = dateTimeRegex.exec(message);
    const formUrlMatch = formUrlRegex.exec(message);
    const assignedToMatch = assignedToRegex.exec(message);

    // Clean and format the data
    const formUrl = formUrlMatch?.[1]?.trim();
    const leadData = {
      full_name: fullNameMatch?.[1]?.trim(),
      phone_number: phoneMatch?.[1] ? cleanPhoneNumber(phoneMatch[1]) : '',
      nationality: nationalityMatch?.[1]?.trim(),
      amount: amountMatch?.[1] ? extractAmount(amountMatch[1]) : undefined,
      email: emailMatch?.[1]?.trim(),
      employment_status: employmentMatch?.[1]?.trim(),
      loan_purpose: purposeMatch?.[1]?.trim(),
      existing_loans: existingLoansMatch?.[1] ? cleanExistingLoans(existingLoansMatch[1]) : undefined,
      ideal_tenure: idealTenureMatch?.[1]?.trim(),
      ip_address: ipMatch?.[1]?.trim(),
      date_time: dateTimeMatch?.[1]?.trim(),
      form_url: formUrl,
      assigned_to: assignedToMatch?.[1]?.trim(),
      source: determineLeadSource(message, formUrl, subject),
    };

    // Validate the extracted data
    const leadValidation = LeadSchema.safeParse(leadData);
    if (!leadValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid lead data', details: leadValidation.error },
        { status: 400 }
      );
    }

    console.log(leadData);

    // Create the lead
    const createResult = await createLead(leadData);

    if (!createResult.success) {
      return NextResponse.json(
        { success: false, error: createResult.error },
        { status: 500 }
      );
    }

    // Return the parsed data and creation status
    return NextResponse.json({
      success: true,
      data: {
        ...leadData,
        created: true,
        lead_id: createResult.lead?.id,
        status: createResult.lead?.status,
        eligibility_status: createResult.lead?.eligibility_status
      }
    });

  } catch (error) {
    console.error('Error parsing lead:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to parse lead' },
      { status: 500 }
    );
  }
} 