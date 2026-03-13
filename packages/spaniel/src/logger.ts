/**
 * Spaniel LLM Gateway — Request Logger
 *
 * Fire-and-forget logging to Supabase request_log table.
 * Logging failures never break LLM calls — errors are swallowed with console.warn.
 */

import type { RequestLogEntry } from "./types.js";
import { hasDbCapability, getDb } from "./db.js";
import { requestLog } from "./schema.js";

export function logRequest(entry: RequestLogEntry): void {
  if (!hasDbCapability()) {
    // No DB configured — log to stdout as structured JSON
    console.log(JSON.stringify({ spaniel_request_log: entry }));
    return;
  }

  // Fire-and-forget: insert into DB, swallow errors
  void (async () => {
    try {
      const db = getDb();
      await db.insert(requestLog).values({
        requestId: entry.requestId,
        tenantId: entry.tenantId,
        userId: entry.userId,
        appCode: entry.appCode,
        taskType: entry.taskType,
        primaryModel: entry.primaryModel,
        secondaryModel: entry.secondaryModel,
        tertiaryModel: entry.tertiaryModel,
        modelUsed: entry.modelUsed,
        fallbackUsed: entry.fallbackUsed,
        consensusAligned: entry.consensusAligned,
        confidenceScore: entry.confidenceScore?.toString() ?? null,
        tokensInput: entry.tokensInput,
        tokensOutput: entry.tokensOutput,
        costUsd: entry.costUsd.toString(),
        status: entry.status,
      });
    } catch (err) {
      console.warn(
        "[spaniel] Failed to log request to DB, falling back to stdout:",
        err instanceof Error ? err.message : err
      );
      console.log(JSON.stringify({ spaniel_request_log: entry }));
    }
  })();
}
