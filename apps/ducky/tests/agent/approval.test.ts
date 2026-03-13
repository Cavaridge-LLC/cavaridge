import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@shared/schema";

// ── Mocks ────────────────────────────────────────────────────────────

const mockReturning = vi.fn().mockResolvedValue([{ id: "mock-approval-id" }]);
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

vi.mock("../../server/db.js", () => ({
  db: { insert: (...args: unknown[]) => mockInsert(...args) },
}));

vi.mock("../../server/auth.js", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks ──────────────────────────────────────────────

import {
  evaluateApproval,
  getApprovalTier,
  recordApprovalDecision,
  DEFAULT_AGENT_CONFIG,
} from "../../server/agent/approval.js";
import { hasPermission } from "../../server/permissions.js";

// ── Fixtures ─────────────────────────────────────────────────────────

function mockUser(role: string): User {
  return {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    role,
    organizationId: "org-456",
    passwordHash: null,
    status: "active",
    isPlatformUser: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;
}

const baseParams = {
  orgId: "org-456",
  planId: "plan-789",
  stepId: "step-abc",
  actionPreview: { description: "Search GitHub repos" },
};

// ── Tests ────────────────────────────────────────────────────────────

describe("getApprovalTier", () => {
  it("maps 'read' to read tier", () => {
    expect(getApprovalTier("read")).toBe("read");
  });

  it("maps 'reason' to read tier", () => {
    expect(getApprovalTier("reason")).toBe("read");
  });

  it("maps 'write' to write tier", () => {
    expect(getApprovalTier("write")).toBe("write");
  });

  it("maps 'delete' to delete tier", () => {
    expect(getApprovalTier("delete")).toBe("delete");
  });
});

describe("evaluateApproval — read tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([{ id: "mock-approval-id" }]);
  });

  it("auto-approves read steps with default config", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("user"),
      stepType: "read",
    });

    expect(result.tier).toBe("read");
    expect(result.autoApproved).toBe(true);
    expect(result.requiresUserApproval).toBe(false);
    expect(result.approvalId).toBe("mock-approval-id");
  });

  it("auto-approves reason steps (maps to read tier)", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("user"),
      stepType: "reason",
    });

    expect(result.tier).toBe("read");
    expect(result.autoApproved).toBe(true);
  });

  it("requires manual approval when autoApproveReads is false", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("user"),
      stepType: "read",
      tenantConfig: { autoApproveReads: false },
    });

    expect(result.tier).toBe("read");
    expect(result.autoApproved).toBe(false);
    expect(result.requiresUserApproval).toBe(true);
    expect(result.approvalId).toBeUndefined();
  });

  it("creates an approval record when auto-approved", async () => {
    await evaluateApproval({
      ...baseParams,
      user: mockUser("user"),
      stepType: "read",
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "plan-789",
        stepId: "step-abc",
        approved: true,
        actionType: "read",
      }),
    );
  });
});

describe("evaluateApproval — write tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always requires user approval", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("tenant_admin"),
      stepType: "write",
    });

    expect(result.tier).toBe("write");
    expect(result.autoApproved).toBe(false);
    expect(result.requiresUserApproval).toBe(true);
  });

  it("cannot be auto-approved even with permissive config", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("platform_owner"),
      stepType: "write",
      tenantConfig: { autoApproveReads: true },
    });

    expect(result.autoApproved).toBe(false);
    expect(result.requiresUserApproval).toBe(true);
  });

  it("denies viewer role (no agent_approve_action permission)", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("viewer"),
      stepType: "write",
    });

    expect(result.requiresUserApproval).toBe(true);
    expect(result.reason).toContain("does not have agent_approve_action");
  });
});

describe("evaluateApproval — delete tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always requires explicit confirmation", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("tenant_admin"),
      stepType: "delete",
    });

    expect(result.tier).toBe("delete");
    expect(result.autoApproved).toBe(false);
    expect(result.requiresUserApproval).toBe(true);
  });

  it("cannot be auto-approved regardless of config", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("platform_owner"),
      stepType: "delete",
      tenantConfig: { autoApproveReads: true },
    });

    expect(result.autoApproved).toBe(false);
    expect(result.requiresUserApproval).toBe(true);
  });

  it("denies viewer role (no agent_approve_action permission)", async () => {
    const result = await evaluateApproval({
      ...baseParams,
      user: mockUser("viewer"),
      stepType: "delete",
    });

    expect(result.requiresUserApproval).toBe(true);
    expect(result.reason).toContain("does not have agent_approve_action");
  });
});

describe("recordApprovalDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([{ id: "recorded-approval-id" }]);
  });

  it("creates an approval record and returns its ID", async () => {
    const id = await recordApprovalDecision({
      orgId: "org-456",
      planId: "plan-789",
      stepId: "step-abc",
      userId: "user-123",
      actionType: "write",
      actionPreview: { description: "Create Jira ticket" },
      approved: true,
      responseComment: "Looks good",
    });

    expect(id).toBe("recorded-approval-id");
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        approved: true,
        actionType: "write",
        responseComment: "Looks good",
      }),
    );
  });

  it("records rejection with comment", async () => {
    const id = await recordApprovalDecision({
      orgId: "org-456",
      planId: "plan-789",
      stepId: "step-abc",
      userId: "user-123",
      actionType: "delete",
      actionPreview: { description: "Delete Slack channel" },
      approved: false,
      responseComment: "Too risky",
    });

    expect(id).toBe("recorded-approval-id");
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        approved: false,
        responseComment: "Too risky",
      }),
    );
  });
});

describe("DEFAULT_AGENT_CONFIG", () => {
  it("has expected defaults", () => {
    expect(DEFAULT_AGENT_CONFIG.autoApproveReads).toBe(true);
    expect(DEFAULT_AGENT_CONFIG.maxStepsPerPlan).toBe(10);
    expect(DEFAULT_AGENT_CONFIG.maxPlansPerHour).toBe(50);
    expect(DEFAULT_AGENT_CONFIG.maxActionsPerDay).toBe(25);
  });
});

describe("hasPermission — agent permissions", () => {
  it("grants agent_create_plan to user role", () => {
    expect(hasPermission(mockUser("user"), "agent_create_plan")).toBe(true);
  });

  it("grants agent_view_plans to viewer role", () => {
    expect(hasPermission(mockUser("viewer"), "agent_view_plans")).toBe(true);
  });

  it("denies agent_create_plan to viewer role", () => {
    expect(hasPermission(mockUser("viewer"), "agent_create_plan")).toBe(false);
  });

  it("denies agent_approve_action to viewer role", () => {
    expect(hasPermission(mockUser("viewer"), "agent_approve_action")).toBe(false);
  });

  it("grants all agent permissions to platform_owner", () => {
    const owner = mockUser("platform_owner");
    expect(hasPermission(owner, "agent_create_plan")).toBe(true);
    expect(hasPermission(owner, "agent_approve_plan")).toBe(true);
    expect(hasPermission(owner, "agent_approve_action")).toBe(true);
    expect(hasPermission(owner, "agent_view_plans")).toBe(true);
  });
});
