"use server";

import { db } from "~/server/db";
import { leads, lead_notes, logs } from "~/server/db/schema";
import { eq, count } from "drizzle-orm";
import { checkLeadEligibility } from "./leadEligibility";

interface ImportResult {
  success: boolean;
  message: string;
  summary: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  errors: string[];
  successfulLeads?: Array<{
    name: string;
    phone: string;
    source: string;
    status: string;
  }>;
  skippedLeads?: Array<{
    name: string;
    phone: string;
    reason: string;
  }>;
  failedLeads?: Array<{
    name: string;
    phone: string;
    reason: string;
  }>;
}

interface CSVRow {
  name: string;
  assignToAgent: string;
  leadSource: string;
  notes: string;
  mobileNumber: string;
  status: string;
  startDate: string;
  priority: string;
}

const TARGET_USER_ID = process.env.AGENT_USER_ID ?? 'user_2yIJmg1zvydv8acYdXPY6r6Ue1l';


// Lead source mapping based on notes patterns
const LEAD_SOURCE_MAPPING: Record<string, string> = {
  '1%': '1% Loan',
  'MR': 'MoneyRight',
  'LA': 'Loanable',
  'LEND': 'Lendable',
  'LENDELA': 'Lendela',
  'SEO': 'SEO',
  'OMY': 'OMY.sg', // Found this new source code in CSV
  'MONEYRIGHT': 'MoneyRight',
  'ATOM': 'Atom Platform',
  'FB': 'Facebook',
  'GOOGLE': 'Google Ads',
  'WA': 'WhatsApp',
  'REFERRAL': 'Customer Referral'
};

function extractLeadSource(notes: string): string {
  if (!notes) return 'SEO';
  
  console.log('🔍 Extracting source from notes start:', notes.substring(0, 50));
  
  // Look for source patterns at the very beginning of notes (first line)
  // Examples: "1% 240525", "MR 310525", "LA 290525", "SEO 310525", "OMY 050625"
  const firstLine = notes.split('\n')[0]?.trim() ?? '';
  const sourceMatch = /^([A-Z0-9%]+)\s+\d{6}/i.exec(firstLine);
  
  if (sourceMatch?.[1]) {
    const sourceCode = sourceMatch[1].toUpperCase();
    const mappedSource = LEAD_SOURCE_MAPPING[sourceCode];
    console.log(`📊 Found source code: ${sourceCode} → ${mappedSource ?? 'SEO (unmapped)'}`);
    return mappedSource ?? 'SEO';
  }
  
  // If no pattern found, default to SEO
  console.log('📊 No source pattern found, defaulting to SEO');
  return 'SEO';
}

