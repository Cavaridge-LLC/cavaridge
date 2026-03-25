/**
 * Batch Generation Service
 *
 * Creates multiple content pieces from a single brief/topic.
 * Shares research across all pieces in the batch when requested.
 */

import { db } from "../db";
import { forgeBatches, forgeContent } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { runContentPipeline } from "../pipeline";
import { resolveBrandVoice } from "./brand-voice";
import type { BatchRequest, ForgeBrief, ContentType, OutputFormat } from "@shared/models/pipeline";

/** Content type display names */
const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  blog_post: "Blog Post",
  case_study: "Case Study",
  white_paper: "White Paper",
  email_campaign: "Email Campaign",
  social_media_series: "Social Media Series",
  proposal: "Proposal",
  one_pager: "One-Pager",
  custom: "Custom",
};

/** Create a batch of content pieces */
export async function createBatch(
  request: BatchRequest,
  tenantId: string,
  userId: string,
): Promise<{ batchId: string; contentIds: string[] }> {
  // Create batch record
  const [batch] = await db
    .insert(forgeBatches)
    .values({
      tenantId,
      createdBy: userId,
      topic: request.topic,
      contentCount: request.contentTypes.length,
      status: "pending",
    })
    .returning();

  const contentIds: string[] = [];

  // Create content records for each type
  for (const contentType of request.contentTypes) {
    const brief: ForgeBrief = {
      description: `${CONTENT_TYPE_LABELS[contentType]} about: ${request.topic}`,
      outputFormat: request.outputFormat,
      contentType,
      audience: request.audience,
      tone: request.tone,
      brandVoiceId: request.brandVoiceId,
    };

    const [content] = await db
      .insert(forgeContent)
      .values({
        tenantId,
        createdBy: userId,
        title: `${CONTENT_TYPE_LABELS[contentType]}: ${request.topic}`,
        brief: brief as unknown as Record<string, unknown>,
        contentType: contentType as typeof forgeContent.$inferInsert["contentType"],
        outputFormat: request.outputFormat as typeof forgeContent.$inferInsert["outputFormat"],
        batchId: batch.id,
        status: "queued",
      })
      .returning();

    contentIds.push(content.id);
  }

  // Update batch status
  await db
    .update(forgeBatches)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(forgeBatches.id, batch.id));

  // Run pipelines asynchronously
  void runBatchPipelines(batch.id, contentIds, tenantId, userId, request);

  return { batchId: batch.id, contentIds };
}

/** Run all pipelines in a batch */
async function runBatchPipelines(
  batchId: string,
  contentIds: string[],
  tenantId: string,
  userId: string,
  request: BatchRequest,
): Promise<void> {
  const brandVoice = await resolveBrandVoice(request.brandVoiceId, tenantId);

  for (const contentId of contentIds) {
    try {
      const [content] = await db
        .select()
        .from(forgeContent)
        .where(eq(forgeContent.id, contentId));

      if (!content) continue;

      const brief = content.brief as unknown as ForgeBrief;
      await runContentPipeline(contentId, brief, tenantId, userId, brandVoice);

      // Update batch progress
      await db
        .update(forgeBatches)
        .set({
          completedCount: sql`${forgeBatches.completedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(forgeBatches.id, batchId));
    } catch (error) {
      console.error(`Batch pipeline failed for content ${contentId}:`, error);
      await db
        .update(forgeBatches)
        .set({
          failedCount: sql`${forgeBatches.failedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(forgeBatches.id, batchId));
    }
  }

  // Finalize batch
  const [batch] = await db
    .select()
    .from(forgeBatches)
    .where(eq(forgeBatches.id, batchId));

  if (batch) {
    const allDone = batch.completedCount + batch.failedCount >= batch.contentCount;
    if (allDone) {
      await db
        .update(forgeBatches)
        .set({
          status: batch.failedCount > 0 ? "partial" : "completed",
          updatedAt: new Date(),
        })
        .where(eq(forgeBatches.id, batchId));
    }
  }
}

/** Get batch status */
export async function getBatchStatus(batchId: string, tenantId: string) {
  const [batch] = await db
    .select()
    .from(forgeBatches)
    .where(eq(forgeBatches.id, batchId));

  if (!batch || batch.tenantId !== tenantId) return null;

  const contentPieces = await db
    .select()
    .from(forgeContent)
    .where(eq(forgeContent.batchId, batchId));

  return { batch, contentPieces };
}
