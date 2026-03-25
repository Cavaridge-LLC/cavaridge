/**
 * Brand Voice Service
 *
 * Per-tenant brand voice configurations injected into pipeline runs.
 * Each tenant can have multiple brand voices with one marked as default.
 */

import { db } from "../db";
import { forgeBrandVoices } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { BrandVoiceConfig } from "@shared/models/pipeline";

/** Get all brand voices for a tenant */
export async function getBrandVoicesForTenant(tenantId: string) {
  return db
    .select()
    .from(forgeBrandVoices)
    .where(eq(forgeBrandVoices.tenantId, tenantId));
}

/** Get a single brand voice by ID (scoped to tenant) */
export async function getBrandVoiceById(brandVoiceId: string, tenantId: string) {
  const [voice] = await db
    .select()
    .from(forgeBrandVoices)
    .where(and(eq(forgeBrandVoices.id, brandVoiceId), eq(forgeBrandVoices.tenantId, tenantId)));
  return voice ?? null;
}

/** Get the default brand voice for a tenant */
export async function getDefaultBrandVoice(tenantId: string) {
  const [voice] = await db
    .select()
    .from(forgeBrandVoices)
    .where(and(eq(forgeBrandVoices.tenantId, tenantId), eq(forgeBrandVoices.isDefault, true)));
  return voice ?? null;
}

/** Convert DB record to BrandVoiceConfig for pipeline injection */
export function toBrandVoiceConfig(record: typeof forgeBrandVoices.$inferSelect): BrandVoiceConfig {
  return {
    tone: record.tone,
    vocabulary: (record.vocabulary as string[] | null) ?? [],
    styleGuide: record.styleGuide,
    avoidTerms: (record.avoidTerms as string[] | null) ?? [],
    examplePhrases: (record.examplePhrases as string[] | null) ?? [],
  };
}

/** Resolve brand voice for a pipeline run */
export async function resolveBrandVoice(
  brandVoiceId: string | undefined,
  tenantId: string,
): Promise<BrandVoiceConfig | undefined> {
  if (brandVoiceId) {
    const voice = await getBrandVoiceById(brandVoiceId, tenantId);
    if (voice) return toBrandVoiceConfig(voice);
  }

  // Fall back to tenant default
  const defaultVoice = await getDefaultBrandVoice(tenantId);
  if (defaultVoice) return toBrandVoiceConfig(defaultVoice);

  return undefined;
}
