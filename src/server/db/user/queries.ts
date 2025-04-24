import "server-only";

import { db } from "~/server/db";
import { type userRoles, type permissions, type roles, type rolePermissions } from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";



export async function getUserRoles() {
  const user = await auth();
  if (!user.userId) {
    return [];
  }
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