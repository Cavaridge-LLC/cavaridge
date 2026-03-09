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
  requirePlatformRole: (req: any, res: any, next: any) => next(),
  requirePlatformOwner: (req: any, res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

const mockGetAccessibleDeals = vi.fn().mockResolvedValue([]);

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

describe("Deal Routes", () => {
  let ms: IStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    ms = createMockStorage();
    mockStorageRef.current = ms;
  });

  describe("GET /api/deals", () => {
    it("should list deals for authenticated user", async () => {
      const user = createMockUser();
      const org = createMockOrg();
      const deals = [createMockDeal(), createMockDeal({ id: "deal-2", dealCode: "MRD-2025-002", targetName: "Target 2" })];

      mockGetAccessibleDeals.mockResolvedValue(deals);

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app).get("/api/deals");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it("should return 401 for unauthenticated requests", async () => {
      const app = createTestApp({ user: null, org: null, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app).get("/api/deals");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/deals", () => {
    it("should create a deal successfully", async () => {
      const user = createMockUser();
      const org = createMockOrg();
      const newDeal = createMockDeal({ id: "created-deal" });

      (ms.createDeal as any).mockResolvedValue(newDeal);
      (ms.createPillar as any).mockResolvedValue({ id: "p-1" });

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app)
        .post("/api/deals")
        .send({ targetName: "New Target", industry: "Technology/SaaS", stage: "initial-review" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("created-deal");
      expect(ms.createDeal).toHaveBeenCalled();
      expect(ms.createPillar).toHaveBeenCalledTimes(6);
    });

    it("should reject deal creation with missing fields", async () => {
      const user = createMockUser();
      const org = createMockOrg();

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app)
        .post("/api/deals")
        .send({ targetName: "Incomplete" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("required");
    });
  });

  describe("GET /api/deals/:id", () => {
    it("should return a specific deal", async () => {
      const user = createMockUser();
      const org = createMockOrg();
      const deal = createMockDeal({ id: "deal-123" });

      (ms.getDeal as any).mockResolvedValue(deal);

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app).get("/api/deals/deal-123");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("deal-123");
    });

    it("should return 404 for non-existent deal", async () => {
      const user = createMockUser();
      const org = createMockOrg();

      (ms.getDeal as any).mockResolvedValue(undefined);

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app).get("/api/deals/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/deals/:id/findings", () => {
    it("should create a finding for a deal", async () => {
      const user = createMockUser();
      const org = createMockOrg();
      const deal = createMockDeal();
      const finding = { id: "finding-1", dealId: deal.id, pillarId: "pillar-1", severity: "high", title: "Test Finding", status: "open" };

      (ms.getDeal as any).mockResolvedValue(deal);
      (ms.createFinding as any).mockResolvedValue(finding);
      (ms.getPillarsByDeal as any).mockResolvedValue([]);
      (ms.getFindingsByDeal as any).mockResolvedValue([]);
      (ms.getDocumentsByDeal as any).mockResolvedValue([]);

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerDealRoutes } = await import("../server/routes/deals");
      registerDealRoutes(app);

      const res = await request(app)
        .post(`/api/deals/${deal.id}/findings`)
        .send({ pillarId: "pillar-1", severity: "high", title: "Test Finding" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Test Finding");
      expect(ms.createFinding).toHaveBeenCalled();
    });
  });
});
