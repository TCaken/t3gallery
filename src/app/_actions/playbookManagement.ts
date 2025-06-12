/* eslint-disable @typescript-eslint/no-unsafe-return */
"use server";

import { db } from "~/server/db";
import { leads, playbooks, playbook_contacts, users } from "~/server/db/schema";
import { eq, and, inArray, not, sql } from "drizzle-orm";

interface PlaybookResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Get API key from environment
function getApiKey(): string {
  const apiKey = process.env.SAMESPACE_API_KEY;
  if (!apiKey) {
    throw new Error('SAMESPACE_API_KEY environment variable is not set');
  }
  return apiKey;
}

// Check playbook status in Samespace
async function checkPlaybookStatus(playbookId: string) {
  const apiKey = getApiKey();
  
  const query = `
    query GetPlaybook($id: ID!) {
      getPlaybook(_id: $id) {
        _id
        name
        status
      }
    }
  `;

  try {
    const response = await fetch('https://api.capcfintech.com/api/playbook/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        query,
        variables: { id: playbookId },
      }),
    });

    if (!response.ok) {
      throw new Error(`Samespace API error ${response.status}`);
    }

    const result = await response.json();
    console.log('Samespace playbook:', result);
    return result.data?.getPlaybook;
  } catch (error) {
    console.error('Error checking playbook status:', error);
    return null;
  }
}

// Create contact in Samespace
async function createSamespaceContact(contact: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dataSource: string;
}) {
  const apiKey = getApiKey();
  
  const query = `
    mutation CreateContact($properties: [KeyValueInput!]!, $module: ID, $moduleName: String) {
      createContact(properties: $properties, module: $module, moduleName: $moduleName) {
        _id
      }
    }
  `;

  const variables = {
    module: "6303289128a0e96163bd0dcd",
    properties: [
      { key: "company", value: "AirConnect" },
      { key: "dataSource", value: contact.dataSource },
      { key: "firstName", value: contact.firstName },
      { key: "lastName", value: contact.lastName },
      { key: "phoneNumber", value: contact.phoneNumber}
      // { key: "work", value: ["6583992504","6588756328"][Math.floor(Math.random() * 2)] },
    ],
  };

  // console.log('Creating Samespace contact:', { contact, variables });

  const response = await fetch('https://api.capcfintech.com/api/playbook/contacts/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Samespace API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((err: any) => err.message).join(', ');
    throw new Error(`Samespace API returned errors: ${errorMessages}`);
  }

  return result.data?.createContact;
}

