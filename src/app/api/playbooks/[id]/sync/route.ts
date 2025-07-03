import { NextRequest, NextResponse } from 'next/server';
import { syncPlaybookContacts, syncBorrowerPlaybookContacts } from '~/app/_actions/playbookManagement';
import { db } from "~/server/db";
import { playbook_contacts, borrowers, leads } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playbookId = parseInt(params.id);
    
    if (isNaN(playbookId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid playbook ID',
        },
        { status: 400 }
      );
    }

    // Check if request body specifies the playbook type explicitly
    let body = null;
    try {
      body = await request.json();
    } catch {
      // No body is fine, we'll use detection logic
    }

    const explicitType = body?.type; // "borrower" or "lead"

    if (explicitType === "borrower") {
      // EXPLICIT BORROWER PLAYBOOK: Use borrower sync with simplified filters
      console.log(`Playbook ${playbookId}: EXPLICIT BORROWER PLAYBOOK requested, using borrower sync`);
      
      const simplifiedBorrowerFilters = {
        assigned_filter: "assigned_to_me", // Only sync borrowers assigned to the playbook's agent
        // Ignoring other filters for simplicity: status, aa_status, performance_bucket
      };
      
      const result = await syncBorrowerPlaybookContacts(playbookId, simplifiedBorrowerFilters);
      const status = result.success ? 200 : 400;
      return NextResponse.json(result, { status });
    }

    if (explicitType === "lead") {
      // EXPLICIT LEAD PLAYBOOK: Use regular lead sync
      console.log(`Playbook ${playbookId}: EXPLICIT LEAD PLAYBOOK requested, using lead sync`);
      const result = await syncPlaybookContacts(playbookId);
      const status = result.success ? 200 : 400;
      return NextResponse.json(result, { status });
    }

    // AUTO-DETECTION LOGIC: Determine if this is a Lead Playbook or Borrower Playbook
    // We check the first contact to see if the lead_id refers to a borrower or lead
    console.log(`Playbook ${playbookId}: No explicit type provided, using auto-detection`);
    const firstContact = await db
      .select({
        lead_id: playbook_contacts.lead_id,
      })
      .from(playbook_contacts)
      .where(eq(playbook_contacts.playbook_id, playbookId))
      .limit(1);

    if (firstContact.length === 0) {
      // No contacts yet, default to lead playbook sync
      console.log(`Playbook ${playbookId}: No contacts found, defaulting to LEAD PLAYBOOK sync`);
      const result = await syncPlaybookContacts(playbookId);
      const status = result.success ? 200 : 400;
      return NextResponse.json(result, { status });
    }

    // Check if the contact's lead_id refers to a borrower or a lead
    const contactId = firstContact[0]?.lead_id;
    
    if (!contactId) {
      // Contact ID is invalid, default to lead playbook sync
      console.log(`Playbook ${playbookId}: Invalid contact ID, defaulting to LEAD PLAYBOOK sync`);
      const result = await syncPlaybookContacts(playbookId);
      const status = result.success ? 200 : 400;
      return NextResponse.json(result, { status });
    }
    
    // At this point, contactId is guaranteed to be a number
    // Try to find in borrowers table first
    const borrowerExists = await db
      .select({ id: borrowers.id })
      .from(borrowers)
      .where(eq(borrowers.id, contactId as number))
      .limit(1);

    if (borrowerExists.length > 0) {
      // BORROWER PLAYBOOK: Use borrower sync with simplified filters (only assigned agent)
      console.log(`Playbook ${playbookId}: Detected BORROWER PLAYBOOK, using borrower sync`);
      
      const simplifiedBorrowerFilters = {
        assigned_filter: "assigned_to_me", // Only sync borrowers assigned to the playbook's agent
        // Ignoring other filters for simplicity: status, aa_status, performance_bucket
      };
      
      const result = await syncBorrowerPlaybookContacts(playbookId, simplifiedBorrowerFilters);
      const status = result.success ? 200 : 400;
      return NextResponse.json(result, { status });
    } else {
      // LEAD PLAYBOOK: Use regular lead sync
      console.log(`Playbook ${playbookId}: Detected LEAD PLAYBOOK, using lead sync`);
      const result = await syncPlaybookContacts(playbookId);
      const status = result.success ? 200 : 400;
      return NextResponse.json(result, { status });
    }

  } catch (error) {
    console.error('Error syncing playbook contacts:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to sync playbook contacts',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 