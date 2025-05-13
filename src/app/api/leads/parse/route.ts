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
  residential_status: z.string().max(50).optional(),
  amount: z.string().max(50).optional(),
  email: z.string().max(255).optional(),
  employment_status: z.string().max(50).optional(),
  loan_purpose: z.string().max(100).optional(),
  existing_loans: z.string().max(50).optional(),
  ideal_tenure: z.string().max(50).optional(),
  assigned_to: z.string().max(256).optional(),
  source: z.string().max(100).optional(),
});

// Define the Workato request schema
const WorkatoRequestSchema = z.object({
  request_name: z.string(),
  request: z.object({
    method: z.string(),
    content_type: z.string(),
    url: z.string(),
    request_body_schema: z.string(),
    body: z.object({
      subject: z.string(),
      message: z.string(),
    }),
    headers: z.array(z.object({
      header: z.string(),
      value: z.string(),
    })).optional(),
  }),
  response: z.object({
    output_type: z.string(),
    expected_encoding: z.string(),
    ignore_http_errors: z.string(),
    response_schema: z.string(),
    headers_schema: z.string(),
  }),
  wait_for_response: z.string(),
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
  if (!amount) return 'UNKNOWN';
  
  // Remove everything after the first occurrence of '---'
  const cleanAmount = amount.split('---')[0].trim();
  
  // Check if amount contains "to" for range
  if (cleanAmount.toLowerCase().includes('to')) {
    const [min, max] = cleanAmount.split(/to/i).map(part => {
      // Remove currency symbols and clean up, but keep the minus sign
      return part.replace(/[^0-9-]/g, '').trim();
    });
    return `${min} to ${max}`;
  }
  
  // Remove currency symbols and clean up, but keep the minus sign
  return cleanAmount.replace(/[^0-9-]/g, '').trim() || 'UNKNOWN';
}

// Helper function to extract name from subject
function extractNameFromSubject(subject: string): string | null {
  if (!subject) return null;
  
  // Look for patterns like "from [Name]" or "Request from [Name]" or "Loan from MoneyIQ SG ([Name])"
  const fromMatch = /(?:from|request from|loan from moneyiq sg)\s*(?:\(([^)]+)\)|([^,]+))/i.exec(subject);
  if (fromMatch?.[1] ?? fromMatch?.[2]) {
    return (fromMatch[1] ?? fromMatch[2] ?? '').trim();
  }
  
  return null;
}

// Helper function to validate email
function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

// Helper function to clean existing loans value
function cleanExistingLoans(value: string): string {
  if (!value || value.trim() === '') return 'UNKNOWN';
  
  const valueLower = value.toLowerCase().trim();
  // Handle various yes formats
  if (valueLower === 'yes' || valueLower === 'y' || valueLower === 'have' || valueLower.includes('have loan')) {
    return 'Yes';
  }
  // Handle various no formats
  if (valueLower === 'no' || valueLower === 'n' || valueLower === 'none' || valueLower.includes('no loan')) {
    return 'No';
  }
  return value.trim();
}

// Helper function to determine residential status
function determineResidentialStatus(nationality: string | undefined): string {
  if (!nationality) {
    console.log('Nationality is undefined or empty, returning UNKNOWN');
    return 'UNKNOWN';
  }
  
  const nationalityLower = nationality.toLowerCase();
  console.log('Processing nationality:', nationalityLower);
  
  // Check for Local/PR first
  if (nationalityLower.includes('singapore') || 
      nationalityLower.includes('local') || 
      nationalityLower.includes('pr') || 
      nationalityLower.includes('permanent resident')) {
    console.log('Matched as Local/PR');
    return 'Local';
  }
  // Check for Foreigner/Work Permit/S Pass
  if (nationalityLower.includes('foreign') || 
      nationalityLower.includes('foreigner') || 
      nationalityLower.includes('s pass') || 
      nationalityLower.includes('work permit') ||
      nationalityLower.includes('ep') ||
      nationalityLower.includes('employment pass')) {
    console.log('Matched as Foreigner');
    return 'Foreigner';
  }
  if (nationalityLower.includes('others')) {
    console.log('Matched as Others');
    return 'Others';
  }
  console.log('No match found, returning UNKNOWN');
  return 'UNKNOWN';
}

