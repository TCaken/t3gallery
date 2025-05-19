'use server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '~/server/db';
import { users } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  // console.log('Clerk webhook received');
  // console.log(process.env.NEXT_PUBLIC_CLERK_WEBHOOK_SECRET);
  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.log('Webhook Error: Missing headers');
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET ?? '');

  let evt: WebhookEvent;
c
  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  // Handle the webhook
  const eventType = evt.type;
  console.log('Webhook Event Type:', eventType);
  console.log('User ID:', evt.data.id);

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    console.log('Creating new user:', { id, email: email_addresses[0]?.email_address, first_name, last_name });

    try {
      // Check if user already exists
      const existingUser = await db.select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (existingUser.length === 0) {
        // Insert new user
        await db.insert(users).values({
          id,
          email: email_addresses[0]?.email_address ?? null,
          first_name: first_name ?? null,
          last_name: last_name ?? null,
          is_verified: false,
        });
        console.log('Successfully created new user:', id);
      } else {
        console.log('User already exists:', id);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      return new Response('Error creating user', {
        status: 500
      });
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    console.log('Updating user:', { id, email: email_addresses[0]?.email_address, first_name, last_name });

    try {
      // Update user
      await db.update(users)
        .set({
          email: email_addresses[0]?.email_address ?? null,
          first_name: first_name ?? null,
          last_name: last_name ?? null,
        })
        .where(eq(users.id, id));
      console.log('Successfully updated user:', id);
    } catch (error) {
      console.error('Error updating user:', error);
      return new Response('Error updating user', {
        status: 500
      });
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;
    console.log('Deleting user:', id);

    try {
      // Delete user
      await db.delete(users)
        .where(eq(users.id, id));
      console.log('Successfully deleted user:', id);
    } catch (error) {
      console.error('Error deleting user:', error);
      return new Response('Error deleting user', {
        status: 500
      });
    }
  }

  return new Response('Webhook processed successfully', {
    status: 200
  });
} 