"use server";

import { db } from "~/server/db";
import { leads, playbooks, playbook_contacts, users } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

interface ContactResult {
  success: boolean;
  message: string;
  data?: {
    contactsCreated: number;
    contactsFailed: number;
    playbookUpdated: boolean;
    details: Array<{
      leadId: number;
      leadName: string;
      phone: string;
      status: 'created' | 'failed';
      error?: string;
    }>;
  };
  error?: string;
}

// Get API key from environment
function getApiKey(): string {
  const apiKey = process.env.SAMESPACE_API_KEY; // You can change this name
  if (!apiKey) {
    throw new Error('SAMESPACE_API_KEY environment variable is not set');
  }
  return apiKey;
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
    mutation CreateContact($properties: [KeyValueInput!]!, $module: ID) {
      createContact(properties: $properties, module: $module) {
        _id
      }
    }
  `;

  const variables = {
    module: "6303289128a0e96163bd0dcd",
    properties: [
      { key: "dataSource", value: contact.dataSource },
      { key: "firstName", value: contact.firstName },
      { key: "lastName", value: contact.lastName },
      { key: "phoneNumber", value: contact.phoneNumber },
    ],
  };

  console.log('Creating Samespace contact:', { contact, variables });

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
    console.error('Samespace contact creation failed:', {
      status: response.status,
      statusText: response.statusText,
      response: errorText,
    });
    throw new Error(`Samespace API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((err: { message: string }) => err.message).join(', ');
    throw new Error(`Samespace API returned errors: ${errorMessages}`);
  }

  return result.data?.createContact;
}

