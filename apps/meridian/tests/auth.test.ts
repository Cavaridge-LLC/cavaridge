import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createMockUser, createMockOrg, createMockStorage, createTestApp } from "./helpers";
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

const mockVerifyPassword = vi.fn();

vi.mock("../server/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    next();
  },
  loadUser: (_req: any, _res: any, next: any) => next(),
  createSessionMiddleware: () => (_req: any, _res: any, next: any) => next(),
  hashPassword: vi.fn().mockResolvedValue("$2a$10$hashed"),
  get verifyPassword() { return mockVerifyPassword; },
  logAudit: vi.fn().mockResolvedValue(undefined),
  verifyDealAccess: (req: any, _res: any, next: any) => next(),
  requirePlatformRole: (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== "platform_admin") {
      return res.status(403).json({ message: "Platform access required" });
    }
    next();
  },
  requirePlatformAdmin: (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== "platform_admin") {
      return res.status(403).json({ message: "Platform admin access required" });
    }
    next();
  },
  AuthenticatedRequest: {},
}));

vi.mock("../server/permissions", () => ({
  hasPermission: vi.fn().mockReturnValue(true),
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
  limitLabel: vi.fn().mockReturnValue("Users"),
}));

describe("Auth Routes", () => {
  let ms: IStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    ms = createMockStorage();
    mockStorageRef.current = ms;
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const newOrg = createMockOrg({ id: "new-org-id" });
      const newUser = createMockUser({ id: "new-user-id", email: "new@example.com" });

      (ms.getUserByEmail as any).mockResolvedValue(undefined);
      (ms.createOrganization as any).mockResolvedValue(newOrg);
      (ms.createUser as any).mockResolvedValue(newUser);

      const app = createTestApp({ user: null, org: null, mockStorage: ms });
      const { registerAuthRoutes } = await import("../server/routes/auth");
      registerAuthRoutes(app);

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "new@example.com", password: "password123", name: "New User", organizationName: "New Org" });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.organization).toBeDefined();
    });

    it("should reject registration with missing fields", async () => {
      const app = createTestApp({ user: null, org: null, mockStorage: ms });
      const { registerAuthRoutes } = await import("../server/routes/auth");
      registerAuthRoutes(app);

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("required");
    });

    it("should reject duplicate email registration", async () => {
      const existingUser = createMockUser({ email: "existing@example.com" });
      (ms.getUserByEmail as any).mockResolvedValue(existingUser);

      const app = createTestApp({ user: null, org: null, mockStorage: ms });
      const { registerAuthRoutes } = await import("../server/routes/auth");
      registerAuthRoutes(app);

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "existing@example.com", password: "password123", name: "Test User" });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already registered");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const user = createMockUser({ email: "login@example.com", status: "active" });
      (ms.getUserByEmail as any).mockResolvedValue(user);
      mockVerifyPassword.mockResolvedValue(true);
      (ms.updateUser as any).mockResolvedValue(user);

      const app = createTestApp({ user: null, org: null, mockStorage: ms });
      const { registerAuthRoutes } = await import("../server/routes/auth");
      registerAuthRoutes(app);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "login@example.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("login@example.com");
    });

    it("should reject login with invalid credentials", async () => {
      const user = createMockUser({ email: "login@example.com" });
      (ms.getUserByEmail as any).mockResolvedValue(user);
      mockVerifyPassword.mockResolvedValue(false);

      const app = createTestApp({ user: null, org: null, mockStorage: ms });
      const { registerAuthRoutes } = await import("../server/routes/auth");
      registerAuthRoutes(app);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "login@example.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid credentials");
    });

    it("should reject login for inactive account", async () => {
      const user = createMockUser({ email: "inactive@example.com", status: "suspended" });
      (ms.getUserByEmail as any).mockResolvedValue(user);

      const app = createTestApp({ user: null, org: null, mockStorage: ms });
      const { registerAuthRoutes } = await import("../server/routes/auth");
      registerAuthRoutes(app);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "inactive@example.com", password: "password123" });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("not active");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user when authenticated", async () => {
      const user = createMockUser();
      const org = createMockOrg();

      const app = createTestApp({ user, org, mockStorage: ms });
      const { registerAuthRoutes } = await import("../server/routes/auth");
      registerAuthRoutes(app);

      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(user.email);
    });

    it("should return 401 when not authenticated", async () => {
      const app = createTestApp({ user: null, org: null, mockStorage: ms });
      const { registerAuthRoutes } = await import("../server/routes/auth");
      registerAuthRoutes(app);

      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
    });
  });
});