function determineLoanAmount(notes: string): string {
  if (!notes) return '';
  
  // Extract loan amount patterns
  const amountPatterns = [
    /LOAN AMT[:\s]+\$?([\d,]+(?:\s*(?:to|TO|-)\s*\$?[\d,]+)?(?:\s*(?:k|K|&\s*above|and\s*above))?)/i,
    /AMT[:\s]+\$?([\d,]+(?:\s*(?:to|TO|-)\s*\$?[\d,]+)?(?:\s*(?:k|K|&\s*above|and\s*above))?)/i
  ];
  
  for (const pattern of amountPatterns) {
    const match = pattern.exec(notes);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  
  return '';
}

function parseFollowUpDateTime(startDate: string, priority: string): Date | null {
  if (!startDate || !priority) return null;
  
  try {
    console.log('🗓️ Parsing follow-up date:', startDate, 'time:', priority);
    
    // Parse date from MM/DD/YYYY format
    const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(startDate);
    if (!dateMatch) {
      console.log('❌ Invalid date format:', startDate);
      return null;
    }
    
    const [, month, day, year] = dateMatch;
    
    if (!month || !day || !year) {
      console.log('❌ Missing date components:', dateMatch);
      return null;
    }
    
    // Parse time from HH:MM am/pm format
    const timeMatch = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(priority);
    if (!timeMatch) {
      console.log('❌ Invalid time format:', priority);
      return null;
    }
    
    const [, hours, minutes, ampm] = timeMatch;
    
    if (!hours || !minutes || !ampm) {
      console.log('❌ Missing time components:', timeMatch);
      return null;
    }
    
    let hour24 = parseInt(hours);
    
    // Convert to 24-hour format
    if (ampm.toLowerCase() === 'pm' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm.toLowerCase() === 'am' && hour24 === 12) {
      hour24 = 0;
    }
    
    // Create date in Singapore timezone (GMT+8)
    // The CSV times are already in GMT+8, so we create the date as-is
    const followUpDate = new Date(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
      hour24,
      parseInt(minutes),
      0, // seconds
      0  // milliseconds
    );
    
    console.log('✅ Parsed follow-up date:', followUpDate.toISOString());
    return followUpDate;
    
  } catch (error) {
    console.log('❌ Error parsing follow-up date/time:', error);
    return null;
  }
}

// Removed custom eligibility check - now using existing checkLeadEligibility function

function parseCSV(csvContent: string): CSVRow[] {
  console.log('🚀 Starting CSV parsing...');
  
  // Parse the entire CSV content respecting multi-line quoted fields
  const records = parseCSVContent(csvContent);
  
  if (records.length === 0) {
    throw new Error('CSV file is empty or invalid');
  }
  
  const header = records[0];
  if (!header || !header.includes('Name') || !header.includes('Mobile Number')) {
    throw new Error('CSV file must contain Name and Mobile Number columns');
  }

  console.log('📊 CSV Header:', header.join(','));
  console.log(`📊 Total records found: ${records.length - 1}`);

  const rows: CSVRow[] = [];
  let skippedRows = 0;
  
  // Process data rows (skip header)
  for (let i = 1; i < records.length; i++) {
    const fields = records[i];
    
    if (!fields || fields.length < 8) {
      skippedRows++;
      if (skippedRows <= 5) {
        console.log(`⚠️ Row ${i + 1} has ${fields?.length ?? 0} fields, expected 8:`, fields?.slice(0, 3));
      }
      continue;
    }
    
    // Additional validation for phone number field
    const phoneField = fields[4]?.trim() ?? '';
    if (phoneField && !isValidPhoneNumber(phoneField)) {
      // Log some problematic phone numbers for debugging
      if (rows.length < 10) {
        console.log(`⚠️ Row ${i + 1} potential phone issue: "${phoneField}" in name "${fields[0] ?? 'unknown'}"`);
      }
    }

    rows.push({
      name: fields[0]?.trim() ?? '',
      assignToAgent: fields[1]?.trim() ?? '',
      leadSource: fields[2]?.trim() ?? '',
      notes: fields[3]?.trim() ?? '',
      mobileNumber: fields[4]?.trim() ?? '',
      status: fields[5]?.trim() ?? '',
      startDate: fields[6]?.trim() ?? '',
      priority: fields[7]?.trim() ?? ''
    });
  }

  console.log(`📊 Successfully parsed ${rows.length} valid rows, skipped ${skippedRows} malformed rows`);
  return rows;
}

function parseCSVContent(csvContent: string): string[][] {
  const records: string[][] = [];
  const chars = csvContent.split('');
  
  let current = '';
  let currentRecord: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < chars.length) {
    const char = chars[i];
    const nextChar = chars[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      currentRecord.push(current);
      current = '';
      i++;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // Row separator (only when not in quotes)
      currentRecord.push(current);
      
      // Skip empty records
      if (currentRecord.some(field => field.trim())) {
        records.push(currentRecord);
      }
      
      currentRecord = [];
      current = '';
      
      // Skip \r\n or \n\r combinations
      if ((char === '\r' && nextChar === '\n') || (char === '\n' && nextChar === '\r')) {
        i += 2;
      } else {
        i++;
      }
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field and record
  if (current || currentRecord.length > 0) {
    currentRecord.push(current);
    if (currentRecord.some(field => field.trim())) {
      records.push(currentRecord);
    }
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());
  return result;
}

function isValidPhoneNumber(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Check if it looks like a phone number (at least 8 digits, not more than 15)
  if (digits.length < 8 || digits.length > 15) return false;
  
  // Check if it starts with valid Singapore patterns
  if (digits.length === 8 && /^[896]/.test(digits)) return true;
  if (digits.length === 10 && digits.startsWith('65') && /^65[896]/.test(digits)) return true;
  if (digits.length === 11 && digits.startsWith('656') && /^656[896]/.test(digits)) return true;
  
  // Allow other international formats (basic validation)
  if (digits.length >= 10 && digits.length <= 15) return true;
  
  return false;
}

function validateAndFormatPhone(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Singapore phone validation
  if (digits.length === 8 && /^[896]/.test(digits)) {
    return `+65${digits}`;
  } else if (digits.length === 10 && digits.startsWith('65') && /^65[896]/.test(digits)) {
    return `+${digits}`;
  } else if (digits.length === 11 && digits.startsWith('656') && /^656[896]/.test(digits)) {
    return `+${digits}`;
  }
  
  return null;
}

export async function importCSVLeads(csvContent: string, customStatus: string = 'follow_up'): Promise<ImportResult> {
  const errors: string[] = [];
  const successfulLeads: Array<{name: string; phone: string; source: string; status: string}> = [];
  const skippedLeads: Array<{name: string; phone: string; reason: string}> = [];
  const failedLeads: Array<{name: string; phone: string; reason: string}> = [];
  let successful = 0;
  let skipped = 0;
  let failed = 0;

  try {
    console.log('🚀 Starting CSV import process...');
    
    const rows = parseCSV(csvContent);
    const total = rows.length;
    
    console.log(`📊 Parsed ${total} rows from CSV`);

    if (total === 0) {
      return {
        success: false,
        message: 'No valid data found in CSV file',
        summary: { total: 0, successful: 0, skipped: 0, failed: 0 },
        errors: ['CSV file is empty or invalid'],
        successfulLeads: [],
        skippedLeads: [],
        failedLeads: []
      };
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row) {
        failed++;
        const reason = 'Invalid row data';
        errors.push(`Row ${i + 2}: ${reason}`);
        failedLeads.push({
          name: 'Unknown',
          phone: 'Unknown',
          reason: reason
        });
        continue;
      }
      
      try {
        // Validate required fields
        if (!row.name?.trim()) {
          failed++;
          const reason = 'Missing or empty name field';
          errors.push(`Row ${i + 2}: ${reason}`);
          failedLeads.push({
            name: row.name || 'Unknown',
            phone: row.mobileNumber || 'Unknown',
            reason: reason
          });
          continue;
        }

        if (!row.mobileNumber?.trim()) {
          failed++;
          const reason = 'Missing or empty mobile number field';
          errors.push(`Row ${i + 2}: ${reason}`);
          failedLeads.push({
            name: row.name || 'Unknown',
            phone: 'Unknown',
            reason: reason
          });
          continue;
        }

        // Pre-validate phone number format
        if (!isValidPhoneNumber(row.mobileNumber)) {
          failed++;
          const reason = `Invalid phone number format: "${row.mobileNumber}"`;
          errors.push(`Row ${i + 2}: ${reason} (Name: ${row.name})`);
          failedLeads.push({
            name: row.name || 'Unknown',
            phone: row.mobileNumber,
            reason: reason
          });
          continue;
        }

        // Validate and format phone number
        const formattedPhone = validateAndFormatPhone(row.mobileNumber);
        if (!formattedPhone) {
          failed++;
          const reason = `Cannot format Singapore phone number: ${row.mobileNumber}`;
          errors.push(`Row ${i + 2}: ${reason} (Name: ${row.name})`);
          failedLeads.push({
            name: row.name || 'Unknown',
            phone: row.mobileNumber,
            reason: reason
          });
          continue;
        }

        // Check for duplicate phone numbers
        const existingLead = await db
          .select({ id: leads.id })
          .from(leads)
          .where(eq(leads.phone_number, formattedPhone))
          .limit(1);

        if (existingLead.length > 0) {
          skipped++;
          const reason = `Lead already exists with phone ${formattedPhone}`;
          errors.push(`Row ${i + 2}: ${reason} (Name: ${row.name})`);
          skippedLeads.push({
            name: row.name || 'Unknown',
            phone: formattedPhone,
            reason: reason
          });
          continue;
        }

        // Extract lead source from notes
        const detectedSource = extractLeadSource(row.notes);
        
        // Extract loan amount from notes
        const loanAmount = determineLoanAmount(row.notes);
        
        // Parse follow-up date/time from CSV columns
        const followUpDateTime = parseFollowUpDateTime(row.startDate, row.priority);
        
        // Perform eligibility check using existing function
        const eligibility = await checkLeadEligibility(formattedPhone);
        
        // Add priority to eligibility notes
        const updatedEligibilityNotes = row.priority ?? 'Not specified';
        
        // Use custom status if provided, otherwise use eligibility-based status
        const finalStatus = customStatus || (eligibility.isEligible ? 'follow_up' : 'unqualified');

        // Create lead
        const [newLead] = await db
          .insert(leads)
          .values({
            full_name: row.name.trim(),
            phone_number: formattedPhone,
            email: '', // Not provided in CSV
            source: detectedSource,
            amount: loanAmount,
            status: finalStatus,
            assigned_to: TARGET_USER_ID,
            follow_up_date: followUpDateTime,
            eligibility_checked: true,
            eligibility_status: eligibility.status,
            eligibility_notes: updatedEligibilityNotes,
            lead_score: 50, // Default score
            is_contactable: eligibility.isEligible,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning({ id: leads.id });

        if (!newLead) {
          failed++;
          const reason = `Failed to create lead for ${row.name}`;
          errors.push(`Row ${i + 2}: ${reason}`);
          failedLeads.push({
            name: row.name || 'Unknown',
            phone: formattedPhone,
            reason: reason
          });
          continue;
        }

        // Add notes if provided
        if (row.notes?.trim()) {
          await db.insert(lead_notes).values({
            lead_id: newLead.id,
            content: row.notes.trim(),
            created_by: TARGET_USER_ID,
            created_at: new Date(),
          });
        }

        successful++;
        successfulLeads.push({
          name: row.name,
          phone: formattedPhone,
          source: detectedSource,
          status: finalStatus
        });
        console.log(`✅ Successfully imported: ${row.name} (${formattedPhone})`);

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 2}: ${errorMsg} (Name: ${row?.name || 'Unknown'})`);
        failedLeads.push({
          name: row?.name || 'Unknown',
          phone: row?.mobileNumber || 'Unknown',
          reason: errorMsg
        });
        console.error(`❌ Error processing row ${i + 2}:`, error);
      }
    }

    // Log the import activity
    try {
      await db.insert(logs).values({
        performed_by: TARGET_USER_ID,
        action: 'CSV_IMPORT',
        entity_type: 'leads',
        entity_id: 'bulk_import',
        description: JSON.stringify({
          total,
          successful,
          skipped,
          failed,
          errorCount: errors.length,
          status: customStatus
        }),
        timestamp: new Date(),
      });
    } catch (logError) {
      console.error('❌ Failed to log import activity:', logError);
    }

    const isSuccess = successful > 0 && failed === 0;
    const message = isSuccess 
      ? `Successfully imported ${successful} leads with status: ${customStatus}`
      : `Import completed with issues: ${successful} successful, ${failed} failed, ${skipped} skipped`;

    console.log(`📊 Import summary: ${successful} successful, ${failed} failed, ${skipped} skipped`);

    return {
      success: isSuccess,
      message,
      summary: {
        total,
        successful,
        skipped,
        failed
      },
      errors,
      successfulLeads,
      skippedLeads,
      failedLeads
    };

  } catch (error) {
    console.error('❌ CSV import failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      message: `Import failed: ${errorMessage}`,
      summary: {
        total: 0,
        successful,
        skipped,
        failed
      },
      errors: [errorMessage, ...errors],
      successfulLeads,
      skippedLeads,
      failedLeads
    };
  }
} 