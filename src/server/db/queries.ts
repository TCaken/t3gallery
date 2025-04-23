import "server-only";

import { db } from "~/server/db";
import { images } from "~/server/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

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
