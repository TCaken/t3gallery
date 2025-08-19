/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { appointments, leads, users } from '~/server/db/schema';
import { and, gte, lte, eq } from 'drizzle-orm';

function censorName(name: string | null | undefined): string {
  if (!name || name.length < 2) return name ?? '';
  if(name.length === 2) return name.slice(0, 1) + '*';
  return name.slice(0, 2) + '*'.repeat(Math.max(0, name.length - 4)) + name.slice(-2);
}

function censorPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 5) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 5) + digits.slice(-5);
}

function censorEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!user || !domain) return '';
  return user[0] + '*'.repeat(Math.max(0, user.length - 1)) + '@' + domain;
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key, start_datetime, end_datetime } = body;
    const validApiKey = process.env.BORROWER_SYNC_API_KEY;
    if (!api_key || !validApiKey || api_key !== validApiKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }
    if (!start_datetime || !end_datetime) {
      return NextResponse.json({ error: 'start_datetime and end_datetime are required (UTC ISO strings)' }, { status: 400 });
    }
    // Query appointments with joins
    const rows = await db.select({
      id: appointments.id,
      start_datetime: appointments.start_datetime,
      end_datetime: appointments.end_datetime,
      status: appointments.status,
      loan_status: appointments.loan_status,
      loan_notes: appointments.loan_notes,
      lead_id: leads.id,
      lead_name: leads.full_name,
      lead_phonenumber: leads.phone_number,
      lead_email: leads.email,
      lead_source: leads.source,
      lead_status: leads.status,
      agent_first_name: users.first_name,
      agent_last_name: users.last_name,
      agent_email: users.email
    })
      .from(appointments)
      .innerJoin(leads, eq(appointments.lead_id, leads.id))
      .innerJoin(users, eq(appointments.created_by, users.id))
      .where(and(
        gte(appointments.start_datetime, new Date(start_datetime)),
        lte(appointments.start_datetime, new Date(end_datetime))
      ))
      .orderBy(appointments.start_datetime);

    // Concatenate agent_name in JS and censor lead fields
    const data = rows.map(row => ({
      ...row,
      agent_name: `${row.agent_first_name ?? ''} ${row.agent_last_name ?? ''}`.trim(),
      lead_name: censorName(row.lead_name),
      lead_phonenumber: censorPhone(row.lead_phonenumber),
      lead_email: censorEmail(row.lead_email)
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error in appointments/list:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 