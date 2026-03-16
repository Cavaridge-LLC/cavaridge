/**
 * Tenant-scoped audit log querier.
 * Filtering, pagination, and count.
 */

import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import { auditLog } from "./schema.js";
import type { AuditQueryOptions, AuditQueryResult } from "./types.js";
import type { AuditEntry } from "./schema.js";

/**
 * Creates a tenant-scoped audit querier.
 *
 * Usage:
 * ```ts
 * const query = createAuditQuerier(db);
 * const result = await query({ organizationId: "...", action: "plan.created", limit: 50 });
 * ```
 */
export function createAuditQuerier(db: any) {
  return async (options: AuditQueryOptions): Promise<AuditQueryResult<AuditEntry>> => {
    const {
      organizationId,
      userId,
      action,
      resourceType,
      resourceId,
      appCode,
      correlationId,
      from,
      to,
      limit = 50,
      offset = 0,
    } = options;

    // Build conditions — organizationId is always required (tenant isolation)
    const conditions: ReturnType<typeof eq>[] = [eq(auditLog.organizationId, organizationId)];

    if (userId) conditions.push(eq(auditLog.userId, userId));
    if (action) conditions.push(eq(auditLog.action, action));
    if (resourceType) conditions.push(eq(auditLog.resourceType, resourceType));
    if (resourceId) conditions.push(eq(auditLog.resourceId, resourceId));
    if (appCode) conditions.push(eq(auditLog.appCode, appCode));
    if (correlationId) conditions.push(eq(auditLog.correlationId, correlationId));
    if (from) conditions.push(gte(auditLog.createdAt, new Date(from)));
    if (to) conditions.push(lte(auditLog.createdAt, new Date(to)));

    const where = and(...conditions);

    // Count total
    const [{ total }] = await db
      .select({ total: count() })
      .from(auditLog)
      .where(where);

    // Fetch page
    const entries: AuditEntry[] = await db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      entries,
      total: Number(total),
      limit,
      offset,
    };
  };
}
