import { eq, and, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, tenants, deals, pillars, findings, documents, documentChunks, baselineProfiles,
  techStackItems, baselineComparisons, topologyNodes, topologyConnections,
  playbookPhases, playbookTasks, scoreSnapshots, processingQueue,
  dealAccess, invitations, auditLog, platformSettings, accountRequests, documentClassifications,
  qaConversations, qaMessages, qaSavedAnswers, organizationBranding,
  type User, type InsertUser,
  type Organization, type InsertOrganization,
  type Deal, type InsertDeal,
  type DealAccess, type InsertDealAccess,
  type Invitation, type InsertInvitation,
  type AuditLogEntry, type InsertAuditLog,
  type Pillar, type InsertPillar,
  type Finding, type InsertFinding,
  type Document, type InsertDocument,
  type DocumentChunk, type InsertDocumentChunk,
  type BaselineProfile, type InsertBaselineProfile,
  type TechStackItem, type InsertTechStackItem,
  type BaselineComparison, type InsertBaselineComparison,
  type TopologyNode, type InsertTopologyNode,
  type TopologyConnection, type InsertTopologyConnection,
  type PlaybookPhase, type InsertPlaybookPhase,
  type PlaybookTask, type InsertPlaybookTask,
  type ScoreSnapshot,
  type ProcessingQueueItem, type InsertProcessingQueueItem,
  type PlatformSetting, type InsertPlatformSetting,
  type AccountRequest, type InsertAccountRequest,
  type DocumentClassification, type InsertDocumentClassification,
  type QaConversation, type InsertQaConversation,
  type QaMessage, type InsertQaMessage,
  type QaSavedAnswer, type InsertQaSavedAnswer,
  type OrganizationBranding, type InsertOrganizationBranding,
  pillarTemplates, type PillarTemplate, type InsertPillarTemplate,
  techCategories, type TechCategory, type InsertTechCategory,
  passwordResetTokens, type PasswordResetToken, type InsertPasswordResetToken,
  usageTracking, type InsertUsageTracking,
} from "@shared/schema";

