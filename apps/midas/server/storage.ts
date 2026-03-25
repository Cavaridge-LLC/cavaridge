import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  clients, type Client, type InsertClient,
  initiatives, type Initiative, type InsertInitiative,
  meetings, type Meeting, type InsertMeeting,
  snapshots, type Snapshot, type InsertSnapshot,
  compensatingControlCatalog, type CatalogEntry, type InsertCatalogEntry,
  securityScoringOverrides, type ScoringOverride, type InsertOverride,
  securityScoreHistory, type ScoreHistory, type InsertScoreHistory,
  roadmaps, type RoadmapRecord, type InsertRoadmap,
  projects, type ProjectRecord, type InsertProject,
  budgetItems, type BudgetItemRecord, type InsertBudgetItem,
  qbrReports, type QbrReportRecord, type InsertQbrReport,
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

// ── Roadmaps ────────────────────────────────────────────────────────

export async function getRoadmaps(orgId: string, clientId?: string): Promise<RoadmapRecord[]> {
  if (clientId) {
    return db.select().from(roadmaps).where(and(eq(roadmaps.tenantId, orgId), eq(roadmaps.clientId, clientId))).orderBy(desc(roadmaps.createdAt));
  }
  return db.select().from(roadmaps).where(eq(roadmaps.tenantId, orgId)).orderBy(desc(roadmaps.createdAt));
}

export async function getRoadmap(orgId: string, id: string): Promise<RoadmapRecord | undefined> {
  const [row] = await db.select().from(roadmaps).where(and(eq(roadmaps.id, id), eq(roadmaps.tenantId, orgId)));
  return row;
}

export async function createRoadmap(data: InsertRoadmap): Promise<RoadmapRecord> {
  const [row] = await db.insert(roadmaps).values(data).returning();
  return row;
}

export async function updateRoadmap(orgId: string, id: string, data: Partial<InsertRoadmap>): Promise<RoadmapRecord | undefined> {
  const [row] = await db.update(roadmaps).set({ ...data, updatedAt: new Date() }).where(and(eq(roadmaps.id, id), eq(roadmaps.tenantId, orgId))).returning();
  return row;
}

export async function deleteRoadmap(orgId: string, id: string): Promise<void> {
  await db.delete(roadmaps).where(and(eq(roadmaps.id, id), eq(roadmaps.tenantId, orgId)));
}

// ── Projects ────────────────────────────────────────────────────────

export async function getProjects(orgId: string, roadmapId?: string, clientId?: string): Promise<ProjectRecord[]> {
  if (roadmapId) {
    return db.select().from(projects).where(and(eq(projects.tenantId, orgId), eq(projects.roadmapId, roadmapId))).orderBy(asc(projects.priority));
  }
  if (clientId) {
    return db.select().from(projects).where(and(eq(projects.tenantId, orgId), eq(projects.clientId, clientId))).orderBy(asc(projects.priority));
  }
  return db.select().from(projects).where(eq(projects.tenantId, orgId)).orderBy(asc(projects.priority));
}

export async function getProject(orgId: string, id: string): Promise<ProjectRecord | undefined> {
  const [row] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.tenantId, orgId)));
  return row;
}

export async function createProject(data: InsertProject): Promise<ProjectRecord> {
  const [row] = await db.insert(projects).values(data).returning();
  return row;
}

export async function updateProject(orgId: string, id: string, data: Partial<InsertProject>): Promise<ProjectRecord | undefined> {
  const [row] = await db.update(projects).set({ ...data, updatedAt: new Date() }).where(and(eq(projects.id, id), eq(projects.tenantId, orgId))).returning();
  return row;
}

export async function deleteProject(orgId: string, id: string): Promise<void> {
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.tenantId, orgId)));
}

// ── Budget Items ────────────────────────────────────────────────────

export async function getBudgetItems(orgId: string, clientId: string, fiscalYear?: number): Promise<BudgetItemRecord[]> {
  if (fiscalYear) {
    return db.select().from(budgetItems).where(and(eq(budgetItems.tenantId, orgId), eq(budgetItems.clientId, clientId), eq(budgetItems.fiscalYear, fiscalYear))).orderBy(asc(budgetItems.quarter));
  }
  return db.select().from(budgetItems).where(and(eq(budgetItems.tenantId, orgId), eq(budgetItems.clientId, clientId))).orderBy(asc(budgetItems.fiscalYear), asc(budgetItems.quarter));
}

export async function getBudgetItem(orgId: string, id: string): Promise<BudgetItemRecord | undefined> {
  const [row] = await db.select().from(budgetItems).where(and(eq(budgetItems.id, id), eq(budgetItems.tenantId, orgId)));
  return row;
}

export async function createBudgetItem(data: InsertBudgetItem): Promise<BudgetItemRecord> {
  const [row] = await db.insert(budgetItems).values(data).returning();
  return row;
}

export async function updateBudgetItem(orgId: string, id: string, data: Partial<InsertBudgetItem>): Promise<BudgetItemRecord | undefined> {
  const [row] = await db.update(budgetItems).set({ ...data, updatedAt: new Date() }).where(and(eq(budgetItems.id, id), eq(budgetItems.tenantId, orgId))).returning();
  return row;
}

export async function deleteBudgetItem(orgId: string, id: string): Promise<void> {
  await db.delete(budgetItems).where(and(eq(budgetItems.id, id), eq(budgetItems.tenantId, orgId)));
}

// ── QBR Reports ─────────────────────────────────────────────────────

export async function getQbrReports(orgId: string, clientId?: string): Promise<QbrReportRecord[]> {
  if (clientId) {
    return db.select().from(qbrReports).where(and(eq(qbrReports.tenantId, orgId), eq(qbrReports.clientId, clientId))).orderBy(desc(qbrReports.generatedAt));
  }
  return db.select().from(qbrReports).where(eq(qbrReports.tenantId, orgId)).orderBy(desc(qbrReports.generatedAt));
}

export async function getQbrReport(orgId: string, id: string): Promise<QbrReportRecord | undefined> {
  const [row] = await db.select().from(qbrReports).where(and(eq(qbrReports.id, id), eq(qbrReports.tenantId, orgId)));
  return row;
}

export async function createQbrReport(data: InsertQbrReport): Promise<QbrReportRecord> {
  const [row] = await db.insert(qbrReports).values(data).returning();
  return row;
}

export async function updateQbrReport(orgId: string, id: string, data: Partial<InsertQbrReport>): Promise<QbrReportRecord | undefined> {
  const [row] = await db.update(qbrReports).set({ ...data, updatedAt: new Date() }).where(and(eq(qbrReports.id, id), eq(qbrReports.tenantId, orgId))).returning();
  return row;
}

export async function deleteQbrReport(orgId: string, id: string): Promise<void> {
  await db.delete(qbrReports).where(and(eq(qbrReports.id, id), eq(qbrReports.tenantId, orgId)));
}
