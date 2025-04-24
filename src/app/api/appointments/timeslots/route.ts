import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { auth } from '@clerk/nextjs/server';
import { 
  timeslots, 
  calendar_settings, 
  calendar_exceptions 
} from '~/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { format, parseISO, addMinutes } from 'date-fns';

// POST /api/appointments/timeslots
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { date, calendarSettingId } = await req.json();
    
    if (!date || !calendarSettingId) {
      return NextResponse.json(
        { error: 'Date and calendarSettingId are required' }, 
        { status: 400 }
      );
    }
    
    // Parse the date
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay(); // 0-6, 0 is Sunday
    
    // Check if date is a holiday/exception
    const exceptions = await db
      .select()
      .from(calendar_exceptions)
      .where(eq(calendar_exceptions.date, selectedDate));
    
    const isClosed = exceptions.some(exc => exc.is_closed);
    
    if (isClosed) {
      return NextResponse.json(
        { error: 'This date is marked as closed/holiday' },
        { status: 400 }
      );
    }
    
    // Get calendar settings
    const [settings] = await db
      .select()
      .from(calendar_settings)
      .where(eq(calendar_settings.id, calendarSettingId));
    
    if (!settings) {
      return NextResponse.json(
        { error: 'Calendar settings not found' },
        { status: 404 }
      );
    }
    
    // Check if this is a working day
    const workingDays = settings.working_days as number[] || [1, 2, 3, 4, 5]; // Default Mon-Fri
    
    if (!workingDays.includes(dayOfWeek)) {
      return NextResponse.json(
        { error: 'This is not a working day in the selected calendar settings' },
        { status: 400 }
      );
    }
    
    // Generate timeslots for the day
    const slotDuration = settings.slot_duration_minutes || 60;
    const startTime = settings.daily_start_time || '09:00:00';
    const endTime = settings.daily_end_time || '17:00:00';
    const maxCapacity = settings.default_max_capacity || 1;
    
    // Create slots for this day
    const timeslotsToCreate = [];
    let currentTime = parseISO(`${format(selectedDate, 'yyyy-MM-dd')}T${startTime}`);
    const endTimeForDay = parseISO(`${format(selectedDate, 'yyyy-MM-dd')}T${endTime}`);
    
    while (currentTime < endTimeForDay) {
      const slotEndTime = addMinutes(currentTime, slotDuration);
      
      if (slotEndTime <= endTimeForDay) {
        timeslotsToCreate.push({
          date: selectedDate,
          start_time: format(currentTime, 'HH:mm:ss'),
          end_time: format(slotEndTime, 'HH:mm:ss'),
          max_capacity: maxCapacity,
          calendar_setting_id: settings.id,
          created_by: userId,
          created_at: new Date()
        });
      }
      
      currentTime = slotEndTime;
    }
    
    // Check if any timeslots already exist for this date & setting
    const existingSlots = await db
      .select()
      .from(timeslots)
      .where(
        and(
          eq(timeslots.date, selectedDate),
          eq(timeslots.calendar_setting_id, settings.id)
        )
      );
    
    if (existingSlots.length > 0) {
      return NextResponse.json(
        { message: `Timeslots already exist for this date (${existingSlots.length} slots)` },
        { status: 200 }
      );
    }
    
    // Insert the timeslots
    if (timeslotsToCreate.length > 0) {
      const result = await db.insert(timeslots).values(timeslotsToCreate).returning();
      
      return NextResponse.json({
        success: true,
        count: result.length,
        message: `Created ${result.length} timeslots for ${format(selectedDate, 'yyyy-MM-dd')}`
      });
    } else {
      return NextResponse.json(
        { error: 'No valid timeslots to create for this date and time range' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating timeslots:', error);
    return NextResponse.json(
      { error: 'Failed to create timeslots' },
      { status: 500 }
    );
  }
}

// // GET /api/appointments/timeslots?date=YYYY-MM-DD
// export async function GET(req: NextRequest) {
//   const { userId } = await auth();
//   if (!userId) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }
  
//   try {
//     const url = new URL(req.url);
//     const date = url.searchParams.get('date');
    
//     if (!date) {
//       return NextResponse.json(
//         { error: 'Date parameter is required' },
//         { status: 400 }
//       );
//     }
    
//     // Get timeslots for the date
//     const selectedDate = new Date(date);
//     const slots = await db
//       .select()
//       .from(timeslots)
//       .where(eq(timeslots.date, selectedDate));
    
//     return NextResponse.json({ slots });
//   } catch (error) {
//     console.error('Error fetching timeslots:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch timeslots' },
//       { status: 500 }
//     );
//   }
// } 