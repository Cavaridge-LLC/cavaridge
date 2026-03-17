/**
 * Audit logger factory.
 * Never throws — failures are swallowed (logged to console or custom handler).
 */

import type { AuditLogParams, AuditLoggerOptions } from "./types.js";
import { auditLog } from "./schema.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDb = { insert: (table: any) => { values: (v: any) => Promise<any> } };

/**
 * Creates an audit logger bound to a Drizzle db instance.
 *
 * Usage:
 * ```ts
 * const log = createAuditLogger(db, { appCode: "ducky" });
 * await log({ organizationId, userId, action: "plan.created", resourceType: "agent_plan", resourceId: planId });
 * ```
 */
export function createAuditLogger(db: DrizzleDb, options: AuditLoggerOptions = {}) {
  const { appCode: defaultAppCode, onError } = options;

  return async (params: AuditLogParams): Promise<void> => {
    try {
      await db.insert(auditLog).values({
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        details: params.details ?? {},
        ipAddress: params.ipAddress ?? null,
        appCode: params.appCode ?? defaultAppCode ?? null,
        correlationId: params.correlationId ?? null,
      });
    } catch (err) {
      if (onError) {
        onError(err);
      } else {
        console.error("Audit log write failed:", err);
      }
    }
  };
}

/**
 * Backward-compatible positional-args logger factory.
 * Wraps createAuditLogger for drop-in replacement of the old
 * `createAuditLogger(db, auditLogTable)` signature from @cavaridge/auth.
 */
export function createLegacyAuditLogger(db: DrizzleDb, _auditLogTable?: unknown) {
  const log = createAuditLogger(db);

  return async (
    orgId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
  ): Promise<void> => {
    await log({
      organizationId: orgId,
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
    });
  };
}
