import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createMockUser, createMockOrg, createMockDeal, createMockStorage, createTestApp } from "./helpers";
import type { IStorage } from "../server/storage";

const mockStorageRef: { current: IStorage } = { current: createMockStorage() };
const mockGetAccessibleDeals = vi.fn().mockResolvedValue([]);

vi.mock("../server/storage", () => ({
  get storage() { return mockStorageRef.current; },
  DatabaseStorage: vi.fn(),
}));

vi.mock("../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    execute: vi.fn().mockResolvedValue({ rows: [{ max_num: 0 }] }),
  },
  runMigrations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../server/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    next();
  },
  loadUser: (_req: any, _res: any, next: any) => next(),
  createSessionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  hashPassword: vi.fn().mockResolvedValue("$2a$10$hashed"),
  verifyPassword: vi.fn(),
  logAudit: vi.fn().mockResolvedValue(undefined),
  verifyDealAccess: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const dealId = req.params.id || req.params.dealId;
    const orgDealMap: Record<string, string> = {
      "deal-org1": "org-1",
      "deal-org2": "org-2",
    };
    const dealOrgId = orgDealMap[dealId];
    if (dealOrgId && dealOrgId !== req.orgId) {
      return res.status(404).json({ message: "Deal not found" });
    }
    next();
  },
  requirePlatformRole: (req: any, res: any, next: any) => next(),
  requirePlatformOwner: (req: any, res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

vi.mock("../server/permissions", () => ({
  hasPermission: vi.fn().mockReturnValue(true),
  get getAccessibleDeals() { return mockGetAccessibleDeals; },
  hasAccessToDeal: vi.fn().mockResolvedValue(true),
}));

vi.mock("../server/plan-limits", () => ({
  checkPlanLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 10, planTier: "starter" }),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
  getUsageSummary: vi.fn().mockResolvedValue({}),
  PLAN_LIMITS: { starter: { users: 5, deals: 10, storage: 5000, documents: 100, queries: 500 } },
  getNextTier: vi.fn().mockReturnValue("professional"),
  tierLabel: vi.fn().mockReturnValue("Starter"),
  limitLabel: vi.fn().mockReturnValue("Deals"),
}));

vi.mock("../server/finding-matcher", () => ({
  embedAndMatchFindings: vi.fn().mockResolvedValue({ matched: 0 }),
  getCrossReferencesForDeal: vi.fn().mockResolvedValue([]),
}));

vi.mock("../server/ingestion", () => ({
  ingestDocument: vi.fn().mockResolvedValue({ document: { id: "doc-1", filename: "test.pdf" }, isDuplicate: false }),
  getDocumentStats: vi.fn().mockResolvedValue({}),
  reprocessDocument: vi.fn().mockResolvedValue({ success: true }),
  applyVisionResult: vi.fn(),
}));

vi.mock("../server/vision", () => ({
  analyzeImage: vi.fn(),
  hasVisionCapability: vi.fn().mockReturnValue(false),
  checkImageSize: vi.fn().mockReturnValue(true),
  isImageFile: vi.fn().mockReturnValue(false),
}));

vi.mock("../server/replit_integrations/object_storage", () => ({
  ObjectStorageService: { getSignedUrl: vi.fn(), deleteObject: vi.fn() },
}));

vi.mock("../server/embeddings", () => ({
  embedChunksForDeal: vi.fn(),
  getEmbeddingProgress: vi.fn().mockResolvedValue({ total: 0, embedded: 0 }),
  semanticSearch: vi.fn().mockResolvedValue([]),
}));

vi.mock("../server/processing-pipeline", () => ({
  enqueueDocument: vi.fn().mockResolvedValue(undefined),
  getQueueStatus: vi.fn().mockResolvedValue({ queued: 0, processing: 0, completed: 0, failed: 0 }),
  retryFailedItems: vi.fn().mockResolvedValue(0),
  getEnhancedDocStats: vi.fn().mockResolvedValue({ total: 0 }),
}));

vi.mock("../server/preview", () => ({
  generateImagePreview: vi.fn(),
  generatePdfPreview: vi.fn(),
  generateTextPreview: vi.fn(),
  generateDocxPreview: vi.fn(),
  generateXlsxPreview: vi.fn(),
  generatePptxPreview: vi.fn(),
  generateEmailPreview: vi.fn(),
  getDocumentMetadata: vi.fn().mockReturnValue({}),
  getPreviewType: vi.fn().mockReturnValue("unsupported"),
  clearPreviewCache: vi.fn(),
  getFileExtension: vi.fn().mockReturnValue("pdf"),
}));

describe("Organization Isolation Tests", () => {
  let ms: IStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    ms = createMockStorage();
    mockStorageRef.current = ms;
  });

  describe("Cross-org deal isolation", () => {
    it("should only show deals from the user's organization", async () => {
      const org1User = createMockUser({ id: "user-org1", organizationId: "org-1" });
      const org1 = createMockOrg({ id: "org-1", name: "Org One" });
      const org1Deals = [
        createMockDeal({ id: "deal-org1", organizationId: "org-1", targetName: "Org1 Target" }),
      ];

      mockGetAccessibleDeals.mockResolvedValue(org1Deals);

      const app = createTestApp({ user: org1User, org: org1, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app).get("/api/deals");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].organizationId).toBe("org-1");
      expect(mockGetAccessibleDeals).toHaveBeenCalledWith("user-org1", "org-1", "org_owner");
    });

    it("should prevent access to another org's deal", async () => {
      const org1User = createMockUser({ id: "user-org1", organizationId: "org-1" });
      const org1 = createMockOrg({ id: "org-1" });

      const app = createTestApp({ user: org1User, org: org1, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app).get("/api/deals/deal-org2");

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("not found");
    });
  });

  describe("Cross-org document isolation", () => {
    it("should only list documents from deals in the user's org", async () => {
      const org1User = createMockUser({ id: "user-org1", organizationId: "org-1" });
      const org1 = createMockOrg({ id: "org-1" });
      const org1Docs = [
        { id: "doc-org1-1", filename: "org1-report.pdf", dealId: "deal-org1" },
        { id: "doc-org1-2", filename: "org1-analysis.xlsx", dealId: "deal-org1" },
      ];

      (ms.getDocumentsByDeal as any).mockResolvedValue(org1Docs);

      const app = createTestApp({ user: org1User, org: org1, mockStorage: ms });
      const { registerDocumentRoutes } = await import("../server/routes/documents");
      registerDocumentRoutes(app);

      const res = await request(app).get("/api/deals/deal-org1/documents");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every((d: any) => d.dealId === "deal-org1")).toBe(true);
    });

    it("should prevent accessing documents from another org's deal", async () => {
      const org1User = createMockUser({ id: "user-org1", organizationId: "org-1" });
      const org1 = createMockOrg({ id: "org-1" });

      const app = createTestApp({ user: org1User, org: org1, mockStorage: ms });
      const { registerDocumentRoutes } = await import("../server/routes/documents");
      registerDocumentRoutes(app);

      const res = await request(app).get("/api/deals/deal-org2/documents");

      expect(res.status).toBe(404);
    });
  });

  describe("Cross-org finding isolation", () => {
    it("should prevent accessing findings from another org's deal", async () => {
      const org1User = createMockUser({ id: "user-org1", organizationId: "org-1" });
      const org1 = createMockOrg({ id: "org-1" });

      const app = createTestApp({ user: org1User, org: org1, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app).get("/api/deals/deal-org2/findings");

      expect(res.status).toBe(404);
    });
  });
});
