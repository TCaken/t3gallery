/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { leads, appointments } from '~/server/db/schema';
import { and, gte, lte, eq, inArray } from 'drizzle-orm';

function toSingaporeTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  // Singapore is UTC+8
  return new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
}

function censorName(name: string | null | undefined): string {
  if (!name) return '';
  return name[0] + '*'.repeat(Math.max(0, name.length - 1));
}

function censorPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
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

    // Build where clause for date filtering
    const whereClause = [];
    if (start_datetime) {
      whereClause.push(gte(leads.created_at, new Date(start_datetime)));
    }
    if (end_datetime) {
      whereClause.push(lte(leads.created_at, new Date(end_datetime)));
    }

    // Query leads
    const rows = await db.select({
      id: leads.id,
      full_name: leads.full_name,
      email: leads.email,
      status: leads.status,
      source: leads.source,
      assigned_to: leads.assigned_to,
      lead_type: leads.lead_type,
      created_at: leads.created_at,
      updated_at: leads.updated_at,
      created_by: leads.created_by,
      updated_by: leads.updated_by,
      phone_number: leads.phone_number,
      residential_status: leads.residential_status,
      employment_status: leads.employment_status,
      loan_purpose: leads.loan_purpose,
      existing_loans: leads.existing_loans,
      amount: leads.amount,
      eligibility_checked: leads.eligibility_checked,
      eligibility_status: leads.eligibility_status,
      eligibility_notes: leads.eligibility_notes,
      phone_number_2: leads.phone_number_2,
      phone_number_3: leads.phone_number_3,
      has_work_pass_expiry: leads.has_work_pass_expiry,
      has_payslip_3months: leads.has_payslip_3months,
      has_proof_of_residence: leads.has_proof_of_residence,
      proof_of_residence_type: leads.proof_of_residence_type,
      has_letter_of_consent: leads.has_letter_of_consent,
      employment_salary: leads.employment_salary,
      employment_length: leads.employment_length,
      outstanding_loan_amount: leads.outstanding_loan_amount,
      lead_score: leads.lead_score,
      contact_preference: leads.contact_preference,
      communication_language: leads.communication_language,
      follow_up_date: leads.follow_up_date,
      is_contactable: leads.is_contactable,
      is_deleted: leads.is_deleted,
      has_exported: leads.has_exported,
      exported_at: leads.exported_at,
      loan_status: leads.loan_status,
      loan_notes: leads.loan_notes
    })
      .from(leads)
      .where(whereClause.length > 0 ? and(...whereClause) : undefined)
      .orderBy(leads.created_at);

    // Get all appointments for these leads (for booked flag)
    const leadIds = rows.map(r => r.id);
    const appointmentsMap: Record<number, boolean> = {};
    if (leadIds.length > 0) {
      const appts = await db.select({ lead_id: appointments.lead_id, id: appointments.id })
        .from(appointments)
        .where(inArray(appointments.lead_id, leadIds));
      for (const a of appts) {
        appointmentsMap[a.lead_id] = true;
      }
    }

    // Compose response with computed fields and Singapore time
    const data = rows.map(row => {
      // Booked flag
      const booked = appointmentsMap[row.id] ? 'Yes' : 'No';
      // SEOLeads flag
      let SEOLeads = 'No';
      if (row.source === 'SEO' && row.eligibility_status === 'eligible') {
        SEOLeads = 'Yes';
      } else if (
        row.source === 'SEO' &&
        row.eligibility_status === 'ineligible' &&
        row.eligibility_notes &&
        [
          'new',
          'blacklisted',
          'assigned',
          'give_up',
          'no_answer'
        ].some(keyword => row.eligibility_notes!.toLowerCase().includes(keyword))
      ) {
        SEOLeads = 'Yes';
      }
      return {
        ...row,
        full_name: censorName(row.full_name),
        email: censorEmail(row.email),
        phone_number: censorPhone(row.phone_number),
        phone_number_2: censorPhone(row.phone_number_2),
        phone_number_3: censorPhone(row.phone_number_3),
        created_at: toSingaporeTime(row.created_at),
        updated_at: toSingaporeTime(row.updated_at),
        follow_up_date: toSingaporeTime(row.follow_up_date),
        exported_at: toSingaporeTime(row.exported_at),
        booked,
        SEOLeads
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error in leads/list:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 