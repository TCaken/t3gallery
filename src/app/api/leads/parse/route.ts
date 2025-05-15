import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createLead } from '~/app/_actions/leadActions';

// Define the request schema
const RequestSchema = z.object({
  message: z.string(),
  subject: z.string().optional(),
  received_time: z.string().optional(),
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
  created_at: z.string().optional(),
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

// Helper function to extract email from any text
function extractEmailFromText(text: string): string | null {
  if (!text) return null;
  
  // Use regex to find email patterns in the text
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  
  if (matches && matches.length > 0) {
    // Return the first valid email found
    for (const match of matches) {
      if (isValidEmail(match)) {
        return match.trim();
      }
    }
  }
  
  return null;
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
  
  const nationalityLower = nationality.toLowerCase().trim();
  console.log('Processing nationality:', nationalityLower);
  
  // Check for Local/PR first
  if (nationalityLower === 'singaporean' || 
      nationalityLower.includes('singapore') || 
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
    if (subjectLower.includes('omy.sg') || subjectLower.includes('omy')) return 'OMY.sg';
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

// Helper function to extract data from OMY.sg format
function extractOMYData(message: string): { 
  full_name?: string;
  phone_number?: string; 
  residential_status?: string;
} {
  // Initialize result object
  const result: { 
    full_name?: string;
    phone_number?: string; 
    residential_status?: string;
  } = {};
  
  // Common patterns in OMY.sg leads
  const nameRegex = /(?:Name|Full Name|Customer Name)[:\s]+([^\r\n,]+)/i;
  const phoneRegex = /(?:Phone|Mobile|Contact|Phone Number|HP)[:\s]+([0-9\s+]+)/i;
  const citizenRegex = /(?:Citizenship|Nationality|Residential Status)[:\s]+([^\r\n,]+)/i;
  
  // Extract name
  const nameMatch = nameRegex.exec(message);
  if (nameMatch && nameMatch[1]) {
    result.full_name = nameMatch[1].trim();
  }
  
  // Extract phone number
  const phoneMatch = phoneRegex.exec(message);
  if (phoneMatch && phoneMatch[1]) {
    result.phone_number = phoneMatch[1].trim();
  }
  
  // Extract citizenship/residential status
  const citizenMatch = citizenRegex.exec(message);
  if (citizenMatch && citizenMatch[1]) {
    const citizenValue = citizenMatch[1].trim().toLowerCase();
    if (citizenValue.includes('singapore') || 
        citizenValue.includes('local') || 
        citizenValue.includes('citizen') || 
        citizenValue.includes('pr')) {
      result.residential_status = 'Local';
    } else if (citizenValue.includes('foreigner') || 
               citizenValue.includes('foreign') || 
               citizenValue.includes('work pass') || 
               citizenValue.includes('work permit') ||
               citizenValue.includes('employment pass') || 
               citizenValue.includes('s pass')) {
      result.residential_status = 'Foreigner';
    }
  }
  
  return result;
}

export async function POST(request: Request) {
  try {
    // Get raw text first for debugging
    const rawText = await request.text();
    console.log('Raw request text:', rawText);

    let body;
    try {
      // Clean the JSON string before parsing
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
    } catch (error) {
      console.error('Failed to parse JSON:', error);
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

    console.log('Parsed body:', JSON.stringify(body, null, 2));

    // Validate the request body
    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Invalid request body:', validationResult.error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          details: validationResult.error,
          receivedBody: body
        },
        { status: 400 }
      );
    }

    console.log('Processing request...', validationResult.data);

    const { message, subject, received_time } = validationResult.data;

    // First split the message into tokens by newlines and clean them
    const tokens = message
      .split(/[\r\n]+/)
      .map(token => token.trim())
      .filter(token => token.length > 0);

    console.log('Message tokens:', tokens);

    // Helper function to find value in the same line as label
    function findValueInLine(label: string): string | undefined {
      const line = tokens.find(token => 
        token.toLowerCase().includes(label.toLowerCase())
      );
      if (line) {
        const parts = line.split(':');
        if (parts.length > 1) {
          return parts[1].trim();
        }
      }
      return undefined;
    }

    // Helper function to find value after a label
    function findValueAfterLabel(label: string): string | undefined {
      const labelIndex = tokens.findIndex(token => 
        token.toLowerCase().includes(label.toLowerCase())
      );
      if (labelIndex !== -1 && labelIndex + 1 < tokens.length) {
        return tokens[labelIndex + 1];
      }
      return undefined;
    }

    // Extract values using both helper functions
    const fullName = findValueInLine('Full Name') ?? findValueAfterLabel('Name:') ?? findValueAfterLabel('I am:');
    const phoneNumber = findValueInLine('Phone Number') ?? findValueAfterLabel('Mobile No.:') ?? findValueAfterLabel('Phone Number:');
    const nationality = findValueInLine('Nationality') ?? findValueAfterLabel('I am:');
    const amount = findValueInLine('Amount') ?? findValueAfterLabel('Loan Amount:');

    // For email, first try standard extraction methods
    const emailFromFields = findValueInLine('Email') ?? findValueAfterLabel('Email:');

    // Then attempt to extract from full message if needed
    let emailToUse = 'UNKNOWN';
    if (emailFromFields && isValidEmail(emailFromFields)) {
      emailToUse = emailFromFields.trim();
    } else {
      console.log('Standard email extraction failed, searching in entire message');
      const emailFromMessage = extractEmailFromText(message);
      if (emailFromMessage) {
        console.log('Found email in message content:', emailFromMessage);
        emailToUse = emailFromMessage;
      }
    }

    const employment = findValueInLine('Employment Status') ?? findValueAfterLabel('Employment Status:');
    const purpose = findValueInLine('Main Purpose of Loan') ?? findValueAfterLabel('Loan Purpose:');
    const existingLoans = findValueInLine('Any Existing Loans') ?? findValueAfterLabel('Existing Loans:');
    const idealTenure = findValueInLine('Ideal Tenure') ?? findValueAfterLabel('Ideal Tenure:');
    const dateTime = findValueAfterLabel('Date/Time:');
    const assignedTo = findValueInLine('Assigned to') ?? findValueAfterLabel('Assigned to:');

    // Detect source first
    const source = determineLeadSource(message, undefined, subject);

    // Try to extract additional data for OMY.sg leads
    let omyData: { 
      full_name?: string;
      phone_number?: string; 
      residential_status?: string;
    } = {};
    if (source === 'OMY.sg') {
      console.log('Detected OMY.sg lead, applying specialized extraction');
      omyData = extractOMYData(message);
      console.log('OMY specialized data:', omyData);
    }

    // Only try to get name from subject if not found in message and not found from OMY extraction
    const nameFromSubject = !fullName && !omyData.full_name ? extractNameFromSubject(subject ?? '') : null;

    // Clean and format the data
    const leadData = {
      full_name: (omyData?.full_name?.trim() ?? fullName?.trim() ?? nameFromSubject ?? 'UNKNOWN').substring(0, 255),
      phone_number: omyData?.phone_number ? cleanPhoneNumber(omyData.phone_number).substring(0, 20) : 
                    phoneNumber ? cleanPhoneNumber(phoneNumber).substring(0, 20) : '',
      residential_status: omyData?.residential_status ?? (determineResidentialStatus(nationality?.trim()) || 'UNKNOWN'),
      amount: amount ? extractAmount(amount).substring(0, 50) : 'UNKNOWN',
      email: emailToUse.substring(0, 255),
      employment_status: determineEmploymentStatus(employment?.trim()) || 'UNKNOWN',
      loan_purpose: purpose ? cleanLoanPurpose(purpose).substring(0, 100) : 'UNKNOWN',
      existing_loans: existingLoans ? cleanExistingLoans(existingLoans).substring(0, 50) : 'UNKNOWN',
      ideal_tenure: idealTenure?.trim()?.substring(0, 50) ?? 'UNKNOWN',
      date_time: dateTime?.trim(),
      assigned_to: assignedTo?.trim()?.substring(0, 256) ?? 'UNKNOWN',
      source: source,
      created_at: received_time,
    };

    console.log('Extracted values:', {
      fullName,
      phoneNumber,
      nationality,
      amount,
      email: emailToUse,
      employment,
      purpose,
      existingLoans,
      idealTenure,
      dateTime,
      assignedTo,
      nameFromSubject,
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