import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { auth } from '@clerk/nextjs/server';
import { 
  timeslots, 
  calendar_settings
} from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { format, parseISO, addMinutes, addDays, eachDayOfInterval } from 'date-fns';

// GET /api/appointments/initialize
// This will create default calendar settings and generate timeslots for the next 30 days
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Create default calendar settings
    const calendarSettingName = 'Default Working Hours';
    const workingDays = [1, 2, 3, 4, 5]; // Monday to Friday
    const dailyStartTime = '09:00:00'; // 9 AM
    const dailyEndTime = '17:00:00'; // 5 PM
    const slotDuration = 60; // 1 hour
    const maxCapacity = 1;
    
    // Check if settings already exist
    const existingSettings = await db
      .select()
      .from(calendar_settings)
      .where(eq(calendar_settings.name, calendarSettingName))
      .limit(1);
    
    let calendarSettingId: number;
    
    if (existingSettings.length > 0) {
      // Use existing settings
      calendarSettingId = existingSettings[0].id;
    } else {
      // Create new settings
      const [newSettings] = await db.insert(calendar_settings).values({
        name: calendarSettingName,
        working_days: workingDays,
        daily_start_time: dailyStartTime,
        daily_end_time: dailyEndTime,
        slot_duration_minutes: slotDuration,
        default_max_capacity: maxCapacity,
        timezone: 'UTC',
        created_by: userId,
        created_at: new Date()
      }).returning();
      
      calendarSettingId = newSettings.id;
    }
    
    // 2. Generate timeslots for the next 30 days
    const today = new Date();
    const startDate = today;
    const endDate = addDays(today, 30);
    
    // Get all days in the date range
    const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Generate timeslots for each working day
    const timeslotsToCreate = [];
    
    for (const day of daysInRange) {
      const dayOfWeek = day.getDay(); // 0-6, 0 is Sunday
      
      // Skip if not a working day
      if (!workingDays.includes(dayOfWeek)) {
        continue;
      }
      
      // Create slots for this day
      let currentTime = parseISO(`${format(day, 'yyyy-MM-dd')}T${dailyStartTime}`);
      const endTimeForDay = parseISO(`${format(day, 'yyyy-MM-dd')}T${dailyEndTime}`);
      
      while (currentTime < endTimeForDay) {
        const slotEndTime = addMinutes(currentTime, slotDuration);
        
        if (slotEndTime <= endTimeForDay) {
          // Check if this timeslot already exists
          const existingSlot = await db
            .select()
            .from(timeslots)
            .where(
              eq(timeslots.date, day),
              eq(timeslots.start_time, format(currentTime, 'HH:mm:ss')),
              eq(timeslots.end_time, format(slotEndTime, 'HH:mm:ss')),
              eq(timeslots.calendar_setting_id, calendarSettingId)
            )
            .limit(1);
          
          // Only create if it doesn't exist
          if (existingSlot.length === 0) {
            timeslotsToCreate.push({
              date: day,
              start_time: format(currentTime, 'HH:mm:ss'),
              end_time: format(slotEndTime, 'HH:mm:ss'),
              max_capacity: maxCapacity,
              calendar_setting_id: calendarSettingId,
              created_by: userId,
              created_at: new Date()
            });
          }
        }
        
        currentTime = slotEndTime;
      }
    }
    
    // Insert all generated timeslots
    let createdCount = 0;
    if (timeslotsToCreate.length > 0) {
      // Insert in batches to avoid DB limits
      const batchSize = 100;
      for (let i = 0; i < timeslotsToCreate.length; i += batchSize) {
        const batch = timeslotsToCreate.slice(i, i + batchSize);
        const result = await db.insert(timeslots).values(batch).returning();
        createdCount += result.length;
      }
    }
    
    // 3. Return a success message
    return NextResponse.json({
      success: true,
      message: `Initialized calendar system with:
        - 1 calendar setting (ID: ${calendarSettingId})
        - ${createdCount} timeslots for the next 30 days`,
      calendarSettingId,
      timeslotsCreated: createdCount
    });
  } catch (error) {
    console.error('Error initializing calendar system:', error);
    return NextResponse.json(
      { error: 'Failed to initialize calendar system' },
      { status: 500 }
    );
  }
} 