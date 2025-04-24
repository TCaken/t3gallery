import "server-only";

import { db } from "~/server/db";
import { images } from "~/server/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { users } from "~/server/db/schema";

type Image = InferSelectModel<typeof images>;

export async function getImages() {
  const dbImages = await db.query.images.findMany({
    orderBy: (model, { desc }) => desc(model.id),
  }) as Image[];  
  console.log("Database images:", dbImages);
  return dbImages;
}

export async function getMyImages() {
  const user = await auth();
  if (!user.userId) {
    return [];
  }
  const myImages = await db.query.images.findMany({
    where: (model, { eq }) => eq(model.userId, user.userId),
    orderBy: (model, { desc }) => desc(model.id),
  }) as Image[];
  return myImages;
}

export async function getImage(id: number) {
    const user = await auth();
    if (!user.userId) {
        throw new Error("User not found");
    }

    const image = await db.query.images.findFirst({
        where: (model, { eq }) => eq(model.id, id),
    }) as Image;
    if (!image) {
        throw new Error("Image not found");
    }
    
    if (image.userId !== user.userId) {
        throw new Error("Image not found");
    }
    return image;
}

// Create or update a user record from Clerk data
export async function createOrUpdateUser(
  userId: string, 
  firstName?: string | null, 
  lastName?: string | null, 
  email?: string | null
) {
  try {
    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (existingUser.length > 0) {
      // Update existing user
      await db
        .update(users)
        .set({
          first_name: firstName ?? existingUser[0].first_name,
          last_name: lastName ?? existingUser[0].last_name,
          email: email ?? existingUser[0].email,
          updated_at: new Date()
        })
        .where(eq(users.id, userId));
      
      return existingUser[0];
    } else {
      // Insert new user
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          first_name: firstName ?? null,
          last_name: lastName ?? null,
          email: email ?? null,
          is_verified: true, // Clerk already verifies users
          created_at: new Date()
        })
        .returning();
      
      return newUser;
    }
  } catch (error) {
    console.error("Error creating/updating user:", error);
    return null;
  }
}

// Get a user by ID
export async function getUserById(userId: string) {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}