export interface PipelineStats {
  activeDeals: number;
  avgItScore: number;
  openAlerts: number;
  estIntegration: string;
  docsAnalyzed: number;
  docsUploaded: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User>;
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getUsersByOrg(orgId: string): Promise<User[]>;
  getDealsByOrg(orgId: string): Promise<Deal[]>;
  getDeals(): Promise<Deal[]>;
  getDeal(id: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  getDealCountByOrg(orgId: string): Promise<number>;
  createDealAccess(da: InsertDealAccess): Promise<DealAccess>;
  getDealAccessByDeal(dealId: string): Promise<DealAccess[]>;
  getDealAccessByUser(userId: string): Promise<DealAccess[]>;
  deleteDealAccess(dealId: string, userId: string): Promise<void>;
  createInvitation(inv: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationsByOrg(orgId: string): Promise<Invitation[]>;
  updateInvitation(id: string, data: Partial<InsertInvitation>): Promise<Invitation>;
  createAuditLog(entry: InsertAuditLog): Promise<AuditLogEntry>;
  getAuditLogByOrg(orgId: string, limit?: number): Promise<AuditLogEntry[]>;
  getPillarsByDeal(dealId: string): Promise<Pillar[]>;
  createPillar(pillar: InsertPillar): Promise<Pillar>;
  getFindingsByDeal(dealId: string): Promise<Finding[]>;
  getAllOpenAlertsByOrg(orgId: string): Promise<Finding[]>;
  getAllOpenAlerts(): Promise<Finding[]>;
  createFinding(finding: InsertFinding): Promise<Finding>;
  getDocumentsByDeal(dealId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentByHash(dealId: string, hash: string): Promise<Document | undefined>;
  getChildDocuments(parentId: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document>;
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  getChunksByDocument(documentId: string): Promise<DocumentChunk[]>;
  getChunkCountByDeal(dealId: string): Promise<number>;
  getBaselineProfiles(orgId: string): Promise<BaselineProfile[]>;
  getBaselineProfile(id: string): Promise<BaselineProfile | undefined>;
  createBaselineProfile(bp: InsertBaselineProfile): Promise<BaselineProfile>;
  updateBaselineProfile(id: string, data: Partial<InsertBaselineProfile>): Promise<BaselineProfile>;
  deleteBaselineProfile(id: string): Promise<void>;
  getTechStackByDeal(dealId: string): Promise<TechStackItem[]>;
  createTechStackItem(item: InsertTechStackItem): Promise<TechStackItem>;
  deleteTechStackByDeal(dealId: string): Promise<void>;
  getBaselineComparisonsByDeal(dealId: string): Promise<BaselineComparison[]>;
  deleteBaselineComparisonsByDeal(dealId: string): Promise<void>;
  getTopologyNodesByDeal(dealId: string): Promise<TopologyNode[]>;
  getTopologyConnectionsByDeal(dealId: string): Promise<TopologyConnection[]>;
  deleteTopologyByDeal(dealId: string): Promise<void>;
  insertTopologyNodes(nodes: InsertTopologyNode[]): Promise<TopologyNode[]>;
  insertTopologyConnections(conns: InsertTopologyConnection[]): Promise<TopologyConnection[]>;
  insertTechStackItems(items: InsertTechStackItem[]): Promise<TechStackItem[]>;
  insertBaselineComparisons(items: InsertBaselineComparison[]): Promise<BaselineComparison[]>;
  getPlaybookPhasesByDeal(dealId: string): Promise<PlaybookPhase[]>;
  getPlaybookTasksByPhase(phaseId: string): Promise<PlaybookTask[]>;
  getPlaybookTasksByDeal(dealId: string): Promise<Array<PlaybookTask & { phaseId: string }>>;
  deletePlaybookByDeal(dealId: string): Promise<void>;
  createPlaybookPhase(phase: InsertPlaybookPhase): Promise<PlaybookPhase>;
  createPlaybookTask(task: InsertPlaybookTask): Promise<PlaybookTask>;
  getScoreSnapshotsByOrg(orgId: string): Promise<ScoreSnapshot[]>;
  getScoreSnapshots(): Promise<ScoreSnapshot[]>;
  getAllPillarsByOrg(orgId: string): Promise<Pillar[]>;
  getAllPillars(): Promise<Pillar[]>;
  updateDeal(id: string, data: Partial<InsertDeal>): Promise<Deal>;
  updatePillar(id: string, data: Partial<InsertPillar>): Promise<Pillar>;
  getDealCount(): Promise<number>;
  getFindingsByPillar(pillarId: string): Promise<Finding[]>;
  getPipelineStats(): Promise<PipelineStats>;
  getPipelineStatsByOrg(orgId: string): Promise<PipelineStats>;
  createQueueItem(item: InsertProcessingQueueItem): Promise<ProcessingQueueItem>;
  getQueueItemsByDeal(dealId: string): Promise<ProcessingQueueItem[]>;
  getQueueItemsByDocument(documentId: string): Promise<ProcessingQueueItem[]>;
  updateQueueItem(id: string, data: Partial<InsertProcessingQueueItem>): Promise<ProcessingQueueItem>;
  getNextQueuedItems(dealId: string, limit: number): Promise<ProcessingQueueItem[]>;
  getFailedQueueItems(dealId: string): Promise<ProcessingQueueItem[]>;
  deleteQueueItemsByDocument(documentId: string): Promise<void>;
  getTotalTextLength(dealId: string): Promise<number>;
  getEmbeddedChunkCount(dealId: string): Promise<number>;
  updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization>;
  deleteUser(id: string): Promise<void>;
  getUserCount(orgId: string): Promise<number>;
  getDocumentStorageByOrg(orgId: string): Promise<number>;
  getAuditLogFiltered(orgId: string, opts: { action?: string; userId?: string; limit: number; offset: number }): Promise<{ entries: AuditLogEntry[]; total: number }>;
  upsertDealAccess(da: InsertDealAccess): Promise<DealAccess>;
  deleteDealAccessByUser(userId: string): Promise<void>;
  getAllOrganizations(): Promise<Organization[]>;
  getPlatformSetting(key: string): Promise<PlatformSetting | undefined>;
  getAllPlatformSettings(): Promise<PlatformSetting[]>;
  upsertPlatformSetting(key: string, value: any, updatedBy?: string): Promise<PlatformSetting>;
  getAccountRequests(status?: string): Promise<AccountRequest[]>;
  getAccountRequest(id: string): Promise<AccountRequest | undefined>;
  createAccountRequest(req: InsertAccountRequest): Promise<AccountRequest>;
  updateAccountRequest(id: string, data: Partial<InsertAccountRequest>): Promise<AccountRequest>;
  getPlatformUsers(): Promise<User[]>;
  deleteOrganization(id: string): Promise<void>;
  getPlatformStats(): Promise<{ totalOrgs: number; activeOrgs: number; totalUsers: number; totalDeals: number; totalDocuments: number; monthlyQueries: number }>;
  createDocumentClassification(data: InsertDocumentClassification): Promise<DocumentClassification>;
  getDocumentClassification(documentId: string): Promise<DocumentClassification | undefined>;
  getDocumentClassificationsByDeal(dealId: string): Promise<DocumentClassification[]>;
  updateDocumentClassification(id: string, data: Partial<InsertDocumentClassification>): Promise<DocumentClassification>;
  deleteDocumentClassification(documentId: string): Promise<void>;
  createQaConversation(data: InsertQaConversation): Promise<QaConversation>;
  getQaConversationsByDeal(dealId: string, tenantId: string): Promise<QaConversation[]>;
  getQaConversation(id: string): Promise<QaConversation | undefined>;
  deleteQaConversation(id: string): Promise<void>;
  updateQaConversation(id: string, data: Partial<InsertQaConversation>): Promise<QaConversation>;
  createQaMessage(data: InsertQaMessage): Promise<QaMessage>;
  getQaMessagesByConversation(conversationId: string): Promise<QaMessage[]>;
  getQaMessage(id: string): Promise<QaMessage | undefined>;
  createQaSavedAnswer(data: InsertQaSavedAnswer): Promise<QaSavedAnswer>;
  getQaSavedAnswersByDeal(dealId: string): Promise<QaSavedAnswer[]>;
  getBranding(tenantId: string): Promise<OrganizationBranding | undefined>;
  upsertBranding(tenantId: string, data: Partial<InsertOrganizationBranding>): Promise<OrganizationBranding>;
  getPillarTemplates(orgId: string | null): Promise<PillarTemplate[]>;
  getPillarTemplate(id: string): Promise<PillarTemplate | undefined>;
  createPillarTemplate(data: InsertPillarTemplate): Promise<PillarTemplate>;
  updatePillarTemplate(id: string, data: Partial<InsertPillarTemplate>): Promise<PillarTemplate>;
  deletePillarTemplate(id: string): Promise<void>;
  getTechCategories(orgId: string | null): Promise<TechCategory[]>;
  getTechCategory(id: string): Promise<TechCategory | undefined>;
  createTechCategory(data: InsertTechCategory): Promise<TechCategory>;
  updateTechCategory(id: string, data: Partial<InsertTechCategory>): Promise<TechCategory>;
  deleteTechCategory(id: string): Promise<void>;
  createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  deletePasswordResetTokensByUser(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(tenants).where(eq(tenants.id, id));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(tenants).values(org).returning();
    return created;
  }

  async getUsersByOrg(orgId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.organizationId, orgId));
  }

  async getDealsByOrg(orgId: string): Promise<Deal[]> {
    return db.select().from(deals).where(eq(deals.tenantId, orgId));
  }

  async getDeals(): Promise<Deal[]> {
    return db.select().from(deals);
  }

  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [created] = await db.insert(deals).values(deal).returning();
    return created;
  }

  async getDealCountByOrg(orgId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(deals).where(eq(deals.tenantId, orgId));
    return result[0]?.count || 0;
  }

  async createDealAccess(da: InsertDealAccess): Promise<DealAccess> {
    const [created] = await db.insert(dealAccess).values(da).returning();
    return created;
  }

  async getDealAccessByDeal(dealId: string): Promise<DealAccess[]> {
    return db.select().from(dealAccess).where(eq(dealAccess.dealId, dealId));
  }

  async getDealAccessByUser(userId: string): Promise<DealAccess[]> {
    return db.select().from(dealAccess).where(eq(dealAccess.userId, userId));
  }

  async deleteDealAccess(dealId: string, userId: string): Promise<void> {
    await db.delete(dealAccess).where(
      and(eq(dealAccess.dealId, dealId), eq(dealAccess.userId, userId))
    );
  }

  async createInvitation(inv: InsertInvitation): Promise<Invitation> {
    const [created] = await db.insert(invitations).values(inv).returning();
    return created;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token));
    return inv;
  }

  async getInvitationsByOrg(orgId: string): Promise<Invitation[]> {
    return db.select().from(invitations).where(eq(invitations.tenantId, orgId));
  }

  async updateInvitation(id: string, data: Partial<InsertInvitation>): Promise<Invitation> {
    const [updated] = await db.update(invitations).set(data).where(eq(invitations.id, id)).returning();
    return updated;
  }

  async createAuditLog(entry: InsertAuditLog): Promise<AuditLogEntry> {
    const [created] = await db.insert(auditLog).values(entry).returning();
    return created;
  }

  async getAuditLogByOrg(orgId: string, limit = 100): Promise<AuditLogEntry[]> {
    return db.select().from(auditLog)
      .where(eq(auditLog.tenantId, orgId))
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }

  async getPillarsByDeal(dealId: string): Promise<Pillar[]> {
    return db.select().from(pillars).where(eq(pillars.dealId, dealId));
  }

  async createPillar(pillar: InsertPillar): Promise<Pillar> {
    const [created] = await db.insert(pillars).values(pillar).returning();
    return created;
  }

  async getFindingsByDeal(dealId: string): Promise<Finding[]> {
    return db.select().from(findings).where(eq(findings.dealId, dealId));
  }

  async createFinding(finding: InsertFinding): Promise<Finding> {
    const [created] = await db.insert(findings).values(finding).returning();
    return created;
  }

  async getAllOpenAlertsByOrg(orgId: string): Promise<Finding[]> {
    const orgDeals = await db.select({ id: deals.id }).from(deals)
      .where(eq(deals.tenantId, orgId));
    const dealIds = orgDeals.map(d => d.id);
    if (dealIds.length === 0) return [];
    return db.select().from(findings).where(
      and(
        inArray(findings.dealId, dealIds),
        inArray(findings.severity, ["critical", "high"]),
        eq(findings.status, "open")
      )
    );
  }

  async getAllOpenAlerts(): Promise<Finding[]> {
    return db.select().from(findings).where(
      and(
        inArray(findings.severity, ["critical", "high"]),
        eq(findings.status, "open")
      )
    );
  }

  async getDocumentsByDeal(dealId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.dealId, dealId));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async getDocumentByHash(dealId: string, hash: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(
      and(eq(documents.dealId, dealId), eq(documents.contentHash, hash))
    );
    return doc;
  }

  async getChildDocuments(parentId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.parentArchiveId, parentId));
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document> {
    const [updated] = await db.update(documents).set(data).where(eq(documents.id, id)).returning();
    return updated;
  }

  async createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [created] = await db.insert(documentChunks).values(chunk).returning();
    return created;
  }

  async getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
    return db.select().from(documentChunks).where(eq(documentChunks.documentId, documentId));
  }

  async getChunkCountByDeal(dealId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(documentChunks).where(eq(documentChunks.dealId, dealId));
    return result[0]?.count || 0;
  }


  async getBaselineProfiles(orgId: string): Promise<BaselineProfile[]> {
    return db.select().from(baselineProfiles).where(eq(baselineProfiles.tenantId, orgId));
  }

  async getBaselineProfile(id: string): Promise<BaselineProfile | undefined> {
    const [profile] = await db.select().from(baselineProfiles).where(eq(baselineProfiles.id, id));
    return profile;
  }

  async createBaselineProfile(bp: InsertBaselineProfile): Promise<BaselineProfile> {
    const [created] = await db.insert(baselineProfiles).values(bp).returning();
    return created;
  }

  async updateBaselineProfile(id: string, data: Partial<InsertBaselineProfile>): Promise<BaselineProfile> {
    const [updated] = await db.update(baselineProfiles).set(data).where(eq(baselineProfiles.id, id)).returning();
    return updated;
  }

  async deleteBaselineProfile(id: string): Promise<void> {
    await db.delete(baselineProfiles).where(eq(baselineProfiles.id, id));
  }

  async getTechStackByDeal(dealId: string): Promise<TechStackItem[]> {
    return db.select().from(techStackItems).where(eq(techStackItems.dealId, dealId));
  }

  async createTechStackItem(item: InsertTechStackItem): Promise<TechStackItem> {
    const [created] = await db.insert(techStackItems).values(item).returning();
    return created;
  }

  async deleteTechStackByDeal(dealId: string): Promise<void> {
    await db.delete(techStackItems).where(eq(techStackItems.dealId, dealId));
  }

  async getBaselineComparisonsByDeal(dealId: string): Promise<BaselineComparison[]> {
    return db.select().from(baselineComparisons).where(eq(baselineComparisons.dealId, dealId));
  }

  async deleteBaselineComparisonsByDeal(dealId: string): Promise<void> {
    await db.delete(baselineComparisons).where(eq(baselineComparisons.dealId, dealId));
  }

  async getTopologyNodesByDeal(dealId: string): Promise<TopologyNode[]> {
    return db.select().from(topologyNodes).where(eq(topologyNodes.dealId, dealId));
  }

  async getTopologyConnectionsByDeal(dealId: string): Promise<TopologyConnection[]> {
    return db.select().from(topologyConnections).where(eq(topologyConnections.dealId, dealId));
  }

  async deleteTopologyByDeal(dealId: string): Promise<void> {
    await db.delete(topologyConnections).where(eq(topologyConnections.dealId, dealId));
    await db.delete(topologyNodes).where(eq(topologyNodes.dealId, dealId));
  }

  async insertTopologyNodes(nodes: InsertTopologyNode[]): Promise<TopologyNode[]> {
    if (nodes.length === 0) return [];
    return db.insert(topologyNodes).values(nodes).returning();
  }

  async insertTopologyConnections(conns: InsertTopologyConnection[]): Promise<TopologyConnection[]> {
    if (conns.length === 0) return [];
    return db.insert(topologyConnections).values(conns).returning();
  }

  async insertTechStackItems(items: InsertTechStackItem[]): Promise<TechStackItem[]> {
    if (items.length === 0) return [];
    return db.insert(techStackItems).values(items).returning();
  }

  async insertBaselineComparisons(items: InsertBaselineComparison[]): Promise<BaselineComparison[]> {
    if (items.length === 0) return [];
    return db.insert(baselineComparisons).values(items).returning();
  }

  async getPlaybookPhasesByDeal(dealId: string): Promise<PlaybookPhase[]> {
    return db.select().from(playbookPhases).where(eq(playbookPhases.dealId, dealId));
  }

  async getPlaybookTasksByPhase(phaseId: string): Promise<PlaybookTask[]> {
    return db.select().from(playbookTasks).where(eq(playbookTasks.phaseId, phaseId));
  }

  async getPlaybookTasksByDeal(dealId: string): Promise<Array<PlaybookTask & { phaseId: string }>> {
    const phases = await this.getPlaybookPhasesByDeal(dealId);
    if (phases.length === 0) return [];
    const phaseIds = phases.map(p => p.id);
    return db.select().from(playbookTasks).where(inArray(playbookTasks.phaseId, phaseIds));
  }

  async deletePlaybookByDeal(dealId: string): Promise<void> {
    const phases = await this.getPlaybookPhasesByDeal(dealId);
    if (phases.length > 0) {
      const phaseIds = phases.map(p => p.id);
      await db.delete(playbookTasks).where(inArray(playbookTasks.phaseId, phaseIds));
    }
    await db.delete(playbookPhases).where(eq(playbookPhases.dealId, dealId));
  }

  async createPlaybookPhase(phase: InsertPlaybookPhase): Promise<PlaybookPhase> {
    const [created] = await db.insert(playbookPhases).values(phase).returning();
    return created;
  }

  async createPlaybookTask(task: InsertPlaybookTask): Promise<PlaybookTask> {
    const [created] = await db.insert(playbookTasks).values(task).returning();
    return created;
  }

  async getScoreSnapshotsByOrg(orgId: string): Promise<ScoreSnapshot[]> {
    const orgDeals = await db.select({ id: deals.id }).from(deals)
      .where(eq(deals.tenantId, orgId));
    const dealIds = orgDeals.map(d => d.id);
    if (dealIds.length === 0) return [];
    return db.select().from(scoreSnapshots).where(inArray(scoreSnapshots.dealId, dealIds));
  }

  async getScoreSnapshots(): Promise<ScoreSnapshot[]> {
    return db.select().from(scoreSnapshots);
  }

  async getAllPillarsByOrg(orgId: string): Promise<Pillar[]> {
    const orgDeals = await db.select({ id: deals.id }).from(deals)
      .where(eq(deals.tenantId, orgId));
    const dealIds = orgDeals.map(d => d.id);
    if (dealIds.length === 0) return [];
    return db.select().from(pillars).where(inArray(pillars.dealId, dealIds));
  }

  async getAllPillars(): Promise<Pillar[]> {
    return db.select().from(pillars);
  }

  async updateDeal(id: string, data: Partial<InsertDeal>): Promise<Deal> {
    const [updated] = await db.update(deals).set({ ...data, updatedAt: new Date() }).where(eq(deals.id, id)).returning();
    return updated;
  }

  async updatePillar(id: string, data: Partial<InsertPillar>): Promise<Pillar> {
    const [updated] = await db.update(pillars).set({ ...data, updatedAt: new Date() }).where(eq(pillars.id, id)).returning();
    return updated;
  }

  async getDealCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(deals);
    return result[0]?.count || 0;
  }

  async getFindingsByPillar(pillarId: string): Promise<Finding[]> {
    return db.select().from(findings).where(eq(findings.pillarId, pillarId));
  }

  async getPipelineStatsByOrg(orgId: string): Promise<PipelineStats> {
    const allDeals = await db.select().from(deals)
      .where(and(eq(deals.tenantId, orgId), ne(deals.stage, "Closed")));
    return this._computePipelineStats(allDeals, orgId);
  }

  async getPipelineStats(): Promise<PipelineStats> {
    const allDeals = await db.select().from(deals).where(ne(deals.stage, "Closed"));
    return this._computePipelineStats(allDeals);
  }

  private async _computePipelineStats(allDeals: Deal[], orgId?: string): Promise<PipelineStats> {
    const activeDeals = allDeals.length;
    const avgItScore = activeDeals > 0
      ? Math.round(allDeals.reduce((sum, d) => sum + (Number(d.compositeScore) || 0), 0) / activeDeals * 10) / 10
      : 0;

    const openAlerts = orgId
      ? await this.getAllOpenAlertsByOrg(orgId)
      : await this.getAllOpenAlerts();

    const docsAnalyzed = allDeals.reduce((sum, d) => sum + (d.documentsAnalyzed || 0), 0);
    const docsUploaded = allDeals.reduce((sum, d) => sum + (d.documentsUploaded || 0), 0);

    const totalCostNum = allDeals.reduce((sum, d) => {
      const costStr = d.estimatedIntegrationCost || "0";
      const cleaned = costStr.replace(/[$,KMB]/gi, "");
      let val = parseFloat(cleaned) || 0;
      if (costStr.includes("K")) val *= 1000;
      if (costStr.includes("M")) val *= 1000000;
      if (costStr.includes("B")) val *= 1000000000;
      return sum + val;
    }, 0);

    let estIntegration: string;
    if (totalCostNum >= 1000000) {
      estIntegration = `$${(totalCostNum / 1000000).toFixed(1)}M`;
    } else if (totalCostNum >= 1000) {
      estIntegration = `$${(totalCostNum / 1000).toFixed(0)}K`;
    } else {
      estIntegration = `$${totalCostNum.toFixed(0)}`;
    }

    return { activeDeals, avgItScore, openAlerts: openAlerts.length, estIntegration, docsAnalyzed, docsUploaded };
  }

  async createQueueItem(item: InsertProcessingQueueItem): Promise<ProcessingQueueItem> {
    const [created] = await db.insert(processingQueue).values(item).returning();
    return created;
  }

  async getQueueItemsByDeal(dealId: string): Promise<ProcessingQueueItem[]> {
    return db.select().from(processingQueue).where(eq(processingQueue.dealId, dealId));
  }

  async getQueueItemsByDocument(documentId: string): Promise<ProcessingQueueItem[]> {
    return db.select().from(processingQueue).where(eq(processingQueue.documentId, documentId));
  }

  async updateQueueItem(id: string, data: Partial<InsertProcessingQueueItem>): Promise<ProcessingQueueItem> {
    const [updated] = await db.update(processingQueue).set(data).where(eq(processingQueue.id, id)).returning();
    return updated;
  }

  async getNextQueuedItems(dealId: string, limit: number): Promise<ProcessingQueueItem[]> {
    return db.select().from(processingQueue).where(
      and(eq(processingQueue.dealId, dealId), eq(processingQueue.status, "queued"))
    ).limit(limit);
  }

  async getFailedQueueItems(dealId: string): Promise<ProcessingQueueItem[]> {
    return db.select().from(processingQueue).where(
      and(eq(processingQueue.dealId, dealId), eq(processingQueue.status, "failed"))
    );
  }

  async deleteQueueItemsByDocument(documentId: string): Promise<void> {
    await db.delete(processingQueue).where(eq(processingQueue.documentId, documentId));
  }

  async getTotalTextLength(dealId: string): Promise<number> {
    const result = await db.select({ total: sql<number>`coalesce(sum(text_length), 0)::int` })
      .from(documents).where(eq(documents.dealId, dealId));
    return result[0]?.total || 0;
  }

  async getEmbeddedChunkCount(dealId: string): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)::int` })
        .from(documentChunks)
        .where(and(eq(documentChunks.dealId, dealId), sql`embedding IS NOT NULL`));
      return result[0]?.count || 0;
    } catch {
      return 0;
    }
  }

  async updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization> {
    const [updated] = await db.update(tenants).set({ ...data, updatedAt: new Date() }).where(eq(tenants.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(dealAccess).where(eq(dealAccess.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserCount(orgId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(users).where(eq(users.organizationId, orgId));
    return result[0]?.count || 0;
  }

  async getDocumentStorageByOrg(orgId: string): Promise<number> {
    const orgDeals = await db.select({ id: deals.id }).from(deals)
      .where(eq(deals.tenantId, orgId));
    const dealIds = orgDeals.map(d => d.id);
    if (dealIds.length === 0) return 0;
    const result = await db.select({ total: sql<number>`coalesce(sum(file_size), 0)::bigint` })
      .from(documents).where(inArray(documents.dealId, dealIds));
    return Number(result[0]?.total || 0);
  }

  async getAuditLogFiltered(orgId: string, opts: { action?: string; userId?: string; limit: number; offset: number }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const conditions = [eq(auditLog.tenantId, orgId)];
    if (opts.action) conditions.push(eq(auditLog.action, opts.action));
    if (opts.userId) conditions.push(eq(auditLog.userId, opts.userId));
    const where = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where);
    const entries = await db.select().from(auditLog)
      .where(where)
      .orderBy(sql`created_at DESC`)
      .limit(opts.limit)
      .offset(opts.offset);
    return { entries, total: countResult?.count || 0 };
  }

  async upsertDealAccess(da: InsertDealAccess): Promise<DealAccess> {
    const existing = await db.select().from(dealAccess)
      .where(and(eq(dealAccess.dealId, da.dealId), eq(dealAccess.userId, da.userId)));
    if (existing.length > 0) {
      const [updated] = await db.update(dealAccess).set({ accessLevel: da.accessLevel, grantedBy: da.grantedBy })
        .where(eq(dealAccess.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(dealAccess).values(da).returning();
    return created;
  }

  async deleteDealAccessByUser(userId: string): Promise<void> {
    await db.delete(dealAccess).where(eq(dealAccess.userId, userId));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return db.select().from(tenants).orderBy(sql`created_at ASC`);
  }

  async getPlatformSetting(key: string): Promise<PlatformSetting | undefined> {
    const [setting] = await db.select().from(platformSettings).where(eq(platformSettings.settingKey, key));
    return setting;
  }

  async getAllPlatformSettings(): Promise<PlatformSetting[]> {
    return db.select().from(platformSettings);
  }

  async upsertPlatformSetting(key: string, value: any, updatedBy?: string): Promise<PlatformSetting> {
    const existing = await this.getPlatformSetting(key);
    if (existing) {
      const [updated] = await db.update(platformSettings)
        .set({ settingValue: value, updatedBy: updatedBy || null, updatedAt: new Date() })
        .where(eq(platformSettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(platformSettings)
      .values({ settingKey: key, settingValue: value, updatedBy: updatedBy || null })
      .returning();
    return created;
  }

  async getAccountRequests(status?: string): Promise<AccountRequest[]> {
    if (status) {
      return db.select().from(accountRequests)
        .where(eq(accountRequests.status, status))
        .orderBy(sql`created_at DESC`);
    }
    return db.select().from(accountRequests).orderBy(sql`created_at DESC`);
  }

  async getAccountRequest(id: string): Promise<AccountRequest | undefined> {
    const [req] = await db.select().from(accountRequests).where(eq(accountRequests.id, id));
    return req;
  }

  async createAccountRequest(req: InsertAccountRequest): Promise<AccountRequest> {
    const [created] = await db.insert(accountRequests).values(req).returning();
    return created;
  }

  async updateAccountRequest(id: string, data: Partial<InsertAccountRequest>): Promise<AccountRequest> {
    const [updated] = await db.update(accountRequests).set(data).where(eq(accountRequests.id, id)).returning();
    return updated;
  }

  async getPlatformUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isPlatformUser, true));
  }

  async deleteOrganization(id: string): Promise<void> {
    const orgDeals = await db.select({ id: deals.id }).from(deals).where(eq(deals.tenantId, id));
    const dealIds = orgDeals.map(d => d.id);
    if (dealIds.length > 0) {
      await db.delete(documentChunks).where(inArray(documentChunks.dealId, dealIds));
      await db.delete(documents).where(inArray(documents.dealId, dealIds));
      await db.delete(findings).where(inArray(findings.dealId, dealIds));
      await db.delete(pillars).where(inArray(pillars.dealId, dealIds));
      await db.delete(scoreSnapshots).where(inArray(scoreSnapshots.dealId, dealIds));
      await db.delete(processingQueue).where(inArray(processingQueue.dealId, dealIds));
      await db.delete(dealAccess).where(inArray(dealAccess.dealId, dealIds));
      const orgPhases = await db.select({ id: playbookPhases.id }).from(playbookPhases).where(inArray(playbookPhases.dealId, dealIds));
      const phaseIds = orgPhases.map(p => p.id);
      if (phaseIds.length > 0) {
        await db.delete(playbookTasks).where(inArray(playbookTasks.phaseId, phaseIds));
      }
      await db.delete(playbookPhases).where(inArray(playbookPhases.dealId, dealIds));
      await db.delete(techStackItems).where(inArray(techStackItems.dealId, dealIds));
      await db.delete(baselineComparisons).where(inArray(baselineComparisons.dealId, dealIds));
      await db.delete(topologyConnections).where(inArray(topologyConnections.dealId, dealIds));
      await db.delete(topologyNodes).where(inArray(topologyNodes.dealId, dealIds));
      await db.delete(deals).where(eq(deals.tenantId, id));
    }
    await db.delete(baselineProfiles).where(eq(baselineProfiles.tenantId, id));
    await db.delete(invitations).where(eq(invitations.tenantId, id));
    await db.delete(auditLog).where(eq(auditLog.tenantId, id));
    await db.delete(users).where(eq(users.organizationId, id));
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getPlatformStats(): Promise<{ totalOrgs: number; activeOrgs: number; totalUsers: number; totalDeals: number; totalDocuments: number; monthlyQueries: number }> {
    const [orgStats] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${tenants.isActive} = true)::int`,
    }).from(tenants);
    const [userStats] = await db.select({ total: sql<number>`count(*)::int` }).from(users);
    const [dealStats] = await db.select({ total: sql<number>`count(*)::int` }).from(deals);
    const [docStats] = await db.select({ total: sql<number>`count(*)::int` }).from(documents);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const queryResult = await db.execute(
      sql`SELECT coalesce(sum(count)::int, 0) as total FROM usage_tracking WHERE metric = 'chat_queries' AND period = ${currentMonth}`
    );
    const queryStats = queryResult.rows?.[0] as { total: number } | undefined;

    return {
      totalOrgs: orgStats?.total ?? 0,
      activeOrgs: orgStats?.active ?? 0,
      totalUsers: userStats?.total ?? 0,
      totalDeals: dealStats?.total ?? 0,
      totalDocuments: docStats?.total ?? 0,
      monthlyQueries: queryStats?.total ?? 0,
    };
  }

  async createDocumentClassification(data: InsertDocumentClassification): Promise<DocumentClassification> {
    const [created] = await db.insert(documentClassifications).values(data).returning();
    return created;
  }

  async getDocumentClassification(documentId: string): Promise<DocumentClassification | undefined> {
    const [row] = await db.select().from(documentClassifications).where(eq(documentClassifications.documentId, documentId));
    return row;
  }

  async getDocumentClassificationsByDeal(dealId: string): Promise<DocumentClassification[]> {
    return db.select().from(documentClassifications).where(eq(documentClassifications.dealId, dealId));
  }

  async updateDocumentClassification(id: string, data: Partial<InsertDocumentClassification>): Promise<DocumentClassification> {
    const [updated] = await db.update(documentClassifications).set({ ...data, updatedAt: new Date() }).where(eq(documentClassifications.id, id)).returning();
    return updated;
  }

  async deleteDocumentClassification(documentId: string): Promise<void> {
    await db.delete(documentClassifications).where(eq(documentClassifications.documentId, documentId));
  }

  async createQaConversation(data: InsertQaConversation): Promise<QaConversation> {
    const [created] = await db.insert(qaConversations).values(data).returning();
    return created;
  }

  async getQaConversationsByDeal(dealId: string, tenantId: string): Promise<QaConversation[]> {
    return db.select().from(qaConversations)
      .where(and(eq(qaConversations.dealId, dealId), eq(qaConversations.tenantId, tenantId)))
      .orderBy(sql`${qaConversations.updatedAt} DESC`);
  }

  async getQaConversation(id: string): Promise<QaConversation | undefined> {
    const [row] = await db.select().from(qaConversations).where(eq(qaConversations.id, id));
    return row;
  }

  async deleteQaConversation(id: string): Promise<void> {
    await db.delete(qaConversations).where(eq(qaConversations.id, id));
  }

  async updateQaConversation(id: string, data: Partial<InsertQaConversation>): Promise<QaConversation> {
    const [updated] = await db.update(qaConversations).set({ ...data, updatedAt: new Date() }).where(eq(qaConversations.id, id)).returning();
    return updated;
  }

  async createQaMessage(data: InsertQaMessage): Promise<QaMessage> {
    const [created] = await db.insert(qaMessages).values(data).returning();
    return created;
  }

  async getQaMessagesByConversation(conversationId: string): Promise<QaMessage[]> {
    return db.select().from(qaMessages)
      .where(eq(qaMessages.conversationId, conversationId))
      .orderBy(qaMessages.createdAt);
  }

  async getQaMessage(id: string): Promise<QaMessage | undefined> {
    const [row] = await db.select().from(qaMessages).where(eq(qaMessages.id, id));
    return row;
  }

  async createQaSavedAnswer(data: InsertQaSavedAnswer): Promise<QaSavedAnswer> {
    const [created] = await db.insert(qaSavedAnswers).values(data).returning();
    return created;
  }

  async getQaSavedAnswersByDeal(dealId: string): Promise<QaSavedAnswer[]> {
    return db.select().from(qaSavedAnswers)
      .where(eq(qaSavedAnswers.dealId, dealId))
      .orderBy(sql`${qaSavedAnswers.createdAt} DESC`);
  }

  async getBranding(tenantId: string): Promise<OrganizationBranding | undefined> {
    const [row] = await db.select().from(organizationBranding)
      .where(eq(organizationBranding.tenantId, tenantId));
    return row;
  }

  async upsertBranding(tenantId: string, data: Partial<InsertOrganizationBranding>): Promise<OrganizationBranding> {
    const existing = await this.getBranding(tenantId);
    if (existing) {
      const [updated] = await db.update(organizationBranding)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(organizationBranding.tenantId, tenantId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(organizationBranding)
      .values({ ...data, tenantId })
      .returning();
    return created;
  }

  async getPillarTemplates(orgId: string | null): Promise<PillarTemplate[]> {
    if (orgId) {
      const orgTemplates = await db.select().from(pillarTemplates)
        .where(eq(pillarTemplates.tenantId, orgId))
        .orderBy(pillarTemplates.displayOrder);
      if (orgTemplates.length > 0) return orgTemplates;
    }
    return db.select().from(pillarTemplates)
      .where(sql`${pillarTemplates.tenantId} IS NULL`)
      .orderBy(pillarTemplates.displayOrder);
  }

  async getPillarTemplate(id: string): Promise<PillarTemplate | undefined> {
    const [row] = await db.select().from(pillarTemplates).where(eq(pillarTemplates.id, id));
    return row;
  }

  async createPillarTemplate(data: InsertPillarTemplate): Promise<PillarTemplate> {
    const [row] = await db.insert(pillarTemplates).values(data).returning();
    return row;
  }

  async updatePillarTemplate(id: string, data: Partial<InsertPillarTemplate>): Promise<PillarTemplate> {
    const [row] = await db.update(pillarTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pillarTemplates.id, id))
      .returning();
    return row;
  }

  async deletePillarTemplate(id: string): Promise<void> {
    await db.delete(pillarTemplates).where(eq(pillarTemplates.id, id));
  }

  async getTechCategories(orgId: string | null): Promise<TechCategory[]> {
    if (orgId) {
      const orgCats = await db.select().from(techCategories)
        .where(eq(techCategories.tenantId, orgId))
        .orderBy(techCategories.displayOrder);
      if (orgCats.length > 0) return orgCats;
    }
    return db.select().from(techCategories)
      .where(sql`${techCategories.tenantId} IS NULL`)
      .orderBy(techCategories.displayOrder);
  }

  async getTechCategory(id: string): Promise<TechCategory | undefined> {
    const [row] = await db.select().from(techCategories).where(eq(techCategories.id, id));
    return row;
  }

  async createTechCategory(data: InsertTechCategory): Promise<TechCategory> {
    const [row] = await db.insert(techCategories).values(data).returning();
    return row;
  }

  async updateTechCategory(id: string, data: Partial<InsertTechCategory>): Promise<TechCategory> {
    const [row] = await db.update(techCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(techCategories.id, id))
      .returning();
    return row;
  }

  async deleteTechCategory(id: string): Promise<void> {
    await db.delete(techCategories).where(eq(techCategories.id, id));
  }

  async createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [row] = await db.insert(passwordResetTokens).values(data).returning();
    return row;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [row] = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return row;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  async deletePasswordResetTokensByUser(userId: string): Promise<void> {
    await db.delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));
  }
}

export const storage = new DatabaseStorage();
