/**
 * Timezone utility functions for Singapore Time (SGT) conversion
 * Singapore is UTC+8 (no daylight saving time)
 */

/**
 * Convert UTC date to Singapore Time (SGT)
 * @param utcDate - Date in UTC
 * @returns Date converted to Singapore Time (UTC+8)
 */
export function convertUTCToSGT(utcDate: Date): Date {
  return new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
}

/**
 * Convert Singapore Time to UTC
 * @param sgtDate - Date in Singapore Time
 * @returns Date converted to UTC
 */
export function convertSGTToUTC(sgtDate: Date): Date {
  return new Date(sgtDate.getTime() - (8 * 60 * 60 * 1000));
}

/**
 * Get current Singapore Time
 * @returns Current date/time in Singapore timezone
 */
export function getCurrentSGT(): Date {
  return convertUTCToSGT(new Date());
}

/**
 * Format a date in Singapore timezone
 * @param date - Date to format (assumed to be in UTC if coming from database)
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string in Singapore timezone
 */
export function formatSGTDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const sgtDate = convertUTCToSGT(date);
  return sgtDate.toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    ...options
  });
}

/**
 * Get today's date in Singapore timezone as YYYY-MM-DD string
 * @returns Today's date in Singapore as YYYY-MM-DD format
 */
export function getTodaySGT(): string {
  const sgtNow = getCurrentSGT();
  return sgtNow.toISOString().split('T')[0]!;
}

/**
 * Parse a date string as Singapore time and convert to UTC for database storage
 * @param dateString - Date string in format like "2024-01-15T14:30:00"
 * @returns UTC date for database storage
 */
export function parseSGTToUTC(dateString: string): Date {
  const sgtDate = new Date(dateString);
  return convertSGTToUTC(sgtDate);
} 