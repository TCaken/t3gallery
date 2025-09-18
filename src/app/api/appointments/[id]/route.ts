import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/server/db';
import { appointments, leads, users } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

// GET - Fetch appointment details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const appointmentId = parseInt(params.id);
    
    if (isNaN(appointmentId)) {
      return NextResponse.json(
        { message: 'Invalid appointment ID' },
        { status: 400 }
      );
    }

    // Fetch appointment with related data
    const appointment = await db
      .select({
        id: appointments.id,
        lead_id: appointments.lead_id,
        agent_id: appointments.agent_id,
        status: appointments.status,
        loan_status: appointments.loan_status,
        loan_notes: appointments.loan_notes,
        notes: appointments.notes,
        lead_source: appointments.lead_source,
        start_datetime: appointments.start_datetime,
        end_datetime: appointments.end_datetime,
        created_at: appointments.created_at,
        updated_at: appointments.updated_at,
        created_by: appointments.created_by,
        updated_by: appointments.updated_by,
        // Lead data
        lead: {
          id: leads.id,
          full_name: leads.full_name,
          phone_number: leads.phone_number,
          email: leads.email,
          status: leads.status,
        },
        // Agent data
        agent: {
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          email: users.email,
        },
        // Creator data
        creator: {
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          email: users.email,
        }
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .leftJoin(users, and(eq(appointments.agent_id, users.id), eq(appointments.created_by, users.id)))
      .where(eq(appointments.id, appointmentId))
      .limit(1);


    if (appointment.length === 0) {
      return NextResponse.json(
        { message: 'Appointment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(appointment[0]);

  } catch (error) {
    console.error('Error fetching appointment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update appointment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const appointmentId = parseInt(params.id);
    
    if (isNaN(appointmentId)) {
      return NextResponse.json(
        { message: 'Invalid appointment ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { agent_id, created_by, loan_status, loan_notes, updated_by } = body;

    // Validate required fields
    if (!agent_id) {
      return NextResponse.json(
        { message: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Check if appointment exists
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (existingAppointment.length === 0) {
      return NextResponse.json(
        { message: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Validate agent exists
    if (agent_id) {
      const agent = await db
        .select()
        .from(users)
        .where(eq(users.id, agent_id))
        .limit(1);

      if (agent.length === 0) {
        return NextResponse.json(
          { message: 'Invalid agent ID' },
          { status: 400 }
        );
      }
    }

    // Validate creator exists (if provided)
    if (created_by) {
      const creator = await db
        .select()
        .from(users)
        .where(eq(users.id, created_by))
        .limit(1);

      if (creator.length === 0) {
        return NextResponse.json(
          { message: 'Invalid creator ID' },
          { status: 400 }
        );
      }
    }

    // Update appointment
    const updatedAppointment = await db
      .update(appointments)
      .set({
        agent_id,
        created_by: created_by || null,
        loan_status: loan_status || null,
        loan_notes: loan_notes || null,
        updated_by: updated_by || userId,
        updated_at: new Date(),
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    // Fetch updated appointment with related data
    const appointmentWithDetails = await db
      .select({
        id: appointments.id,
        lead_id: appointments.lead_id,
        agent_id: appointments.agent_id,
        status: appointments.status,
        loan_status: appointments.loan_status,
        loan_notes: appointments.loan_notes,
        notes: appointments.notes,
        lead_source: appointments.lead_source,
        start_datetime: appointments.start_datetime,
        end_datetime: appointments.end_datetime,
        created_at: appointments.created_at,
        updated_at: appointments.updated_at,
        created_by: appointments.created_by,
        updated_by: appointments.updated_by,
        // Lead data
        lead: {
          id: leads.id,
          full_name: leads.full_name,
          phone_number: leads.phone_number,
          email: leads.email,
          status: leads.status,
        },
        // Agent data
        agent: {
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          email: users.email,
        },
        // Creator data
        creator: {
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          email: users.email,
        }
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.lead_id, leads.id))
      .leftJoin(users, and(eq(appointments.agent_id, users.id), eq(appointments.created_by, users.id)))
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    return NextResponse.json(appointmentWithDetails[0]);

  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