// Update playbook with new contacts
async function updatePlaybookContacts(playbookId: string, phoneNumbers: string[]) {
  const apiKey = getApiKey();
  
  const phoneFilters = phoneNumbers.map(phone => ({
    key: 'phoneNumber',
    condition: 'IS',
    value: phone.replace(/^\+65/, '65'),
  }));

  const rules = {
    filters: {
      and: [
        {
          or: phoneFilters,
        },
        {
          or: [
            {
              key: 'company',
              condition: 'IS',
              value: 'AirConnect',
            },
          ],
        },
      ],
    },
    type: 'Native',
  };

  const query = `
    mutation UpdatePlaybook($id: ID!, $payload: PlaybookInput!) {
      updatePlaybook(_id: $id, payload: $payload) {
        _id
        name
        status
      }
    }
  `;

  const response = await fetch('https://api.capcfintech.com/api/playbook/append', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      query,
      variables: {
        id: playbookId,
        payload: { rules },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Samespace playbook update error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((err: any) => err.message).join(', ');
    throw new Error(`Samespace playbook update returned errors: ${errorMessages}`);
  }

  return result.data?.updatePlaybook;
}

// Start playbook in Samespace
async function startSamespacePlaybook(playbookId: string) {
  const apiKey = getApiKey();
  
  const query = `
    mutation StartPlaybook($id: ID!) {
      startPlaybook(_id: $id)
    }
  `;

  const response = await fetch('https://api.capcfintech.com/api/playbook/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      query,
      variables: { id: playbookId },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Samespace start playbook error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((err: any) => err.message).join(', ');
    throw new Error(`Samespace start playbook returned errors: ${errorMessages}`);
  }

  // Return success indicator since mutation doesn't return data
  return { success: true };
}

// Stop playbook in Samespace
async function stopSamespacePlaybook(playbookId: string) {
  const apiKey = getApiKey();
  
  const query = `
    mutation StopPlaybook($id: ID!) {
      stopPlaybook(_id: $id)
    }
  `;

  const response = await fetch('https://api.capcfintech.com/api/playbook/stop', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      query,
      variables: { id: playbookId },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Samespace stop playbook error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((err: any) => err.message).join(', ');
    throw new Error(`Samespace stop playbook returned errors: ${errorMessages}`);
  }

  // Return success indicator since mutation doesn't return data
  return { success: true };
}

// Create and register a new playbook
export async function createAndRegisterPlaybook(
  name: string,
  agentId: string,
  callScript?: string,
  timesetId?: string,
  teamId?: string
): Promise<PlaybookResult> {
  try {
    console.log('Creating and registering playbook:', { name, agentId, callScript });

    // Get agent's assigned leads to create initial contacts
    const agentLeads = await db
      .select({
        id: leads.id,
        phone_number: leads.phone_number,
        full_name: leads.full_name,
        source: leads.source,
      })
      .from(leads)
      .where(
        and(
          eq(leads.assigned_to, agentId),
          eq(leads.status, 'assigned'),
          eq(leads.is_deleted, false)
        )
      )
      .limit(50);

    if (agentLeads.length === 0) {
      return {
        success: false,
        message: 'No assigned leads found for this agent',
      };
    }

    const phoneNumbers = agentLeads.map(lead => lead.phone_number);

    // Create playbook in Samespace
    const samespacePlaybook = await createSamespacePlaybook({
      name,
      phoneNumbers,
      callScript,
      timesetId,
      teamId,
    });

    if (!samespacePlaybook || !samespacePlaybook._id) {
      return {
        success: false,
        message: 'Failed to create playbook in Samespace',
      };
    }

    // Register playbook in our database
    const [newPlaybook] = await db
      .insert(playbooks)
      .values({
        samespace_playbook_id: samespacePlaybook._id,
        name: name,
        agent_id: agentId,
        is_active: true,
      })
      .returning();

    // Create contact records for tracking
    const contactRecords = agentLeads.map(lead => {
      const [firstName, ...lastNameParts] = (lead.full_name || 'Unknown').split(' ');
      return {
        playbook_id: newPlaybook.id,
        lead_id: lead.id,
        phone_number: lead.phone_number,
        first_name: firstName || 'Unknown',
        last_name: lastNameParts.join(' ') || '',
        data_source: lead.source || 'Unknown',
        status: 'created',
        sync_status: 'synced',
      };
    });

    await db.insert(playbook_contacts).values(contactRecords);

    return {
      success: true,
      message: `Playbook created successfully with ${agentLeads.length} contacts`,
      data: {
        ...newPlaybook,
        samespace_playbook: samespacePlaybook,
        contact_count: agentLeads.length,
      },
    };

  } catch (error) {
    console.error('Error creating and registering playbook:', error);
    return {
      success: false,
      message: 'Failed to create and register playbook',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Register an existing playbook
export async function registerPlaybook(
  samespacePlaybookId: string,
  name: string,
  agentId: string
): Promise<PlaybookResult> {
  try {
    console.log('Registering existing playbook:', { samespacePlaybookId, name, agentId });

    // Check if playbook already exists
    const existingPlaybook = await db
      .select()
      .from(playbooks)
      .where(eq(playbooks.samespace_playbook_id, samespacePlaybookId))
      .limit(1);
    console.log('Existing playbook:', existingPlaybook);

    if (existingPlaybook.length > 0) {
      console.log('Playbook already registered:', existingPlaybook[0]);
      return {
        success: false,
        message: 'Playbook already registered',
        data: existingPlaybook[0],
      };
    }

    // Verify the playbook exists in Samespace
    const samespacePlaybook = await checkPlaybookStatus(samespacePlaybookId);
    console.log('Samespace playbook:', samespacePlaybook);
    if (!samespacePlaybook) {
      return {
        success: false,
        message: 'Playbook not found in Samespace',
      };
    }
    console.log('Samespace playbook:', samespacePlaybook);

    // Create playbook record
    const [newPlaybook] = await db
      .insert(playbooks)
      .values({
        samespace_playbook_id: samespacePlaybookId,
        name: name,
        agent_id: agentId,
        is_active: true,
      })
      .returning();

    return {
      success: true,
      message: 'Playbook registered successfully',
      data: newPlaybook,
    };

  } catch (error) {
    console.error('Error registering playbook:', error);
    return {
      success: false,
      message: 'Failed to register playbook',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Start a playbook
export async function startPlaybook(playbookId: number): Promise<PlaybookResult> {
  try {
    const [playbook] = await db
      .select()
      .from(playbooks)
      .where(eq(playbooks.id, playbookId))
      .limit(1);

    if (!playbook) {
      return {
        success: false,
        message: 'Playbook not found',
      };
    }

    const result = await startSamespacePlaybook(playbook.samespace_playbook_id);

    return {
      success: true,
      message: 'Playbook started successfully',
      data: result,
    };

  } catch (error) {
    console.error('Error starting playbook:', error);
    return {
      success: false,
      message: 'Failed to start playbook',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Stop a playbook
export async function stopPlaybook(playbookId: number): Promise<PlaybookResult> {
  try {
    const [playbook] = await db
      .select()
      .from(playbooks)
      .where(eq(playbooks.id, playbookId))
      .limit(1);

    if (!playbook) {
      return {
        success: false,
        message: 'Playbook not found',
      };
    }

    const result = await stopSamespacePlaybook(playbook.samespace_playbook_id);

    return {
      success: true,
      message: 'Playbook stopped successfully',
      data: result,
    };

  } catch (error) {
    console.error('Error stopping playbook:', error);
    return {
      success: false,
      message: 'Failed to stop playbook',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Delete a playbook
export async function deletePlaybook(playbookId: number): Promise<PlaybookResult> {
  try {
    const [playbook] = await db
      .select()
      .from(playbooks)
      .where(eq(playbooks.id, playbookId))
      .limit(1);

    if (!playbook) {
      return {
        success: false,
        message: 'Playbook not found',
      };
    }

    // First stop the playbook if it's running
    try {
      await stopSamespacePlaybook(playbook.samespace_playbook_id);
    } catch (error) {
      console.log('Playbook might already be stopped:', error);
    }

    // Delete all contacts for this playbook from our database
    await db
      .delete(playbook_contacts)
      .where(eq(playbook_contacts.playbook_id, playbookId));

    // Mark playbook as inactive (soft delete)
    await db
      .delete(playbooks)
      .where(eq(playbooks.id, playbookId));

    return {
      success: true,
      message: 'Playbook deleted successfully',
      data: { playbookId },
    };

  } catch (error) {
    console.error('Error deleting playbook:', error);
    return {
      success: false,
      message: 'Failed to delete playbook',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get playbooks for an agent
export async function getAgentPlaybooks(agentId: string): Promise<PlaybookResult> {
  try {
    const agentPlaybooks = await db
      .select({
        id: playbooks.id,
        samespace_playbook_id: playbooks.samespace_playbook_id,
        name: playbooks.name,
        is_active: playbooks.is_active,
        last_synced_at: playbooks.last_synced_at,
        contact_count: playbook_contacts.id,
      })
      .from(playbooks)
      .leftJoin(playbook_contacts, eq(playbooks.id, playbook_contacts.playbook_id))
      .where(eq(playbooks.agent_id, agentId));

    // Group by playbook and count contacts
    const playbookMap = new Map();
    for (const row of agentPlaybooks) {
      const key = row.id;
      if (!playbookMap.has(key)) {
        playbookMap.set(key, {
          ...row,
          contact_count: 0,
        });
      }
      if (row.contact_count) {
        playbookMap.get(key).contact_count++;
      }
    }

    const result = Array.from(playbookMap.values());

    return {
      success: true,
      message: `Found ${result.length} playbooks`,
      data: result,
    };

  } catch (error) {
    console.error('Error getting agent playbooks:', error);
    return {
      success: false,
      message: 'Failed to get playbooks',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Morning sync: Create contacts and update playbook
export async function syncPlaybookContacts(playbookId: number): Promise<PlaybookResult> {
  try {
    console.log('Starting playbook contact sync:', { playbookId });

    // Get playbook info
    const [playbook] = await db
      .select()
      .from(playbooks)
      .where(eq(playbooks.id, playbookId))
      .limit(1);

    if (!playbook) {
      return {
        success: false,
        message: 'Playbook not found',
      };
    }

    // Get agent's follow-up leads that are not already in this playbook
    const existingLeadIds = await db
      .select({ lead_id: playbook_contacts.lead_id })
      .from(playbook_contacts)
      .where(eq(playbook_contacts.playbook_id, playbookId));

    const existingIds = existingLeadIds.map(row => row.lead_id);

    const leadsQuery = db
      .select({
        id: leads.id,
        phone_number: leads.phone_number,
        full_name: leads.full_name,
        source: leads.source,
      })
      .from(leads)
      .where(
        and(
          eq(leads.assigned_to, playbook.agent_id),
          eq(leads.status, 'assigned'),
          eq(leads.is_deleted, false),
          not(inArray(leads.id, existingIds))
        )
      )
      .limit(300);

    const followUpLeads = await leadsQuery;

    console.log(`Found ${followUpLeads.length} new follow-up leads for agent ${playbook.agent_id}`);

    if (followUpLeads.length === 0) {
      return {
        success: true,
        message: 'No new follow-up leads to sync',
        data: {
          contactsCreated: 0,
          contactsFailed: 0,
          playbookUpdated: false,
        },
      };
    }

    // Create contacts and track results
    const results = [];
    const successfulContacts = [];

    for (const lead of followUpLeads) {
      console.log('Creating contact for lead:', lead);
      try {
        const name = lead.full_name?.replace(/[^\p{L}\p{N} ]/ug, ' ');
        const firstName = (name ?? 'Lead');
        const lastName = 'AirConnect';

        // Create contact in Samespace
        const contact = await createSamespaceContact({
          firstName: firstName ?? 'AirConnect',
          lastName: lastName,
          phoneNumber: lead.phone_number.replace(/^\+65/, '65'),
          dataSource: lead.source ?? 'AirConnect',
        });

        if (contact?._id) {
          // Save to our database
          await db.insert(playbook_contacts).values({
            playbook_id: playbookId,
            lead_id: lead.id,
            samespace_contact_id: contact._id,
            phone_number: lead.phone_number,
            first_name: firstName || 'Unknown',
            last_name: lastName,
            data_source: lead.source || 'Unknown',
            status: 'created',
            sync_status: 'synced',
            api_response: contact,
          });

          results.push({
            leadId: lead.id,
            leadName: lead.full_name || 'Unknown',
            phone: lead.phone_number,
            status: 'created',
          });

          successfulContacts.push(lead.phone_number);
        } else {
          throw new Error('No contact ID returned from Samespace');
        }
      } catch (error) {
        console.error(`Failed to create contact for lead ${lead.id}:`, error);
        
        // Save failed attempt to database
        await db.insert(playbook_contacts).values({
          playbook_id: playbookId,
          lead_id: lead.id,
          phone_number: lead.phone_number,
          first_name: (lead.full_name ?? 'Unknown').split(' ')[0] ?? 'Unknown',
          last_name: (lead.full_name ?? 'Unknown').split(' ').slice(1).join(' ') ?? '',
          data_source: lead.source ?? 'Unknown',
          status: 'failed',
          sync_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        results.push({
          leadId: lead.id,
          leadName: lead.full_name || 'Unknown',
          phone: lead.phone_number,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update playbook with ALL contacts (existing + new successful ones)
    let playbookUpdated = false;
    if (successfulContacts.length > 0) {
      try {
        // Get ALL contacts for this playbook (existing + new)
        const allPlaybookContacts = await db
          .select({
            phone_number: playbook_contacts.phone_number,
          })
          .from(playbook_contacts)
          .where(eq(playbook_contacts.playbook_id, playbookId));

        const allPhoneNumbers = allPlaybookContacts.map(contact => 
          contact.phone_number.replace(/^\+65/, '65')
        );

        console.log(`Updating playbook with ${allPhoneNumbers.length} total contacts (${allPlaybookContacts.length - successfulContacts.length} existing + ${successfulContacts.length} new)`);
        
        await updatePlaybookContacts(playbook.samespace_playbook_id, allPhoneNumbers);
        playbookUpdated = true;
        
        // Update last synced timestamp
        await db
          .update(playbooks)
          .set({ last_synced_at: new Date() })
          .where(eq(playbooks.id, playbookId));

        console.log(`Updated playbook ${playbook.samespace_playbook_id} with ${allPhoneNumbers.length} total contacts`);
      } catch (error) {
        console.error('Failed to update playbook:', error);
      }
    }

    const contactsCreated = results.filter(r => r.status === 'created').length;
    const contactsFailed = results.filter(r => r.status === 'failed').length;

    return {
      success: true,
      message: `Sync completed: ${contactsCreated} created, ${contactsFailed} failed, playbook ${playbookUpdated ? 'updated' : 'not updated'}`,
      data: {
        contactsCreated,
        contactsFailed,
        playbookUpdated,
        details: results,
      },
    };

  } catch (error) {
    console.error('Error in syncPlaybookContacts:', error);
    return {
      success: false,
      message: 'Failed to sync playbook contacts',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Delete contacts from Samespace
async function deleteSamespaceContacts(phoneNumbers: string[]) {
  const apiKey = getApiKey();
  
  const query = `
    mutation DeleteContacts($module: ID, $moduleName: String, $id: [ID!], $filter: JSON, $all: Boolean) {
      deleteContacts(
        module: $module
        moduleName: $moduleName
        _id: $id
        filter: $filter
        all: $all
      )
    }
  `;

  // Create filter to match contacts by phone number and company
  const phoneFilters = phoneNumbers.map(phone => ({
    key: 'phoneNumber',
    condition: 'IS',
    value: phone.replace(/^\+65/, '65'),
  }));

  const filter = {
    and: [
      {
        or: phoneFilters,
      },
      {
        key: 'company',
        condition: 'IS',
        value: 'AirConnect',
      },
    ],
  };

  const variables = {
    module: "6303289128a0e96163bd0dcd",
    filter: filter,
    all: false,
  };

  console.log('Deleting Samespace contacts:', { phoneNumbers, filter });

  const response = await fetch('https://api.capcfintech.com/api/playbook/contacts/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Samespace delete API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((err: any) => err.message).join(', ');
    throw new Error(`Samespace delete API returned errors: ${errorMessages}`);
  }

  return result.data?.deleteContacts;
}

// Hygiene: Remove contacts for leads that are no longer follow-up
export async function cleanupPlaybookContacts(playbookId: number): Promise<PlaybookResult> {
  try {
    console.log('Starting playbook contact cleanup:', { playbookId });

    // Get playbook info
    const [playbook] = await db
      .select()
      .from(playbooks)
      .where(eq(playbooks.id, playbookId))
      .limit(1);

    if (!playbook) {
      return {
        success: false,
        message: 'Playbook not found',
      };
    }

    // Get contacts that should be removed (leads no longer in follow-up status)
    const contactsToRemove = await db
      .select({
        contact_id: playbook_contacts.id,
        lead_id: playbook_contacts.lead_id,
        phone_number: playbook_contacts.phone_number,
        lead_status: leads.status,
      })
      .from(playbook_contacts)
      .innerJoin(leads, eq(playbook_contacts.lead_id, leads.id))
      .where(
        and(
          eq(playbook_contacts.playbook_id, playbookId)
        )
      );

    if (contactsToRemove.length === 0) {
      return {
        success: true,
        message: 'No contacts need cleanup',
        data: { contactsRemoved: 0 },
      };
    }

    console.log(`Found ${contactsToRemove.length} contacts to remove from Samespace`);

    // Delete contacts from Samespace
    const phoneNumbers = contactsToRemove.map(c => c.phone_number);
    const results = [];
    let successfulDeletions = 0;
    let failedDeletions = 0;

    try {
      const deleteResult = await deleteSamespaceContacts(phoneNumbers);
      console.log('Samespace deletion result:', deleteResult);
      
      // Mark contacts as removed in our database
      const contactIds = contactsToRemove.map(c => c.contact_id);
      await db
        .delete(playbook_contacts)
        .where(inArray(playbook_contacts.id, contactIds));

      successfulDeletions = contactsToRemove.length;
      
      results.push({
        action: 'bulk_delete',
        phoneNumbers: phoneNumbers,
        status: 'success',
        samespace_result: deleteResult,
      });

    } catch (error) {
      console.error('Failed to delete contacts from Samespace:', error);
      
      // Mark contacts as failed removal in our database
      const contactIds = contactsToRemove.map(c => c.contact_id);
      await db
        .update(playbook_contacts)
        .set({ 
          status: 'removal_failed',
          sync_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date(),
        })
        .where(inArray(playbook_contacts.id, contactIds));

      failedDeletions = contactsToRemove.length;
      
      results.push({
        action: 'bulk_delete',
        phoneNumbers: phoneNumbers,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    console.log(`Cleanup completed: ${successfulDeletions} deleted, ${failedDeletions} failed`);

    return {
      success: true,
      message: `Cleanup completed: ${successfulDeletions} contacts deleted from Samespace, ${failedDeletions} failed`,
      data: {
        contactsRemoved: successfulDeletions,
        contactsFailed: failedDeletions,
        details: results,
      },
    };

  } catch (error) {
    console.error('Error in cleanupPlaybookContacts:', error);
    return {
      success: false,
      message: 'Failed to cleanup playbook contacts',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


// Get all playbooks with their status
export async function getAllPlaybooks(): Promise<PlaybookResult> {
  try {
    const allPlaybooks = await db
      .select({
        id: playbooks.id,
        samespace_playbook_id: playbooks.samespace_playbook_id,
        name: playbooks.name,
        agent_id: playbooks.agent_id,
        agent_name: users.first_name,
        is_active: playbooks.is_active,
        last_synced_at: playbooks.last_synced_at,
        created_at: playbooks.created_at,
      })
      .from(playbooks)
      .leftJoin(users, eq(playbooks.agent_id, users.id))
      .orderBy(playbooks.created_at);

    // Get contact counts for each playbook
    const playbooksWithCounts = await Promise.all(
      allPlaybooks.map(async (playbook) => {
        const [contactCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(playbook_contacts)
          .where(eq(playbook_contacts.playbook_id, playbook.id));

        // Check Samespace status
        const samespaceStatus = await checkPlaybookStatus(playbook.samespace_playbook_id);

        console.log('Samespace status:', samespaceStatus);
        
        // Determine if running based on status
        const isRunning = samespaceStatus?.status === 'active' || samespaceStatus?.status === 'running';
        
        return {
          ...playbook,
          contact_count: contactCount?.count || 0,
          samespace_status: samespaceStatus?.status || 'unknown',
          is_running: isRunning,
        };
      })
    );

    return {
      success: true,
      message: `Found ${playbooksWithCounts.length} playbooks`,
      data: playbooksWithCounts,
    };

  } catch (error) {
    console.error('Error getting all playbooks:', error);
    return {
      success: false,
      message: 'Failed to get playbooks',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Cron job function: Start playbooks, sync contacts, then stop all playbooks
export async function cronSyncPlaybooks(): Promise<PlaybookResult> {
  try {
    console.log('Starting cron job: sync all playbooks');
    
    // Get all active playbooks
    const playbooksResult = await getAllPlaybooks();
    if (!playbooksResult.success || !playbooksResult.data) {
      return {
        success: false,
        message: 'Failed to get playbooks for sync',
        error: playbooksResult.error,
      };
    }

    const activePlaybooks = playbooksResult.data.filter((p: any) => p.is_active);
    
    if (activePlaybooks.length === 0) {
      return {
        success: true,
        message: 'No active playbooks to sync',
        data: { synced: 0, started: 0, stopped: 0 },
      };
    }

    console.log(`Found ${activePlaybooks.length} active playbooks to sync`);

    const results = {
      synced: 0,
      started: 0,
      stopped: 0,
      details: [] as any[],
    };

    // Process each playbook
    for (const playbook of activePlaybooks) {
      try {
        console.log(`Processing playbook ${playbook.id}: ${playbook.name}`);
        
        // Step 1: Start the playbook if needed
        let startResult = null;
        if (!playbook.is_running) {
          console.log(`Starting playbook ${playbook.samespace_playbook_id}`);
          startResult = await startPlaybook(playbook.id);
          if (startResult.success) {
            results.started++;
            console.log(`Started playbook ${playbook.id}`);
          } else {
            console.error(`Failed to start playbook ${playbook.id}:`, startResult.message);
          }
        } else {
          console.log(`Playbook ${playbook.id} is already running`);
        }

        // Step 2: Sync contacts
        console.log(`Syncing contacts for playbook ${playbook.id}`);
        const syncResult = await syncPlaybookContacts(playbook.id);
        if (syncResult.success) {
          results.synced++;
          console.log(`Synced playbook ${playbook.id}: ${syncResult.message}`);
        } else {
          console.error(`Failed to sync playbook ${playbook.id}:`, syncResult.message);
        }

        // Step 3: Stop the playbook
        // console.log(`Stopping playbook ${playbook.id}`);
        // const stopResult = await stopPlaybook(playbook.id);
        // if (stopResult.success) {
        //   results.stopped++;
        //   console.log(`Stopped playbook ${playbook.id}`);
        // } else {
        //   console.error(`Failed to stop playbook ${playbook.id}:`, stopResult.message);
        // }

        results.details.push({
          playbook_id: playbook.id,
          name: playbook.name,
          started: startResult?.success ?? false,
          synced: syncResult.success,
          // stopped: stopResult.success,
          sync_details: syncResult.data,
        });

      } catch (error) {
        console.error(`Error processing playbook ${playbook.id}:`, error);
        results.details.push({
          playbook_id: playbook.id,
          name: playbook.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('Cron job completed:', results);

    return {
      success: true,
      message: `Cron sync completed: ${results.synced} synced, ${results.started} started, ${results.stopped} stopped`,
      data: results,
    };

  } catch (error) {
    console.error('Error in cron sync playbooks:', error);
    return {
      success: false,
      message: 'Failed to run cron sync',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Stop all running playbooks
export async function stopAllPlaybooks(): Promise<PlaybookResult> {
  try {
    console.log('Stopping all playbooks');
    
    // Get all active playbooks
    const playbooksResult = await getAllPlaybooks();
    if (!playbooksResult.success || !playbooksResult.data) {
      return {
        success: false,
        message: 'Failed to get playbooks',
        error: playbooksResult.error,
      };
    }

    const activePlaybooks = playbooksResult.data
    
    if (activePlaybooks.length === 0) {
      return {
        success: true,
        message: 'No running playbooks to stop',
        data: { stopped: 0 },
      };
    }

    console.log(`Found ${activePlaybooks.length} running playbooks to stop`);

    const results = {
      stopped: 0,
      failed: 0,
      contacts_cleaned: 0,
      details: [] as any[],
    };

    // Stop each playbook and cleanup contacts
    for (const playbook of activePlaybooks) {
      try {
        console.log(`Stopping and cleaning playbook ${playbook.id}: ${playbook.name}`);
        
        // Step 1: Stop the playbook
        const stopResult = await stopPlaybook(playbook.id);
        
        // Step 2: Cleanup contacts (regardless of stop result)
        let cleanupResult = null;
        try {
          console.log(`Cleaning up contacts for playbook ${playbook.id}`);
          cleanupResult = await cleanupPlaybookContacts(playbook.id);
          if (cleanupResult.success && cleanupResult.data?.contactsRemoved) {
            results.contacts_cleaned += cleanupResult.data.contactsRemoved;
            console.log(`Cleaned ${cleanupResult.data.contactsRemoved} contacts from playbook ${playbook.id}`);
          }
        } catch (cleanupError) {
          console.error(`Failed to cleanup contacts for playbook ${playbook.id}:`, cleanupError);
        }
        
        if (stopResult.success) {
          results.stopped++;
          console.log(`Stopped playbook ${playbook.id}`);
        } else {
          results.failed++;
          console.error(`Failed to stop playbook ${playbook.id}:`, stopResult.message);
        }

        results.details.push({
          playbook_id: playbook.id,
          name: playbook.name,
          stopped: stopResult.success,
          stop_message: stopResult.message,
          contacts_cleaned: cleanupResult?.data?.contactsRemoved || 0,
          cleanup_success: cleanupResult?.success || false,
          cleanup_message: cleanupResult?.message || 'No cleanup attempted',
        });

      } catch (error) {
        results.failed++;
        console.error(`Error stopping/cleaning playbook ${playbook.id}:`, error);
        results.details.push({
          playbook_id: playbook.id,
          name: playbook.name,
          stopped: false,
          contacts_cleaned: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      message: `Stop all completed: ${results.stopped} stopped, ${results.failed} failed, ${results.contacts_cleaned} contacts cleaned`,
      data: results,
    };

  } catch (error) {
    console.error('Error stopping all playbooks:', error);
    return {
      success: false,
      message: 'Failed to stop all playbooks',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
} 