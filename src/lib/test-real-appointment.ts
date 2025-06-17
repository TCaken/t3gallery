/**
 * Test script to fetch a real appointment and show SGT conversion
 */

import { db } from '../server/db';
import { appointments, leads } from '../server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { convertUTCToSGT, formatSGTDate } from './timezone';

async function testRealAppointment() {
  try {
    console.log('🔍 FETCHING REAL APPOINTMENT FROM DATABASE');
    console.log('==========================================');

    // Get the most recent appointment
    const result = await db
      .select({
        appointment: appointments,
        lead: leads
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .orderBy(desc(appointments.created_at))
      .limit(1);

    if (result.length === 0) {
      console.log('❌ No appointments found in database');
      return;
    }

    const rawAppointment = result[0]!.appointment;
    const lead = result[0]!.lead;

    console.log('\n📅 RAW DATABASE DATA (UTC):');
    console.log('Appointment ID:', rawAppointment.id);
    console.log('Lead Name:', lead?.full_name ?? 'Unknown');
    console.log('start_datetime (UTC):', rawAppointment.start_datetime.toISOString());
    console.log('end_datetime (UTC):', rawAppointment.end_datetime.toISOString());
    console.log('created_at (UTC):', rawAppointment.created_at.toISOString());
    console.log('Status:', rawAppointment.status);

    console.log('\n🇸🇬 CONVERTED TO SINGAPORE TIME (SGT):');
    const sgtStartTime = convertUTCToSGT(rawAppointment.start_datetime);
    const sgtEndTime = convertUTCToSGT(rawAppointment.end_datetime);
    const sgtCreatedAt = convertUTCToSGT(rawAppointment.created_at);

    console.log('start_datetime (SGT):', sgtStartTime.toISOString());
    console.log('end_datetime (SGT):', sgtEndTime.toISOString());
    console.log('created_at (SGT):', sgtCreatedAt.toISOString());

    console.log('\n📊 FORMATTED FOR USER DISPLAY:');
    console.log('Appointment Date:', formatSGTDate(rawAppointment.start_datetime, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
    console.log('Appointment Time:', formatSGTDate(rawAppointment.start_datetime, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' - ' + formatSGTDate(rawAppointment.end_datetime, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }));

    console.log('\n🔄 WHAT YOUR API RETURNS (TRANSFORMED):');
    const apiResponse = {
      ...rawAppointment,
      // Convert appointment times from UTC to SGT for display
      start_datetime: sgtStartTime,
      end_datetime: sgtEndTime,
      created_at: sgtCreatedAt,
      updated_at: rawAppointment.updated_at ? convertUTCToSGT(rawAppointment.updated_at) : null,
      // Keep original UTC times for reference
      start_datetime_utc: rawAppointment.start_datetime,
      end_datetime_utc: rawAppointment.end_datetime,
      // Include lead info
      lead: lead
    };

    console.log('API Response:');
    console.log(JSON.stringify({
      id: apiResponse.id,
      lead_id: apiResponse.lead_id,
      status: apiResponse.status,
      start_datetime: apiResponse.start_datetime.toISOString(),
      end_datetime: apiResponse.end_datetime.toISOString(),
      start_datetime_utc: apiResponse.start_datetime_utc.toISOString(),
      end_datetime_utc: apiResponse.end_datetime_utc.toISOString(),
      lead_name: lead?.full_name
    }, null, 2));

    console.log('\n⏰ TIME DIFFERENCE CALCULATION:');
    const hoursDifference = (sgtStartTime.getTime() - rawAppointment.start_datetime.getTime()) / (1000 * 60 * 60);
    console.log(`UTC → SGT: +${hoursDifference} hours`);
    console.log(`Example: ${rawAppointment.start_datetime.toISOString()} (UTC) → ${sgtStartTime.toISOString()} (SGT)`);

  } catch (error) {
    console.error('❌ Error fetching appointment:', error);
  }
}

// Run the test
testRealAppointment().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 