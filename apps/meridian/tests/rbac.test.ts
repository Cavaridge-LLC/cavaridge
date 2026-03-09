import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createMockUser, createMockOrg, createMockDeal, createMockStorage, createTestApp } from "./helpers";
import type { IStorage } from "../server/storage";

const mockStorageRef: { current: IStorage } = { current: createMockStorage() };
const mockHasPermission = vi.fn().mockReturnValue(true);

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
  verifyDealAccess: (req: any, _res: any, next: any) => next(),
  requirePlatformRole: (req: any, res: any, next: any) => {
    if (!req.user || !["platform_owner", "platform_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Platform access required" });
    }
    next();
  },
  requirePlatformOwner: (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== "platform_owner") {
      return res.status(403).json({ message: "Platform owner access required" });
    }
    next();
  },
  AuthenticatedRequest: {},
}));

vi.mock("../server/permissions", () => ({
  get hasPermission() { return mockHasPermission; },
  getAccessibleDeals: vi.fn().mockResolvedValue([]),
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

const mockIngestDocument = vi.fn().mockResolvedValue({
  document: { id: "doc-1", filename: "test.pdf", dealId: "deal-1" },
  isDuplicate: false,
});

vi.mock("../server/ingestion", () => ({
  get ingestDocument() { return mockIngestDocument; },
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

describe("RBAC Tests", () => {
  let ms: IStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    ms = createMockStorage();
    mockStorageRef.current = ms;
    mockHasPermission.mockReturnValue(true);
  });

  describe("Viewer role restrictions", () => {
    it("should deny viewer from creating a deal", async () => {
      const viewer = createMockUser({ id: "viewer-1", role: "viewer" });
      const org = createMockOrg();

      mockHasPermission.mockImplementation((_user: any, action: string) => {
        if (action === "create_deals") return false;
        return true;
      });

      const app = createTestApp({ user: viewer, org, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app)
        .post("/api/deals")
        .send({ targetName: "Should Not Create", industry: "Technology/SaaS", stage: "initial-review" });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Insufficient permissions");
    });

    it("should deny viewer from uploading documents", async () => {
      const viewer = createMockUser({ id: "viewer-1", role: "viewer" });
      const org = createMockOrg();
      const deal = createMockDeal();

      (ms.getDeal as any).mockResolvedValue(deal);

      mockHasPermission.mockImplementation((_user: any, action: string) => {
        if (action === "upload_documents") return false;
        return true;
      });

      const app = createTestApp({ user: viewer, org, mockStorage: ms });
      const { registerDocumentRoutes } = await import("../server/routes/documents");
      registerDocumentRoutes(app);

      const res = await request(app)
        .post(`/api/deals/${deal.id}/documents`)
        .send({ filename: "test.pdf", fileType: "application/pdf", fileSize: 1024, objectPath: "uploads/test.pdf" });

      expect(res.status).toBe(403);
    });
  });

  describe("Analyst role permissions", () => {
    it("should allow analyst to create a deal", async () => {
      const analyst = createMockUser({ id: "analyst-1", role: "analyst" });
      const org = createMockOrg();
      const newDeal = createMockDeal({ id: "analyst-deal" });

      mockHasPermission.mockReturnValue(true);
      (ms.createDeal as any).mockResolvedValue(newDeal);
      (ms.createPillar as any).mockResolvedValue({ id: "p-1" });

      const app = createTestApp({ user: analyst, org, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app)
        .post("/api/deals")
        .send({ targetName: "Analyst Deal", industry: "Healthcare", stage: "initial-review" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("analyst-deal");
    });
  });

  describe("Platform admin access", () => {
    it("should allow platform_admin to access platform routes", async () => {
      const platformAdmin = createMockUser({ id: "pa-1", role: "platform_admin", isPlatformUser: true });
      const org = createMockOrg();

      (ms.getPlatformStats as any).mockResolvedValue({
        totalOrgs: 1, activeOrgs: 1, totalUsers: 5,
        totalDeals: 3, totalDocuments: 10, monthlyQueries: 50,
      });

      const app = createTestApp({ user: platformAdmin, org, mockStorage: ms });

      app.get("/api/platform/stats", (req: any, res: any, next: any) => {
        if (!req.user || !["platform_owner", "platform_admin"].includes(req.user.role)) {
          return res.status(403).json({ message: "Platform access required" });
        }
        next();
      }, async (_req: any, res: any) => {
        const stats = await ms.getPlatformStats();
        res.json(stats);
      });

      const res = await request(app).get("/api/platform/stats");

      expect(res.status).toBe(200);
      expect(res.body.totalOrgs).toBe(1);
    });

    it("should deny non-platform users from platform routes", async () => {
      const regularUser = createMockUser({ id: "user-1", role: "org_admin" });
      const org = createMockOrg();

      const app = createTestApp({ user: regularUser, org, mockStorage: ms });

      app.get("/api/platform/stats", (req: any, res: any, next: any) => {
        if (!req.user || !["platform_owner", "platform_admin"].includes(req.user.role)) {
          return res.status(403).json({ message: "Platform access required" });
        }
        next();
      }, async (_req: any, res: any) => {
        res.json({});
      });

      const res = await request(app).get("/api/platform/stats");

      expect(res.status).toBe(403);
    });
  });
});