// Helper function to determine employment status
function determineEmploymentStatus(status: string | undefined): string {
  if (!status) return 'UNKNOWN';
  
  const statusLower = status.toLowerCase();
  if (statusLower.includes('full-time') || statusLower.includes('full time')) {
    return 'Full-Time';
  }
  if (statusLower.includes('part-time') || statusLower.includes('part time')) {
    return 'Part-Time';
  }
  if (statusLower.includes('self-employed') || statusLower.includes('self employed')) {
    return 'Self-Employed';
  }
  if (statusLower.includes('unemployed')) {
    return 'Unemployed';
  }
  return 'UNKNOWN';
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
    if (formUrl.includes('moneyiq.sg')) return 'MoneyIQ SG';
  }

  // Check subject if provided
  if (subject) {
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes('moneyright') || subjectLower.includes('1% interest')) return 'MoneyRight';
    if (subjectLower.includes('1% loan') || subjectLower.includes('one percent')) return '1% Loan';
    if (subjectLower.includes('loanable') || subjectLower.includes('clientsuccessemail.com')) return 'Loanable';
    if (subjectLower.includes('crawfort')) return 'Crawfort';
    if (subjectLower.includes('moneyiq')) return 'MoneyIQ SG';
  }

  // Then check message content
  const sourceChecks = [
    { source: 'OMY.sg', keywords: ['OMY.sg', 'OMY', 'get-personal-loan'] },
    { source: '1% Loan', keywords: ['1% Loan', '1%', 'One Percent'] },
    { source: 'MoneyRight', keywords: ['MoneyRight', '1% Interest'] },
    { source: 'Loanable', keywords: ['Loanable', 'loanable.sg', 'clientsuccessemail.com'] },
    { source: 'Crawfort', keywords: ['Crawfort', 'crawfort.com', 'personal-loan-singapore'] },
    { source: 'MoneyIQ SG', keywords: ['MoneyIQ', 'moneyiq.sg'] }
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

// Helper function to clean loan purpose value
function cleanLoanPurpose(value: string): string {
  if (!value || value.trim() === '') return 'UNKNOWN';
  const cleaned = value.trim();
  return cleaned || 'UNKNOWN';
}

export async function POST(request: Request) {
  try {
    // Get raw text first for debugging
    const rawText = await request.text();
    console.log('Raw request text:', rawText);

    let body;
    try {
      // First try to parse as regular JSON
      body = JSON.parse(rawText);
    } catch (error) {
      try {
        // If that fails, try to clean up the string and parse again
        const cleanedText = rawText
          // First escape any existing backslashes to prevent double escaping
          .replace(/\\/g, '\\\\')
          // Then handle the message content
          .replace(/"message":\s*"([^"]*)"/g, (match, message) => {
            // Escape special characters in the message
            const escapedMessage = message
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t');
            return `"message":"${escapedMessage}"`;
          })
          // Clean up any remaining issues
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/"\s*:\s*"/g, '":"')
          .replace(/"\s*,\s*"/g, '","');

        console.log('Cleaned text:', cleanedText);
        body = JSON.parse(cleanedText);
      } catch (cleanError) {
        console.error('Failed to parse JSON:', cleanError);
        console.error('Raw text:', rawText);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid JSON format',
            details: 'Could not parse request body as JSON',
            receivedText: rawText.substring(0, 100) + '...' // Log first 100 chars
          },
          { status: 400 }
        );
      }
    }

    console.log('Parsed body:', JSON.stringify(body, null, 2));

    // Try to validate as direct API request first
    const directValidation = RequestSchema.safeParse(body);
    if (directValidation.success) {
      console.log('Processing direct API request');
      const { message, subject } = directValidation.data;

      // Extract lead information using regex
      const fullNameRegex = /(?:Full Name|Name):\s*([^\n\r]+?)(?:\n|$)/i;
      const phoneRegex = /(?:Phone|Mobile|Contact)(?:\s*Number)?:\s*([0-9+\s-]+)/i;
      const nationalityRegex = /(?:Nationality|Residential Status):\s*([^\n\r]+?)(?:\n|$)/i;
      const amountRegex = /(?:Amount|Loan Amount):\s*\$?([^\n\r]+?)(?:\n|$)/i;
      const emailRegex = /Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
      const employmentRegex = /Employment Status:\s*([^\n\r]+?)(?:\n|$)/i;
      const purposeRegex = /(?:Main Purpose of Loan|Loan Purpose):\s*([^\n\r]+?)(?:\n|$)/i;
      const existingLoansRegex = /(?:Any Existing Loans\??|Existing Loans):\s*([^\n\r]+?)(?:\n|$)/i;
      const idealTenureRegex = /Ideal Tenure:\s*([^\n\r]+?)(?:\n|$)/i;
      const dateTimeRegex = /(?:Date\/Time|Date):\s*([^\n\r]+?)(?:\n|$)/i;
      const assignedToRegex = /Assigned to:\s*([^\n\r]+?)(?:\n|$)/i;

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
      const dateTimeMatch = dateTimeRegex.exec(message);
      const assignedToMatch = assignedToRegex.exec(message);

      // Only try to get name from subject if not found in message
      const nameFromSubject = !fullNameMatch?.[1] ? extractNameFromSubject(subject ?? '') : null;

      // Clean and format the data
      const leadData = {
        full_name: (fullNameMatch?.[1]?.trim() ?? nameFromSubject ?? 'UNKNOWN').substring(0, 255),
        phone_number: phoneMatch?.[1] ? cleanPhoneNumber(phoneMatch[1]).substring(0, 20) : '',
        residential_status: determineResidentialStatus(nationalityMatch?.[1]?.trim()) || 'UNKNOWN',
        amount: amountMatch?.[1] ? extractAmount(amountMatch[1]).substring(0, 50) : 'UNKNOWN',
        email: emailMatch?.[1]?.trim()?.substring(0, 255) ?? 'UNKNOWN',
        employment_status: determineEmploymentStatus(employmentMatch?.[1]?.trim()) || 'UNKNOWN',
        loan_purpose: purposeMatch?.[1] ? cleanLoanPurpose(purposeMatch[1]).substring(0, 100) : 'UNKNOWN',
        existing_loans: existingLoansMatch?.[1] ? cleanExistingLoans(existingLoansMatch[1]).substring(0, 50) : 'UNKNOWN',
        ideal_tenure: idealTenureMatch?.[1]?.trim()?.substring(0, 50) ?? 'UNKNOWN',
        date_time: dateTimeMatch?.[1]?.trim(),
        assigned_to: assignedToMatch?.[1]?.trim()?.substring(0, 256) ?? 'UNKNOWN',
        source: determineLeadSource(message, undefined, subject),
      };

      console.log('Raw matches:', {
        fullNameMatch: fullNameMatch?.[1],
        phoneMatch: phoneMatch?.[1],
        nationalityMatch: nationalityMatch?.[1],
        amountMatch: amountMatch?.[1],
        existingLoansMatch: existingLoansMatch?.[1],
        nameFromSubject,
        nationalityRaw: nationalityMatch?.[1]?.trim(),
        residentialStatus: leadData.residential_status
      });

      // Validate the extracted data
      const leadValidation = LeadSchema.safeParse(leadData);
      if (!leadValidation.success) {
        console.error('Invalid lead data:', leadValidation.error);
        return NextResponse.json(
          { success: false, error: 'Invalid lead data', details: leadValidation.error },
          { status: 400 }
        );
      }

      // Create the lead
      const createResult = await createLead(leadData);
      console.log('Lead creation result:', createResult);

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
    }

    // Then try to validate as Workato request
    const workatoValidation = WorkatoRequestSchema.safeParse(body);
    if (workatoValidation.success) {
      console.log('Processing Workato request');
      const requestBody = workatoValidation.data.request.body;
      const validationResult = RequestSchema.safeParse(requestBody);
      
      if (!validationResult.success) {
        console.error('Invalid Workato request body:', validationResult.error);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid Workato request body',
            details: validationResult.error,
            receivedBody: body
          },
          { status: 400 }
        );
      }

      const { message, subject } = validationResult.data;

      // Extract lead information using regex
      const fullNameRegex = /(?:Full Name|Name):\s*([^\n\r]+?)(?:\n|$)/i;
      const phoneRegex = /(?:Phone|Mobile|Contact)(?:\s*Number)?:\s*([0-9+\s-]+)/i;
      const nationalityRegex = /(?:Nationality|Residential Status):\s*([^\n\r]+?)(?:\n|$)/i;
      const amountRegex = /(?:Amount|Loan Amount):\s*\$?([^\n\r]+?)(?:\n|$)/i;
      const emailRegex = /Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
      const employmentRegex = /Employment Status:\s*([^\n\r]+?)(?:\n|$)/i;
      const purposeRegex = /(?:Main Purpose of Loan|Loan Purpose):\s*([^\n\r]+?)(?:\n|$)/i;
      const existingLoansRegex = /(?:Any Existing Loans\??|Existing Loans):\s*([^\n\r]+?)(?:\n|$)/i;
      const idealTenureRegex = /Ideal Tenure:\s*([^\n\r]+?)(?:\n|$)/i;
      const dateTimeRegex = /(?:Date\/Time|Date):\s*([^\n\r]+?)(?:\n|$)/i;
      const assignedToRegex = /Assigned to:\s*([^\n\r]+?)(?:\n|$)/i;

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
      const dateTimeMatch = dateTimeRegex.exec(message);
      const assignedToMatch = assignedToRegex.exec(message);

      // Only try to get name from subject if not found in message
      const nameFromSubject = !fullNameMatch?.[1] ? extractNameFromSubject(subject ?? '') : null;

      // Clean and format the data
      const leadData = {
        full_name: (fullNameMatch?.[1]?.trim() ?? nameFromSubject ?? 'UNKNOWN').substring(0, 255),
        phone_number: phoneMatch?.[1] ? cleanPhoneNumber(phoneMatch[1]).substring(0, 20) : '',
        residential_status: determineResidentialStatus(nationalityMatch?.[1]?.trim()) || 'UNKNOWN',
        amount: amountMatch?.[1] ? extractAmount(amountMatch[1]).substring(0, 50) : 'UNKNOWN',
        email: emailMatch?.[1]?.trim()?.substring(0, 255) ?? 'UNKNOWN',
        employment_status: determineEmploymentStatus(employmentMatch?.[1]?.trim()) || 'UNKNOWN',
        loan_purpose: purposeMatch?.[1] ? cleanLoanPurpose(purposeMatch[1]).substring(0, 100) : 'UNKNOWN',
        existing_loans: existingLoansMatch?.[1] ? cleanExistingLoans(existingLoansMatch[1]).substring(0, 50) : 'UNKNOWN',
        ideal_tenure: idealTenureMatch?.[1]?.trim()?.substring(0, 50) ?? 'UNKNOWN',
        date_time: dateTimeMatch?.[1]?.trim(),
        assigned_to: assignedToMatch?.[1]?.trim()?.substring(0, 256) ?? 'UNKNOWN',
        source: determineLeadSource(message, undefined, subject),
      };

      console.log('Raw matches:', {
        fullNameMatch: fullNameMatch?.[1],
        phoneMatch: phoneMatch?.[1],
        nationalityMatch: nationalityMatch?.[1],
        amountMatch: amountMatch?.[1],
        existingLoansMatch: existingLoansMatch?.[1],
        nameFromSubject,
        nationalityRaw: nationalityMatch?.[1]?.trim(),
        residentialStatus: leadData.residential_status
      });

      // Validate the extracted data
      const leadValidation = LeadSchema.safeParse(leadData);
      if (!leadValidation.success) {
        console.error('Invalid lead data:', leadValidation.error);
        return NextResponse.json(
          { success: false, error: 'Invalid lead data', details: leadValidation.error },
          { status: 400 }
        );
      }

      // Create the lead
      const createResult = await createLead(leadData);
      console.log('Lead creation result:', createResult);

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
    }

    // If neither validation passes, return error with examples
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid request format',
        details: 'Request must be either a direct API request or a Workato request',
        receivedBody: body,
        examples: {
          directFormat: {
            subject: "1% Loan Notification",
            message: "Full Name: John Doe\nPhone Number: +6512345678..."
          },
          workatoFormat: {
            request_name: "Send Leads to AirConnect",
            request: {
              method: "POST",
              content_type: "json",
              url: "https://your-api-url/api/leads/parse",
              body: {
                subject: "1% Loan Notification",
                message: "Full Name: John Doe\nPhone Number: +6512345678..."
              }
            }
          }
        }
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 