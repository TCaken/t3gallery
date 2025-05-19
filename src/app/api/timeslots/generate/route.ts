import { NextResponse } from 'next/server';
import { db } from '~/server/db';
import { calendar_settings, timeslots, calendar_exceptions } from '~/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { format, addDays, isBefore, isEqual } from 'date-fns';

// Define types for our data structures
interface CalendarException {
  id: number;
  date: string | Date;
  is_closed: boolean;
  reason?: string;
  created_at: Date;
  updated_at?: Date;
}

// Schema for request validation
const RequestSchema = z.object({
  days_ahead: z.number().min(1).max(90).default(30),
  calendar_setting_id: z.number().optional(),
  api_key: z.string(),
});

// Schema for time validation
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

/**
 * Generates timeslots for the specified number of days ahead based on calendar settings
 */
export async function POST(request: Request) {
  try {
    // Get API key from environment variables
    const validApiKey = process.env.API_KEY;
    if (!validApiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not configured on server' },
        { status: 500 }
      );
    }

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = RequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: validationResult.error },
        { status: 400 }
      );
    }

    const { days_ahead, calendar_setting_id, api_key } = validationResult.data;

    // Validate API key
    if (api_key !== validApiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Get the current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate the end date (today + days_ahead)
    const endDate = addDays(today, days_ahead);
    
    // Format dates for database queries
    const todayStr = format(today, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch all calendar settings
    const settingsQuery = db.select().from(calendar_settings);
    
    const filteredSettingsQuery = calendar_setting_id ? 
      settingsQuery.where(eq(calendar_settings.id, calendar_setting_id)) : 
      settingsQuery;
    
    const settings = await filteredSettingsQuery;
    
    if (settings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No calendar settings found' },
        { status: 404 }
      );
    }

    // Fetch calendar exceptions for the date range
    const exceptions = await db.select()
      .from(calendar_exceptions)
      .where(
        and(
          gte(calendar_exceptions.date, todayStr),
          lte(calendar_exceptions.date, endDateStr)
        )
      ) as CalendarException[];

    // Map exceptions by date for easy lookup
    const exceptionMap = new Map<string, CalendarException>();
    exceptions.forEach(exception => {
      exceptionMap.set(format(new Date(exception.date), 'yyyy-MM-dd'), exception);
    });

    // Track created timeslots
    const createdTimeslots = [];
    const errors = [];

    // Process each calendar setting
    for (const setting of settings) {
      try {
        // Parse working days (assuming stored as array of day numbers, e.g., [1,2,3,4,5] for Mon-Fri)
        const workingDays: number[] = setting.working_days as number[] ?? [1, 2, 3, 4, 5]; // Default to Mon-Fri
        
        // Validate start and end times
        if (!setting.daily_start_time || !setting.daily_end_time) {
          errors.push(`Calendar setting ${setting.id} missing start or end time`);
          continue;
        }
        
        // Ensure we have a slot duration
        const slotDuration = setting.slot_duration_minutes ?? 30; // Default to 30 minutes
        
        // Parse business hours
        const startTime = parseTime(setting.daily_start_time.toString());
        const endTime = parseTime(setting.daily_end_time.toString());
        
        if (!startTime || !endTime) {
          errors.push(`Invalid time format in calendar setting ${setting.id}`);
          continue;
        }

        // Get existing timeslots to avoid duplicates
        const existingTimeslots = await db.select({
          date: timeslots.date,
          start_time: timeslots.start_time,
          end_time: timeslots.end_time,
        })
        .from(timeslots)
        .where(
          and(
            gte(timeslots.date, todayStr),
            lte(timeslots.date, endDateStr),
            eq(timeslots.calendar_setting_id, setting.id)
          )
        );

        // Create a map of existing timeslots for quick lookup
        const existingTimeslotMap = new Map();
        existingTimeslots.forEach(slot => {
          const key = `${format(new Date(slot.date), 'yyyy-MM-dd')}_${slot.start_time}_${slot.end_time}`;
          existingTimeslotMap.set(key, true);
        });

        // Generate timeslots for each day in the range
        let currentDate = new Date(today);
        
        while (isBefore(currentDate, endDate) || isEqual(currentDate, endDate)) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const dayOfWeek = currentDate.getDay() || 7; // Convert Sunday (0) to 7 for ISO week format
          
          // Check if this is a working day
          if (workingDays.includes(dayOfWeek)) {
            // Check for exceptions (holidays, closures)
            const exception = exceptionMap.get(dateStr);
            
            // Skip this day if it's marked as closed in exceptions
            if (!exception?.is_closed) {
              // Generate time slots for this day
              let slotStart = startTime;
              
              while (slotStart < endTime) {
                // Calculate slot end time
                const slotEndHours = Math.floor(slotStart / 60) + Math.floor((slotStart % 60 + slotDuration) / 60);
                const slotEndMinutes = (slotStart % 60 + slotDuration) % 60;
                const slotEnd = slotEndHours * 60 + slotEndMinutes;
                
                // Only create slots that end before or at the end time
                if (slotEnd <= endTime) {
                  // Format times
                  const startTimeStr = formatTime(slotStart);
                  const endTimeStr = formatTime(slotEnd);
                  const slotKey = `${dateStr}_${startTimeStr}_${endTimeStr}`;
                  
                  // Check if this slot already exists
                  if (!existingTimeslotMap.has(slotKey)) {
                    // Create the new timeslot
                    const newTimeslot = {
                      date: dateStr,
                      start_time: startTimeStr,
                      end_time: endTimeStr,
                      max_capacity: setting.default_max_capacity ?? 1,
                      occupied_count: 0,
                      calendar_setting_id: setting.id,
                      is_disabled: false,
                    };
                    
                    // Insert into database
                    await db.insert(timeslots).values(newTimeslot);
                    createdTimeslots.push({
                      date: dateStr,
                      start_time: startTimeStr,
                      end_time: endTimeStr,
                      calendar_setting_id: setting.id
                    });
                  }
                }
                
                // Move to next slot
                slotStart += slotDuration;
              }
            }
          }
          
          // Move to next day
          currentDate = addDays(currentDate, 1);
        }
      } catch (error) {
        errors.push(`Error processing calendar setting ${setting.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return NextResponse.json({
      success: true,
      created_count: createdTimeslots.length,
      timeslots: createdTimeslots,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error generating timeslots:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate timeslots',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to parse time string (HH:MM) to minutes since midnight
 */
function parseTime(timeStr: string): number {
  try {
    const validation = TimeSchema.safeParse(timeStr);
    if (!validation.success) {
      return 0;
    }
    
    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr ?? '0', 10);
    const minutes = parseInt(minutesStr ?? '0', 10);
    return hours * 60 + minutes;
  } catch (e) {
    return 0;
  }
}

/**
 * Helper function to format minutes since midnight to HH:MM
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
} 