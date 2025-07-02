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

    // Detect if this is a borrower playbook by checking if contacts link to borrowers
    const firstContact = await db
      .select({
        lead_id: playbook_contacts.lead_id,
      })
      .from(playbook_contacts)
      .where(eq(playbook_contacts.playbook_id, playbookId))
      .limit(1);

    if (firstContact.length === 0) {
      // No contacts yet, default to lead playbook sync
      const result = await syncPlaybookContacts(playbookId);
      const status = result.success ? 200 : 400;
      return NextResponse.json(result, { status });
    }

    // Check if the contact's lead_id refers to a borrower or a lead
    const contactId = firstContact[0]?.lead_id;
    
    // Try to find in borrowers table first
    const borrowerExists = await db
      .select({ id: borrowers.id })
      .from(borrowers)
      .where(eq(borrowers.id, contactId))
      .limit(1);

    if (borrowerExists.length > 0) {
      // This is a borrower playbook - use borrower sync with default filters
      const defaultBorrowerFilters = {
        status: "",
        aa_status: "",
        performance_bucket: "",
        assigned_filter: "assigned_to_me",
      };
      
      const result = await syncBorrowerPlaybookContacts(playbookId, defaultBorrowerFilters);
      const status = result.success ? 200 : 400;
      return NextResponse.json(result, { status });
    } else {
      // This is a lead playbook - use lead sync
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