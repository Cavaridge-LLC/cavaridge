import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "./db";
import {
  clients, type Client, type InsertClient,
  initiatives, type Initiative, type InsertInitiative,
  meetings, type Meeting, type InsertMeeting,
  snapshots, type Snapshot, type InsertSnapshot,
  compensatingControlCatalog, type CatalogEntry, type InsertCatalogEntry,
  securityScoringOverrides, type ScoringOverride, type InsertOverride,
  securityScoreHistory, type ScoreHistory, type InsertScoreHistory,
} from "@shared/schema";

// ── Clients ──────────────────────────────────────────────────────────

export async function getClients(orgId: string): Promise<Client[]> {
  return db.select().from(clients).where(eq(clients.tenantId, orgId)).orderBy(asc(clients.name));
}

export async function getClient(orgId: string, id: string): Promise<Client | undefined> {
  const [row] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.tenantId, orgId)));
  return row;
}

export async function createClient(data: InsertClient): Promise<Client> {
  const [row] = await db.insert(clients).values(data).returning();
  return row;
}

// ── Initiatives ──────────────────────────────────────────────────────

export async function getInitiatives(orgId: string, clientId: string): Promise<Initiative[]> {
  return db
    .select()
    .from(initiatives)
    .where(and(eq(initiatives.clientId, clientId), eq(initiatives.tenantId, orgId)))
    .orderBy(asc(initiatives.sortOrder));
}

export async function getInitiative(orgId: string, id: string): Promise<Initiative | undefined> {
  const [row] = await db.select().from(initiatives).where(and(eq(initiatives.id, id), eq(initiatives.tenantId, orgId)));
  return row;
}

export async function createInitiative(data: InsertInitiative): Promise<Initiative> {
  const [row] = await db.insert(initiatives).values(data).returning();
  return row;
}

export async function updateInitiative(orgId: string, id: string, data: Partial<InsertInitiative>): Promise<Initiative | undefined> {
  const [row] = await db.update(initiatives).set(data).where(and(eq(initiatives.id, id), eq(initiatives.tenantId, orgId))).returning();
  return row;
}

export async function deleteInitiative(orgId: string, id: string): Promise<void> {
  await db.delete(initiatives).where(and(eq(initiatives.id, id), eq(initiatives.tenantId, orgId)));
}

// ── Meetings ─────────────────────────────────────────────────────────

export async function getMeetings(orgId: string, clientId?: string): Promise<Meeting[]> {
  if (clientId) {
    return db.select().from(meetings).where(and(eq(meetings.clientId, clientId), eq(meetings.tenantId, orgId))).orderBy(asc(meetings.createdAt));
  }
  return db.select().from(meetings).where(eq(meetings.tenantId, orgId)).orderBy(asc(meetings.createdAt));
}

export async function getMeeting(orgId: string, id: string): Promise<Meeting | undefined> {
  const [row] = await db.select().from(meetings).where(and(eq(meetings.id, id), eq(meetings.tenantId, orgId)));
  return row;
}

export async function createMeeting(data: InsertMeeting): Promise<Meeting> {
  const [row] = await db.insert(meetings).values(data).returning();
  return row;
}

export async function updateMeeting(orgId: string, id: string, data: Partial<InsertMeeting>): Promise<Meeting | undefined> {
  const [row] = await db.update(meetings).set(data).where(and(eq(meetings.id, id), eq(meetings.tenantId, orgId))).returning();
  return row;
}

export async function deleteMeeting(orgId: string, id: string): Promise<void> {
  await db.delete(meetings).where(and(eq(meetings.id, id), eq(meetings.tenantId, orgId)));
}

// ── Snapshots ────────────────────────────────────────────────────────

export async function getSnapshot(orgId: string, clientId: string): Promise<Snapshot | undefined> {
  const [row] = await db.select().from(snapshots).where(and(eq(snapshots.clientId, clientId), eq(snapshots.tenantId, orgId)));
  return row;
}

