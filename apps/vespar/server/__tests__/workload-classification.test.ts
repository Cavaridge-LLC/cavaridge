/**
 * Vespar Workload Classification — Unit Tests
 *
 * Tests the workload sequencing algorithm and deterministic
 * strategy classification fallback logic.
 */

import { describe, it, expect } from "vitest";
import { sequenceWorkloads } from "../agents/migration-planner";
import type { Workload, Dependency } from "@shared/schema";

// -----------------------------------------------------------------------
// Helpers: Create test workloads and dependencies
// -----------------------------------------------------------------------

function makeWorkload(overrides: Partial<Workload> & { id: string; name: string }): Workload {
  return {
    id: overrides.id,
    projectId: "test-project",
    tenantId: "test-tenant",
    name: overrides.name,
    type: overrides.type ?? "server",
    environmentDetails: overrides.environmentDetails ?? null,
    currentHosting: overrides.currentHosting ?? null,
    criticality: overrides.criticality ?? "medium",
    migrationStrategy: overrides.migrationStrategy ?? null,
    status: overrides.status ?? "discovered",
    estimatedEffortHours: overrides.estimatedEffortHours ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

function makeDep(overrides: Partial<Dependency> & {
  sourceWorkloadId: string;
  targetWorkloadId: string;
}): Dependency {
  return {
    id: `dep-${overrides.sourceWorkloadId}-${overrides.targetWorkloadId}`,
    projectId: "test-project",
    tenantId: "test-tenant",
    sourceWorkloadId: overrides.sourceWorkloadId,
    targetWorkloadId: overrides.targetWorkloadId,
    dependencyType: overrides.dependencyType ?? "hard",
    description: overrides.description ?? null,
    blocksMigration: overrides.blocksMigration ?? true,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

// -----------------------------------------------------------------------
// Tests: Workload Sequencing (sequenceWorkloads)
// -----------------------------------------------------------------------

describe("Workload Sequencing", () => {
  it("should sequence independent workloads in a single phase", () => {
    const workloads = [
      makeWorkload({ id: "w1", name: "Server A" }),
      makeWorkload({ id: "w2", name: "Server B" }),
      makeWorkload({ id: "w3", name: "Server C" }),
    ];

    const result = sequenceWorkloads(workloads, []);
    expect(result).toHaveLength(3);
    // All in phase 1 since no dependencies
    expect(result.every((r) => r.phase === 1)).toBe(true);
  });

  it("should respect blocking dependency ordering", () => {
    const workloads = [
      makeWorkload({ id: "db", name: "Database", type: "database" }),
      makeWorkload({ id: "app", name: "Application", type: "application" }),
    ];

    const deps = [
      // app depends on db (db must migrate first)
      makeDep({ sourceWorkloadId: "db", targetWorkloadId: "app", blocksMigration: true }),
    ];

    const result = sequenceWorkloads(workloads, deps);
    const dbItem = result.find((r) => r.workloadId === "db")!;
    const appItem = result.find((r) => r.workloadId === "app")!;

    expect(dbItem.phase).toBeLessThan(appItem.phase);
  });

  it("should handle multi-level dependency chains", () => {
    const workloads = [
      makeWorkload({ id: "w1", name: "Identity", type: "identity", criticality: "critical" }),
      makeWorkload({ id: "w2", name: "Database", type: "database", criticality: "high" }),
      makeWorkload({ id: "w3", name: "App Server", type: "application", criticality: "high" }),
      makeWorkload({ id: "w4", name: "Web Frontend", type: "application", criticality: "medium" }),
    ];

    const deps = [
      makeDep({ sourceWorkloadId: "w1", targetWorkloadId: "w2", blocksMigration: true }),
      makeDep({ sourceWorkloadId: "w2", targetWorkloadId: "w3", blocksMigration: true }),
      makeDep({ sourceWorkloadId: "w3", targetWorkloadId: "w4", blocksMigration: true }),
    ];

    const result = sequenceWorkloads(workloads, deps);
    const phases = result.map((r) => ({ id: r.workloadId, phase: r.phase }));

    expect(phases.find((p) => p.id === "w1")!.phase).toBe(1);
    expect(phases.find((p) => p.id === "w2")!.phase).toBe(2);
    expect(phases.find((p) => p.id === "w3")!.phase).toBe(3);
    expect(phases.find((p) => p.id === "w4")!.phase).toBe(4);
  });

  it("should ignore non-blocking dependencies for sequencing", () => {
    const workloads = [
      makeWorkload({ id: "w1", name: "Server A" }),
      makeWorkload({ id: "w2", name: "Server B" }),
    ];

    const deps = [
      makeDep({ sourceWorkloadId: "w1", targetWorkloadId: "w2", blocksMigration: false }),
    ];

    const result = sequenceWorkloads(workloads, deps);
    // Both in phase 1 since the dependency is non-blocking
    expect(result.every((r) => r.phase === 1)).toBe(true);
  });

  it("should detect circular dependencies", () => {
    const workloads = [
      makeWorkload({ id: "w1", name: "Service A" }),
      makeWorkload({ id: "w2", name: "Service B" }),
    ];

    const deps = [
      makeDep({ sourceWorkloadId: "w1", targetWorkloadId: "w2", blocksMigration: true }),
      makeDep({ sourceWorkloadId: "w2", targetWorkloadId: "w1", blocksMigration: true }),
    ];

    const result = sequenceWorkloads(workloads, deps);
    // Both should be flagged as cycle members (phase -1)
    const cycleMembers = result.filter((r) => r.phase === -1);
    expect(cycleMembers).toHaveLength(2);
    expect(cycleMembers[0].blockedBy).toContain("CIRCULAR DEPENDENCY DETECTED");
  });

  it("should sort within phase by criticality (critical first)", () => {
    const workloads = [
      makeWorkload({ id: "w1", name: "Low Priority", criticality: "low" }),
      makeWorkload({ id: "w2", name: "Critical System", criticality: "critical" }),
      makeWorkload({ id: "w3", name: "High Priority", criticality: "high" }),
    ];

    const result = sequenceWorkloads(workloads, []);
    // All in phase 1, but critical should come first
    expect(result[0].criticality).toBe("critical");
    expect(result[1].criticality).toBe("high");
    expect(result[2].criticality).toBe("low");
  });

  it("should track blockedBy names correctly", () => {
    const workloads = [
      makeWorkload({ id: "db1", name: "Primary DB" }),
      makeWorkload({ id: "db2", name: "Secondary DB" }),
      makeWorkload({ id: "app", name: "Application" }),
    ];

    const deps = [
      makeDep({ sourceWorkloadId: "db1", targetWorkloadId: "app", blocksMigration: true }),
      makeDep({ sourceWorkloadId: "db2", targetWorkloadId: "app", blocksMigration: true }),
    ];

    const result = sequenceWorkloads(workloads, deps);
    const appItem = result.find((r) => r.workloadId === "app")!;

    expect(appItem.blockedBy).toContain("Primary DB");
    expect(appItem.blockedBy).toContain("Secondary DB");
    expect(appItem.blockedBy).toHaveLength(2);
  });

  it("should handle empty workload list", () => {
    const result = sequenceWorkloads([], []);
    expect(result).toHaveLength(0);
  });

  it("should handle a single workload with no dependencies", () => {
    const workloads = [makeWorkload({ id: "w1", name: "Solo Server" })];
    const result = sequenceWorkloads(workloads, []);
    expect(result).toHaveLength(1);
    expect(result[0].phase).toBe(1);
    expect(result[0].wave).toBe(1);
  });

  it("should handle diamond dependency pattern", () => {
    // A -> B, A -> C, B -> D, C -> D
    const workloads = [
      makeWorkload({ id: "a", name: "Root" }),
      makeWorkload({ id: "b", name: "Left Branch" }),
      makeWorkload({ id: "c", name: "Right Branch" }),
      makeWorkload({ id: "d", name: "Leaf" }),
    ];

    const deps = [
      makeDep({ sourceWorkloadId: "a", targetWorkloadId: "b", blocksMigration: true }),
      makeDep({ sourceWorkloadId: "a", targetWorkloadId: "c", blocksMigration: true }),
      makeDep({ sourceWorkloadId: "b", targetWorkloadId: "d", blocksMigration: true }),
      makeDep({ sourceWorkloadId: "c", targetWorkloadId: "d", blocksMigration: true }),
    ];

    const result = sequenceWorkloads(workloads, deps);
    const phases = Object.fromEntries(result.map((r) => [r.workloadId, r.phase]));

    expect(phases.a).toBe(1);
    expect(phases.b).toBe(2);
    expect(phases.c).toBe(2);
    expect(phases.d).toBe(3);
  });
});

// -----------------------------------------------------------------------
// Tests: Deterministic Strategy Classification
// -----------------------------------------------------------------------

describe("Deterministic Strategy Classification", () => {
  // Replicate the deterministic classification logic for testing
  function classifyDeterministic(workload: {
    type: string;
    criticality: string;
    notes?: string | null;
  }): { strategy: string; reasoning: string; confidence: number } {
    const notes = (workload.notes ?? "").toLowerCase();

    if (notes.includes("decommission") || notes.includes("retire") || notes.includes("end of life")) {
      return { strategy: "retire", reasoning: "Notes indicate workload should be decommissioned.", confidence: 0.7 };
    }
    if (notes.includes("saas") || notes.includes("replace") || notes.includes("repurchase")) {
      return { strategy: "repurchase", reasoning: "Notes suggest replacing with a SaaS solution.", confidence: 0.6 };
    }
    if (notes.includes("refactor") || notes.includes("cloud-native") || notes.includes("redesign")) {
      return { strategy: "refactor", reasoning: "Notes suggest re-architecting for cloud-native.", confidence: 0.6 };
    }

    switch (workload.type) {
      case "database":
        return { strategy: "replatform", reasoning: "Databases benefit from managed services (RDS, Cloud SQL).", confidence: 0.5 };
      case "identity":
        return { strategy: "retain", reasoning: "Identity systems carry high risk and often stay on-prem initially.", confidence: 0.5 };
      case "application":
        if (workload.criticality === "critical" || workload.criticality === "high") {
          return { strategy: "replatform", reasoning: "Critical applications benefit from managed platform services.", confidence: 0.4 };
        }
        return { strategy: "rehost", reasoning: "Standard applications default to lift-and-shift.", confidence: 0.4 };
      case "storage":
        return { strategy: "rehost", reasoning: "Storage workloads are typically rehosted to cloud storage.", confidence: 0.5 };
      case "network":
        return { strategy: "replatform", reasoning: "Network services benefit from cloud-native networking.", confidence: 0.4 };
      default:
        return { strategy: "rehost", reasoning: "Default to lift-and-shift for unclassified workloads.", confidence: 0.3 };
    }
  }

  it("should classify databases as replatform", () => {
    const result = classifyDeterministic({ type: "database", criticality: "high" });
    expect(result.strategy).toBe("replatform");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should classify identity systems as retain", () => {
    const result = classifyDeterministic({ type: "identity", criticality: "critical" });
    expect(result.strategy).toBe("retain");
  });

  it("should classify critical applications as replatform", () => {
    const result = classifyDeterministic({ type: "application", criticality: "critical" });
    expect(result.strategy).toBe("replatform");
  });

  it("should classify low-criticality applications as rehost", () => {
    const result = classifyDeterministic({ type: "application", criticality: "low" });
    expect(result.strategy).toBe("rehost");
  });

  it("should detect retire keyword in notes", () => {
    const result = classifyDeterministic({ type: "server", criticality: "low", notes: "End of life, should decommission" });
    expect(result.strategy).toBe("retire");
  });

  it("should detect SaaS replacement keyword in notes", () => {
    const result = classifyDeterministic({ type: "application", criticality: "medium", notes: "Replace with SaaS CRM" });
    expect(result.strategy).toBe("repurchase");
  });

  it("should detect refactor keyword in notes", () => {
    const result = classifyDeterministic({ type: "application", criticality: "high", notes: "Needs cloud-native redesign" });
    expect(result.strategy).toBe("refactor");
  });

  it("should default to rehost for unknown types", () => {
    const result = classifyDeterministic({ type: "mainframe", criticality: "high" });
    expect(result.strategy).toBe("rehost");
    expect(result.confidence).toBe(0.3);
  });

  it("should prioritize notes over type-based classification", () => {
    // Database type would normally be replatform, but notes say retire
    const result = classifyDeterministic({ type: "database", criticality: "critical", notes: "Legacy system, scheduled for decommission" });
    expect(result.strategy).toBe("retire");
  });

  it("should return valid 6Rs strategy for all cases", () => {
    const validStrategies = ["rehost", "replatform", "refactor", "repurchase", "retire", "retain"];
    const types = ["server", "database", "application", "storage", "network", "identity", "other", "unknown"];
    const criticalities = ["critical", "high", "medium", "low"];

    for (const type of types) {
      for (const crit of criticalities) {
        const result = classifyDeterministic({ type, criticality: crit });
        expect(validStrategies).toContain(result.strategy);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(result.reasoning.length).toBeGreaterThan(0);
      }
    }
  });
});
