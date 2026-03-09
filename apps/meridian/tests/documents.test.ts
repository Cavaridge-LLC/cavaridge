import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createMockUser, createMockOrg, createMockDeal, createMockStorage, createTestApp } from "./helpers";
import type { IStorage } from "../server/storage";

const mockStorageRef: { current: IStorage } = { current: createMockStorage() };

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
    execute: vi.fn().mockResolvedValue({ rows: [] }),
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
  requirePlatformRole: (req: any, res: any, next: any) => next(),
  requirePlatformOwner: (req: any, res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

vi.mock("../server/permissions", () => ({
  hasPermission: vi.fn().mockReturnValue(true),
  getAccessibleDeals: vi.fn().mockResolvedValue([]),
  hasAccessToDeal: vi.fn().mockResolvedValue(true),
}));

vi.mock("../server/plan-limits", () => ({
  checkPlanLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100, planTier: "starter" }),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
  getUsageSummary: vi.fn().mockResolvedValue({}),
  PLAN_LIMITS: { starter: { users: 5, deals: 10, storage: 5000, documents: 100, queries: 500 } },
  getNextTier: vi.fn().mockReturnValue("professional"),
  tierLabel: vi.fn().mockReturnValue("Starter"),
  limitLabel: vi.fn().mockReturnValue("Documents"),
}));

const mockIngestDocument = vi.fn();

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
  embedChunksForDeal: vi.fn().mockResolvedValue(undefined),
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

describe("Document Routes", () => {
  let ms: IStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    ms = createMockStorage();
    mockStorageRef.current = ms;
  });

  describe("POST /api/deals/:id/documents", () => {
    it("should associate a document upload with a deal", async () => {
      const user = createMockUser();
      const org = createMockOrg();
      const deal = createMockDeal();

      (ms.getDeal as any).mockResolvedValue(deal);
      mockIngestDocument.mockResolvedValue({
        document: { id: "doc-1", filename: "test-report.pdf", dealId: deal.id, extractionStatus: "completed" },
        isDuplicate: false,
      });

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDocumentRoutes } = await import("../server/routes/documents");
      registerDocumentRoutes(app);

      const res = await request(app)
        .post(`/api/deals/${deal.id}/documents`)
        .send({
          filename: "test-report.pdf",
          fileType: "application/pdf",
          fileSize: 1024000,
          objectPath: "uploads/test-report.pdf",
        });

      expect(res.status).toBe(201);
      expect(res.body.filename).toBe("test-report.pdf");
    });

    it("should reject upload for non-existent deal", async () => {
      const user = createMockUser();
      const org = createMockOrg();

      (ms.getDeal as any).mockResolvedValue(undefined);

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDocumentRoutes } = await import("../server/routes/documents");
      registerDocumentRoutes(app);

      const res = await request(app)
        .post("/api/deals/nonexistent/documents")
        .send({
          filename: "test.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
          objectPath: "uploads/test.pdf",
        });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/deals/:id/documents", () => {
    it("should list documents scoped to an organization's deal", async () => {
      const user = createMockUser({ organizationId: "org-1" });
      const org = createMockOrg({ id: "org-1" });
      const docs = [
        { id: "doc-1", filename: "report.pdf", dealId: "deal-1", classification: "IT Policy" },
        { id: "doc-2", filename: "network.xlsx", dealId: "deal-1", classification: "Network Documentation" },
      ];

      (ms.getDocumentsByDeal as any).mockResolvedValue(docs);

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDocumentRoutes } = await import("../server/routes/documents");
      registerDocumentRoutes(app);

      const res = await request(app).get("/api/deals/deal-1/documents");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(ms.getDocumentsByDeal).toHaveBeenCalledWith("deal-1");
    });
  });
});
