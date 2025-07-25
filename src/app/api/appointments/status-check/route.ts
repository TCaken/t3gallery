/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { leads, appointments } from '~/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

function getSingaporeDayRange(date: Date) {
  // Singapore is UTC+8
  const sgOffset = 8 * 60; // minutes
  // Get the year, month, day in Singapore time
  const sgDate = new Date(date.getTime() + sgOffset * 60 * 1000);
  const year = sgDate.getUTCFullYear();
  const month = sgDate.getUTCMonth();
  const day = sgDate.getUTCDate();
  // Start of day in Singapore time
  const startSG = new Date(Date.UTC(year, month, day, 0, 0, 0));
  // End of day in Singapore time
  const endSG = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  // Convert back to UTC
  const startUTC = new Date(startSG.getTime() - sgOffset * 60 * 1000);
  const endUTC = new Date(endSG.getTime() - sgOffset * 60 * 1000);
  return { startUTC, endUTC };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key, date } = body;

    const validApiKey = process.env.BORROWER_SYNC_API_KEY;
    if (!api_key || !validApiKey || api_key !== validApiKey) {
      console.error('❌ Unauthorized: Invalid API key', { provided: api_key });
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    const targetDate = date ? new Date(date) : new Date();
    const { startUTC, endUTC } = getSingaporeDayRange(targetDate);
    // console.log('🔍 Checking appointments for:', {
    //   startUTC,
    //   endUTC,
    //   targetDate: targetDate.toISOString()
    // });

    // Get all appointments for the Singapore day (in UTC)
    const appointmentsForDay = await db.select().from(appointments)
      .where(and(
        gte(appointments.start_datetime, startUTC),
        lte(appointments.start_datetime, endUTC)
      ));
    console.log('🔍 Found appointments:', appointmentsForDay.length);

    const results = [];

    for (const appointment of appointmentsForDay) {
      // Find the lead for this appointment
      let lead = null;
      if (appointment.lead_id) {
        const leadResult = await db.select().from(leads).where(eq(leads.id, appointment.lead_id)).limit(1);
        lead = leadResult[0] ?? null;
      }
      const code = appointment.loan_status ?? '';
      let webhookResult = null;
      let webhookStatus = 'not_triggered';
      if (code === 'R') {
        // Call rejection webhook
        const cleanPhoneNumber = lead?.phone_number?.replace(/^\+65/, '').replace(/[^\d]/g, '') ?? '';
        const rejectionWebhookUrl = process.env.WORKATO_SEND_REJECTION_WEBHOOK_URL;
        const webhookPayload = {
          phone_number: cleanPhoneNumber,
          lead_id: lead?.id,
          lead_name: lead?.full_name,
          appointment_id: appointment.id,
          code: code,
          timestamp: new Date().toISOString()
        };
        if (rejectionWebhookUrl && cleanPhoneNumber) {
          try {
            console.log('🚀 Triggering rejection webhook:', {
              url: rejectionWebhookUrl,
              payload: webhookPayload
            });
            const webhookResponse = await fetch(rejectionWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webhookPayload)
            });
            console.log('🔗 Webhook response status:', webhookResponse.status, webhookResponse.statusText);
            if (webhookResponse.ok) {
              webhookResult = await webhookResponse.json();
              webhookStatus = 'called';
              console.log('✅ Webhook call succeeded:', webhookResult);
            } else {
              webhookStatus = 'failed';
              webhookResult = { status: webhookResponse.status, statusText: webhookResponse.statusText };
              console.error('❌ Webhook call failed:', webhookResult);
            }
          } catch (err) {
            webhookStatus = 'error';
            webhookResult = { error: err instanceof Error ? err.message : 'Unknown error' };
            console.error('❌ Webhook call error:', webhookResult);
          }
        } else {
          webhookStatus = 'skipped';
          webhookResult = { reason: 'Missing webhook URL or phone number' };
          console.warn('⚠️ Skipping webhook call:', webhookResult);
        }
      }
      results.push({
        appointment_id: appointment.id,
        lead_id: lead?.id,
        webhook: webhookStatus,
        webhookResult
      });
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 