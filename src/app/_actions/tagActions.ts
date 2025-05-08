import { db } from "~/server/db";
import { leadTags, tags } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function updateLeadTag(leadId: number, tagId: number, userId: string) {
  try {
    // First, remove any existing tags for this lead
    await db.delete(leadTags)
      .where(eq(leadTags.lead_id, leadId));

    // Then add the new tag
    await db.insert(leadTags)
      .values({
        lead_id: leadId,
        tag_id: tagId,
        created_by: userId
      });

    return { success: true };
  } catch (error) {
    console.error("Error updating lead tag:", error);
    return { success: false, error: "Failed to update lead tag" };
  }
}

export async function getLeadTag(leadId: number) {
  try {
    const result = await db
      .select({
        tag: tags
      })
      .from(leadTags)
      .innerJoin(tags, eq(leadTags.tag_id, tags.id))
      .where(eq(leadTags.lead_id, leadId))
      .limit(1);

    return { 
      success: true, 
      tag: result[0]?.tag ?? null 
    };
  } catch (error) {
    console.error("Error getting lead tag:", error);
    return { success: false, error: "Failed to get lead tag" };
  }
}

export async function removeLeadTag(leadId: number) {
  try {
    await db.delete(leadTags)
      .where(eq(leadTags.lead_id, leadId));

    return { success: true };
  } catch (error) {
    console.error("Error removing lead tag:", error);
    return { success: false, error: "Failed to remove lead tag" };
  }
} 