import { vi } from "vitest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { IStorage } from "../server/storage";

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  organizationId: string | null;
  passwordHash: string | null;
  isPlatformUser: boolean;
  invitedBy: string | null;
  invitedAt: Date | null;
  lastLoginAt: Date | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  notificationPrefs: any;
  createdAt: Date | null;
}

export interface MockOrg {
  id: string;
  name: string;
  slug: string | null;
  industryDefault: string | null;
  planTier: string;
  maxUsers: number;
  maxDeals: number;
  maxStorageMb: number;
  logoUrl: string | null;
  primaryColor: string | null;
  settingsJson: any;
  ownerUserId: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MockDeal {
  id: string;
  organizationId: string | null;
  dealCode: string;
  targetName: string;
  industry: string;
  stage: string;
  status: string;
  facilityCount: number | null;
  userCount: number | null;
  estimatedIntegrationCost: string | null;
  compositeScore: string | null;
  overallConfidence: string | null;
  documentsUploaded: number | null;
  documentsAnalyzed: number | null;
  lifecycleStage: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role: "msp_admin",
    status: "active",
    organizationId: "org-1",
    passwordHash: "$2a$10$hashedpassword",
    isPlatformUser: false,
    invitedBy: null,
    invitedAt: null,
    lastLoginAt: null,
    avatarUrl: null,
    jobTitle: null,
    notificationPrefs: {},
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockOrg(overrides: Partial<MockOrg> = {}): MockOrg {
  return {
    id: "org-1",
    name: "Test Org",
    slug: "test-org",
    industryDefault: null,
    planTier: "starter",
    maxUsers: 5,
    maxDeals: 10,
    maxStorageMb: 5000,
    logoUrl: null,
    primaryColor: null,
    settingsJson: {},
    ownerUserId: "user-1",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockDeal(overrides: Partial<MockDeal> = {}): MockDeal {
  return {
    id: "deal-1",
    organizationId: "org-1",
    dealCode: "MRD-2025-001",
    targetName: "Test Target",
    industry: "Technology/SaaS",
    stage: "initial-review",
    status: "on-track",
    facilityCount: 0,
    userCount: 0,
    estimatedIntegrationCost: null,
    compositeScore: "60.0",
    overallConfidence: "insufficient",
    documentsUploaded: 0,
    documentsAnalyzed: 0,
    lifecycleStage: "assessment",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockStorage(overrides: Partial<IStorage> = {}): IStorage {
  const defaultStorage: IStorage = {
    getUser: vi.fn().mockResolvedValue(undefined),
    getUserByEmail: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockImplementation(async (data: any) => ({ id: "new-user", ...data, createdAt: new Date() })),
    updateUser: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    getOrganization: vi.fn().mockResolvedValue(undefined),
    createOrganization: vi.fn().mockImplementation(async (data: any) => ({ id: "new-org", ...data, createdAt: new Date(), updatedAt: new Date() })),
    getUsersByOrg: vi.fn().mockResolvedValue([]),
    getDealsByOrg: vi.fn().mockResolvedValue([]),
    getDeals: vi.fn().mockResolvedValue([]),
    getDeal: vi.fn().mockResolvedValue(undefined),
    createDeal: vi.fn().mockImplementation(async (data: any) => ({ id: "new-deal", ...data, createdAt: new Date(), updatedAt: new Date() })),
    getDealCountByOrg: vi.fn().mockResolvedValue(0),
    createDealAccess: vi.fn().mockImplementation(async (data: any) => ({ id: "new-da", ...data })),
    getDealAccessByDeal: vi.fn().mockResolvedValue([]),
    getDealAccessByUser: vi.fn().mockResolvedValue([]),
    deleteDealAccess: vi.fn().mockResolvedValue(undefined),
    createInvitation: vi.fn().mockImplementation(async (data: any) => ({ id: "new-inv", ...data })),
    getInvitationByToken: vi.fn().mockResolvedValue(undefined),
    getInvitationsByOrg: vi.fn().mockResolvedValue([]),
    updateInvitation: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    createAuditLog: vi.fn().mockImplementation(async (data: any) => ({ id: "new-audit", ...data })),
    getAuditLogByOrg: vi.fn().mockResolvedValue([]),
    getPillarsByDeal: vi.fn().mockResolvedValue([]),
    createPillar: vi.fn().mockImplementation(async (data: any) => ({ id: "new-pillar", ...data })),
    getFindingsByDeal: vi.fn().mockResolvedValue([]),
    getAllOpenAlertsByOrg: vi.fn().mockResolvedValue([]),
    getAllOpenAlerts: vi.fn().mockResolvedValue([]),
    createFinding: vi.fn().mockImplementation(async (data: any) => ({ id: "new-finding", ...data })),
    getDocumentsByDeal: vi.fn().mockResolvedValue([]),
    getDocument: vi.fn().mockResolvedValue(undefined),
    getDocumentByHash: vi.fn().mockResolvedValue(undefined),
    getChildDocuments: vi.fn().mockResolvedValue([]),
    createDocument: vi.fn().mockImplementation(async (data: any) => ({ id: "new-doc", ...data })),
    updateDocument: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    createDocumentChunk: vi.fn().mockImplementation(async (data: any) => ({ id: "new-chunk", ...data })),
    getChunksByDocument: vi.fn().mockResolvedValue([]),
    getChunkCountByDeal: vi.fn().mockResolvedValue(0),
    getChatMessagesByDeal: vi.fn().mockResolvedValue([]),
    createChatMessage: vi.fn().mockImplementation(async (data: any) => ({ id: "new-chat", ...data })),
    getBaselineProfiles: vi.fn().mockResolvedValue([]),
    getBaselineProfile: vi.fn().mockResolvedValue(undefined),
    createBaselineProfile: vi.fn().mockImplementation(async (data: any) => ({ id: "new-bp", ...data })),
    updateBaselineProfile: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    deleteBaselineProfile: vi.fn().mockResolvedValue(undefined),
    getTechStackByDeal: vi.fn().mockResolvedValue([]),
    createTechStackItem: vi.fn().mockImplementation(async (data: any) => ({ id: "new-ts", ...data })),
    deleteTechStackByDeal: vi.fn().mockResolvedValue(undefined),
    getBaselineComparisonsByDeal: vi.fn().mockResolvedValue([]),
    deleteBaselineComparisonsByDeal: vi.fn().mockResolvedValue(undefined),
    getTopologyNodesByDeal: vi.fn().mockResolvedValue([]),
    getTopologyConnectionsByDeal: vi.fn().mockResolvedValue([]),
    deleteTopologyByDeal: vi.fn().mockResolvedValue(undefined),
    insertTopologyNodes: vi.fn().mockResolvedValue([]),
    insertTopologyConnections: vi.fn().mockResolvedValue([]),
    insertTechStackItems: vi.fn().mockResolvedValue([]),
    insertBaselineComparisons: vi.fn().mockResolvedValue([]),
    getPlaybookPhasesByDeal: vi.fn().mockResolvedValue([]),
    getPlaybookTasksByPhase: vi.fn().mockResolvedValue([]),
    getPlaybookTasksByDeal: vi.fn().mockResolvedValue([]),
    deletePlaybookByDeal: vi.fn().mockResolvedValue(undefined),
    createPlaybookPhase: vi.fn().mockImplementation(async (data: any) => ({ id: "new-phase", ...data })),
    createPlaybookTask: vi.fn().mockImplementation(async (data: any) => ({ id: "new-task", ...data })),
    getScoreSnapshotsByOrg: vi.fn().mockResolvedValue([]),
    getScoreSnapshots: vi.fn().mockResolvedValue([]),
    getAllPillarsByOrg: vi.fn().mockResolvedValue([]),
    getAllPillars: vi.fn().mockResolvedValue([]),
    updateDeal: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    updatePillar: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    getDealCount: vi.fn().mockResolvedValue(0),
    getFindingsByPillar: vi.fn().mockResolvedValue([]),
    getPipelineStats: vi.fn().mockResolvedValue({ activeDeals: 0, avgItScore: 0, openAlerts: 0, estIntegration: "$0", docsAnalyzed: 0, docsUploaded: 0 }),
    getPipelineStatsByOrg: vi.fn().mockResolvedValue({ activeDeals: 0, avgItScore: 0, openAlerts: 0, estIntegration: "$0", docsAnalyzed: 0, docsUploaded: 0 }),
    createQueueItem: vi.fn().mockImplementation(async (data: any) => ({ id: "new-qi", ...data })),
    getQueueItemsByDeal: vi.fn().mockResolvedValue([]),
    getQueueItemsByDocument: vi.fn().mockResolvedValue([]),
    updateQueueItem: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    getNextQueuedItems: vi.fn().mockResolvedValue([]),
    getFailedQueueItems: vi.fn().mockResolvedValue([]),
    deleteQueueItemsByDocument: vi.fn().mockResolvedValue(undefined),
    getTotalTextLength: vi.fn().mockResolvedValue(0),
    getEmbeddedChunkCount: vi.fn().mockResolvedValue(0),
    updateOrganization: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    getUserCount: vi.fn().mockResolvedValue(1),
    getDocumentStorageByOrg: vi.fn().mockResolvedValue(0),
    getAuditLogFiltered: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
    upsertDealAccess: vi.fn().mockImplementation(async (data: any) => ({ id: "new-da", ...data })),
    deleteDealAccessByUser: vi.fn().mockResolvedValue(undefined),
    getAllOrganizations: vi.fn().mockResolvedValue([]),
    getPlatformSetting: vi.fn().mockResolvedValue(undefined),
    getAllPlatformSettings: vi.fn().mockResolvedValue([]),
    upsertPlatformSetting: vi.fn().mockImplementation(async (key: string, value: any) => ({ id: "ps-1", settingKey: key, settingValue: value })),
    getAccountRequests: vi.fn().mockResolvedValue([]),
    getAccountRequest: vi.fn().mockResolvedValue(undefined),
    createAccountRequest: vi.fn().mockImplementation(async (data: any) => ({ id: "new-ar", ...data })),
    updateAccountRequest: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    getPlatformUsers: vi.fn().mockResolvedValue([]),
    deleteOrganization: vi.fn().mockResolvedValue(undefined),
    getPlatformStats: vi.fn().mockResolvedValue({ totalOrgs: 0, activeOrgs: 0, totalUsers: 0, totalDeals: 0, totalDocuments: 0, monthlyQueries: 0 }),
    createDocumentClassification: vi.fn().mockImplementation(async (data: any) => ({ id: "new-dc", ...data })),
    getDocumentClassification: vi.fn().mockResolvedValue(undefined),
    getDocumentClassificationsByDeal: vi.fn().mockResolvedValue([]),
    updateDocumentClassification: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    deleteDocumentClassification: vi.fn().mockResolvedValue(undefined),
    createQaConversation: vi.fn().mockImplementation(async (data: any) => ({ id: "new-qa", ...data })),
    getQaConversationsByDeal: vi.fn().mockResolvedValue([]),
    getQaConversation: vi.fn().mockResolvedValue(undefined),
    deleteQaConversation: vi.fn().mockResolvedValue(undefined),
    updateQaConversation: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    createQaMessage: vi.fn().mockImplementation(async (data: any) => ({ id: "new-qam", ...data })),
    getQaMessagesByConversation: vi.fn().mockResolvedValue([]),
    getQaMessage: vi.fn().mockResolvedValue(undefined),
    createQaSavedAnswer: vi.fn().mockImplementation(async (data: any) => ({ id: "new-qsa", ...data })),
    getQaSavedAnswersByDeal: vi.fn().mockResolvedValue([]),
    getBranding: vi.fn().mockResolvedValue(undefined),
    upsertBranding: vi.fn().mockImplementation(async (tenantId: string, data: any) => ({ id: "new-brand", tenantId, ...data })),
    getPillarTemplates: vi.fn().mockResolvedValue([]),
    getPillarTemplate: vi.fn().mockResolvedValue(undefined),
    createPillarTemplate: vi.fn().mockImplementation(async (data: any) => ({ id: "new-pt", ...data })),
    updatePillarTemplate: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    deletePillarTemplate: vi.fn().mockResolvedValue(undefined),
    getTechCategories: vi.fn().mockResolvedValue([]),
    getTechCategory: vi.fn().mockResolvedValue(undefined),
    createTechCategory: vi.fn().mockImplementation(async (data: any) => ({ id: "new-tc", ...data })),
    updateTechCategory: vi.fn().mockImplementation(async (id: string, data: any) => ({ id, ...data })),
    deleteTechCategory: vi.fn().mockResolvedValue(undefined),
    createPasswordResetToken: vi.fn().mockImplementation(async (data: any) => ({ id: "new-prt", ...data })),
    getPasswordResetToken: vi.fn().mockResolvedValue(undefined),
    markPasswordResetTokenUsed: vi.fn().mockResolvedValue(undefined),
    deletePasswordResetTokensByUser: vi.fn().mockResolvedValue(undefined),
  };

  return { ...defaultStorage, ...overrides };
}

export function createTestApp(options: {
  user?: MockUser | null;
  org?: MockOrg | null;
  mockStorage: IStorage;
}) {
  const app = express();
  app.use(express.json());

  app.use((req: any, _res: Response, next: NextFunction) => {
    if (options.user) {
      req.user = options.user;
      req.org = options.org || null;
      req.orgId = options.org?.id || options.user.organizationId || null;
    }
    req.session = {
      userId: options.user?.id || null,
      destroy: (cb: any) => cb && cb(),
    };
    next();
  });

  return app;
}