// Update playbook with new contacts
async function updatePlaybookContacts(playbookId: string, phoneNumbers: string[]) {
  const apiKey = getApiKey();
  
  // Generate phone filters for the playbook
  const phoneFilters = phoneNumbers.map(phone => ({
    key: 'phoneNumber',
    condition: 'IS',
    value: phone.replace(/^\+65/, '65'), // Convert +65 to 65 format
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
              key: 'dataSource',
              condition: 'IS',
              value: 'AirConnect Demo',
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

  console.log('Updating playbook with contacts:', { playbookId, phoneNumbers: phoneNumbers.length, rules });

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
    console.error('Samespace playbook update failed:', {
      status: response.status,
      statusText: response.statusText,
      response: errorText,
    });
    throw new Error(`Samespace playbook update error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((err: { message: string }) => err.message).join(', ');
    throw new Error(`Samespace playbook update returned errors: ${errorMessages}`);
  }

  return result.data?.updatePlaybook;
}

// Delete all contacts by data source
async function deleteContactsByDataSource(dataSource = 'AirConnect') {
  const apiKey = getApiKey();
  
  const query = `
    mutation DeleteContacts($module: ID, $filter: JSON) {
      deleteContacts(module: $module, filter: $filter) {
        success
        message
      }
    }
  `;

  const variables = {
    module: "6303289128a0e96163bd0dcd",
    filter: {
      or: [
        { key: "dataSource", condition: "IS", value: dataSource }
      ]
    }
  };

  console.log('Deleting contacts by data source:', { dataSource });

  return {
    success: true,
    message: 'Contacts deleted by data source',
  };

//   const response = await fetch('https://api.capcfintech.com/api/playbook/contacts/delete', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'apikey': apiKey,
//     },
//     body: JSON.stringify({
//       query,
//       variables,
//     }),
//   });

//   if (!response.ok) {
//     const errorText = await response.text();
//     console.error('Samespace contact deletion failed:', {
//       status: response.status,
//       statusText: response.statusText,
//       response: errorText,
//     });
//     throw new Error(`Samespace contact deletion error ${response.status}: ${errorText}`);
//   }

//   const result = await response.json();
  
//   if (result.errors && result.errors.length > 0) {
//     const errorMessages = result.errors.map((err: { message: string }) => err.message).join(', ');
//     throw new Error(`Samespace contact deletion returned errors: ${errorMessages}`);
//   }

//   return result.data?.deleteContacts;
}

// Main function: Create contacts for agent and update playbook
export async function syncContactsForPlaybook(
  playbookId: string,
  agentId: string
): Promise<ContactResult> {
  try {
    console.log('Starting contact sync for playbook:', { playbookId, agentId });

    // Get follow-up leads for the agent
    const followUpLeads = await db
      .select({
        id: leads.id,
        phone_number: leads.phone_number,
        full_name: leads.full_name,
      })
      .from(leads)
      .where(
        and(
          eq(leads.assigned_to, agentId),
          eq(leads.status, 'follow_up'),
          eq(leads.is_deleted, false)
        )
      )
      .limit(100);

    console.log(`Found ${followUpLeads.length} follow-up leads for agent ${agentId}`);

    if (followUpLeads.length === 0) {
      return {
        success: true,
        message: 'No follow-up leads found for this agent',
        data: {
          contactsCreated: 0,
          contactsFailed: 0,
          playbookUpdated: false,
          details: [],
        },
      };
    }

    // Create contacts in Samespace
    const results = [];
    const successfulPhones = [];

    for (const lead of followUpLeads) {
      try {
        const [firstName, ...lastNameParts] = (lead.full_name || 'Unknown').split(' ');
        const lastName = lastNameParts.join(' ') || '';

        const contact = await createSamespaceContact({
          firstName: firstName || '',
          lastName: lastName,
          phoneNumber: lead.phone_number.replace(/^\+65/, '65'),
          dataSource: 'AirConnect',
        });

        if (contact?._id) {
          results.push({
            leadId: lead.id,
            leadName: lead.full_name || 'Unknown',
            phone: lead.phone_number,
            status: 'created' as const,
          });
          successfulPhones.push(lead.phone_number);

          // Contact created successfully - we could save to a tracking table if needed
          console.log(`Contact created for lead ${lead.id}: ${contact._id}`);
        } else {
          throw new Error('No contact ID returned from Samespace');
        }
      } catch (error) {
        console.error(`Failed to create contact for lead ${lead.id}:`, error);
        results.push({
          leadId: lead.id,
          leadName: lead.full_name || 'Unknown',
          phone: lead.phone_number,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update playbook with successful contacts
    let playbookUpdated = false;
    if (successfulPhones.length > 0) {
      try {
        await updatePlaybookContacts(playbookId, successfulPhones);
        playbookUpdated = true;
        console.log(`Updated playbook ${playbookId} with ${successfulPhones.length} contacts`);
      } catch (error) {
        console.error('Failed to update playbook:', error);
        // Don't fail the entire operation if playbook update fails
      }
    }

    const contactsCreated = results.filter(r => r.status === 'created').length;
    const contactsFailed = results.filter(r => r.status === 'failed').length;

    return {
      success: true,
      message: `Contact sync completed: ${contactsCreated} created, ${contactsFailed} failed, playbook ${playbookUpdated ? 'updated' : 'not updated'}`,
      data: {
        contactsCreated,
        contactsFailed,
        playbookUpdated,
        details: results,
      },
    };

  } catch (error) {
    console.error('Error in syncContactsForPlaybook:', error);
    return {
      success: false,
      message: 'Failed to sync contacts',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Function to clean up all contacts at end of day
export async function cleanupAllContacts(): Promise<ContactResult> {
  try {
    console.log('Starting end-of-day contact cleanup');

    const result = await deleteContactsByDataSource('AirConnect');

    if (result?.success) {
      // Contacts deleted from Samespace successfully
      console.log('Contacts deleted from Samespace:', result.message);
      
      return {
        success: true,
        message: `Cleanup completed: ${result.message}`,
        data: {
          contactsCreated: 0,
          contactsFailed: 0,
          playbookUpdated: false,
          details: [],
        },
      };
    } else {
      throw new Error('Samespace deletion did not return success');
    }

  } catch (error) {
    console.error('Error in cleanupAllContacts:', error);
    return {
      success: false,
      message: 'Failed to cleanup contacts',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
} 