export async function upsertSnapshot(data: InsertSnapshot): Promise<Snapshot> {
  const [existing] = await db.select().from(snapshots).where(and(eq(snapshots.clientId, data.clientId), eq(snapshots.tenantId, data.tenantId)));
  if (existing) {
    const [row] = await db.update(snapshots).set(data).where(eq(snapshots.id, existing.id)).returning();
    return row;
  }
  const [row] = await db.insert(snapshots).values(data).returning();
  return row;
}

// ── Compensating Control Catalog (platform-scoped) ───────────────────

export async function getCatalogEntries(): Promise<CatalogEntry[]> {
  return db.select().from(compensatingControlCatalog).orderBy(asc(compensatingControlCatalog.category));
}

export async function getCatalogEntry(id: string): Promise<CatalogEntry | undefined> {
  const [row] = await db.select().from(compensatingControlCatalog).where(eq(compensatingControlCatalog.id, id));
  return row;
}

export async function getCatalogByControl(nativeControlId: string): Promise<CatalogEntry[]> {
  return db.select().from(compensatingControlCatalog).where(eq(compensatingControlCatalog.nativeControlId, nativeControlId));
}

export async function createCatalogEntry(data: InsertCatalogEntry): Promise<CatalogEntry> {
  const [row] = await db.insert(compensatingControlCatalog).values(data).returning();
  return row;
}

export async function updateCatalogEntry(id: string, data: Partial<InsertCatalogEntry>): Promise<CatalogEntry | undefined> {
  const [row] = await db.update(compensatingControlCatalog).set({ ...data, updatedAt: new Date() }).where(eq(compensatingControlCatalog.id, id)).returning();
  return row;
}

// ── Security Scoring Overrides ───────────────────────────────────────

export async function getOverrides(orgId: string, clientId: string): Promise<ScoringOverride[]> {
  return db.select().from(securityScoringOverrides).where(and(eq(securityScoringOverrides.tenantId, orgId), eq(securityScoringOverrides.clientId, clientId))).orderBy(asc(securityScoringOverrides.nativeControlId));
}

export async function setOverride(data: InsertOverride): Promise<ScoringOverride> {
  const existing = await db
    .select()
    .from(securityScoringOverrides)
    .where(
      and(
        eq(securityScoringOverrides.tenantId, data.tenantId),
        eq(securityScoringOverrides.clientId, data.clientId),
        eq(securityScoringOverrides.nativeControlId, data.nativeControlId),
      ),
    );

  if (existing.length > 0) {
    const [row] = await db
      .update(securityScoringOverrides)
      .set({ ...data, setAt: new Date() })
      .where(eq(securityScoringOverrides.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db.insert(securityScoringOverrides).values(data).returning();
  return row;
}

export async function deleteOverride(orgId: string, clientId: string, nativeControlId: string): Promise<void> {
  await db.delete(securityScoringOverrides).where(
    and(
      eq(securityScoringOverrides.tenantId, orgId),
      eq(securityScoringOverrides.clientId, clientId),
      eq(securityScoringOverrides.nativeControlId, nativeControlId),
    ),
  );
}

// ── Security Score History ───────────────────────────────────────────

export async function getScoreHistory(orgId: string, clientId: string, limit = 20): Promise<ScoreHistory[]> {
  return db
    .select()
    .from(securityScoreHistory)
    .where(and(eq(securityScoreHistory.tenantId, orgId), eq(securityScoreHistory.clientId, clientId)))
    .orderBy(desc(securityScoreHistory.generatedAt))
    .limit(limit);
}

export async function getLatestScore(orgId: string, clientId: string): Promise<ScoreHistory | undefined> {
  const [row] = await db
    .select()
    .from(securityScoreHistory)
    .where(and(eq(securityScoreHistory.tenantId, orgId), eq(securityScoreHistory.clientId, clientId)))
    .orderBy(desc(securityScoreHistory.generatedAt))
    .limit(1);
  return row;
}

export async function saveScoreSnapshot(data: InsertScoreHistory): Promise<ScoreHistory> {
  const [row] = await db.insert(securityScoreHistory).values(data).returning();
  return row;
}
