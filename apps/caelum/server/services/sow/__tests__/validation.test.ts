/**
 * Caelum SoW Validation Tests
 * Tests SowDocumentV2 interface validation, 8-section structure enforcement,
 * mandatory PM tasks, labor hours format, and formatting constants.
 */

import { describe, it, expect } from "vitest";
import {
  validateSowDocument,
  MANDATORY_PM_TASKS,
  SOW_FORMAT,
  type ValidationResult,
} from "../validation";
import { normalizeSowJson, type SowDocumentV2 } from "../../../../shared/models/sow";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function buildValidSow(overrides: Partial<SowDocumentV2> = {}): SowDocumentV2 {
  return {
    cover: {
      client: "Acme Corp",
      projectName: "Network Deployment — Main Office",
      provider: "Test MSP",
      billingModel: "Time & Materials",
      documentDate: "March 24, 2026",
      version: "1.0",
      classification: "Confidential",
    },
    summary: "Acme Corp requires a full network deployment at their main office location.",
    proposedSolution: {
      overview: "Test MSP will deploy a Meraki SD-WAN stack with redundant ISP failover.",
      subsections: [
        { number: "2.1", title: "Network Design", narrative: "Design a dual-ISP topology with automatic failover." },
      ],
    },
    prerequisites: [
      "Client must provide site access during business hours.",
      "ISP circuits must be provisioned and active before deployment date.",
      "Client must designate a primary point of contact.",
    ],
    projectManagement: {
      siteAddress: "123 Main St, Dallas, TX 75201",
      contacts: [{ role: "Client POC", name: "Jane Doe", email: "jane@acme.com" }],
      pmTasks: [
        "Provide project plan with milestones (if applicable) and estimated time of completion.",
        "Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting.",
        "Remove old documentation references and update documentation to reflect new configurations.",
        "Coordinate with ISP vendors for circuit handoff.",
      ],
    },
    phases: [
      {
        number: 1,
        title: "Site Survey & Design",
        objective: "Assess current infrastructure and finalize network design.",
        tasks: ["Conduct physical site survey", "Document existing topology"],
        deliverables: ["Network design document", "Equipment BOM"],
      },
      {
        number: 2,
        title: "Deployment & Configuration",
        objective: "Install and configure all network equipment.",
        tasks: ["Install Meraki MX appliances", "Configure VLANs and firewall rules"],
        deliverables: ["Operational network", "Configuration backup"],
      },
    ],
    caveatsRisks: {
      exclusions: ["Cabling runs exceeding 100 feet", "Wireless survey optimization"],
      assumptions: [
        "Existing cabling is Cat6 or better.",
        "Client has adequate rack space for new equipment.",
      ],
      risks: [
        {
          risk: "ISP circuit delay",
          impact: "Project timeline extends by 2-4 weeks.",
          mitigation: "Pre-order circuits 30 days in advance; maintain existing connectivity until cutover.",
        },
      ],
      changeControl: "Any work not explicitly described in this document is out of scope and requires a separate change order.",
    },
    completionCriteria: [
      "All Meraki devices online and reporting to dashboard.",
      "ISP failover tested and documented.",
      "Client sign-off on operational network.",
    ],
    laborHours: {
      format: "v2.1",
      rows: [
        { role: "Project Manager", scope: "Planning, coordination, status updates", hoursRange: "4 – 8" },
        { role: "Senior Engineer", scope: "Network design, configuration, cutover", hoursRange: "16 – 24" },
        { role: "Field Technician", scope: "Physical installation, cable management", hoursRange: "8 – 12" },
      ],
      totalHoursRange: "28 – 44",
      notes: ["Travel time included in field technician hours."],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SOW_FORMAT constants", () => {
  it("defines correct formatting values per v2.2 spec", () => {
    expect(SOW_FORMAT.font).toBe("Arial");
    expect(SOW_FORMAT.h1Color).toBe("2E5090");
    expect(SOW_FORMAT.h2Color).toBe("1A1A1A");
    expect(SOW_FORMAT.tableHeaderBg).toBe("2E5090");
    expect(SOW_FORMAT.tableHeaderText).toBe("FFFFFF");
    expect(SOW_FORMAT.rowBanding).toBe("F2F6FA");
    expect(SOW_FORMAT.borderColor).toBe("BFBFBF");
  });
});

describe("MANDATORY_PM_TASKS", () => {
  it("contains exactly 3 mandatory tasks", () => {
    expect(MANDATORY_PM_TASKS).toHaveLength(3);
  });

  it("includes project plan task", () => {
    expect(MANDATORY_PM_TASKS[0]).toContain("project plan with milestones");
  });

  it("includes regular updates task", () => {
    expect(MANDATORY_PM_TASKS[1]).toContain("regular updates");
  });

  it("includes documentation update task", () => {
    expect(MANDATORY_PM_TASKS[2]).toContain("documentation");
  });
});

describe("validateSowDocument", () => {
  it("passes validation for a complete, valid SoW", () => {
    const sow = buildValidSow();
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(result.sectionChecklist.summary).toBe(true);
    expect(result.sectionChecklist.proposedSolution).toBe(true);
    expect(result.sectionChecklist.prerequisites).toBe(true);
    expect(result.sectionChecklist.projectManagement).toBe(true);
    expect(result.sectionChecklist.phases).toBe(true);
    expect(result.sectionChecklist.caveatsRisks).toBe(true);
    expect(result.sectionChecklist.completionCriteria).toBe(true);
    expect(result.sectionChecklist.laborHours).toBe(true);
  });

  it("fails when summary is empty", () => {
    const sow = buildValidSow({ summary: "" });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    expect(result.sectionChecklist.summary).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ section: "summary", severity: "error" })
    );
  });

  it("fails when proposed solution overview is empty", () => {
    const sow = buildValidSow({ proposedSolution: { overview: "" } });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    expect(result.sectionChecklist.proposedSolution).toBe(false);
  });

  it("fails when prerequisites are empty", () => {
    const sow = buildValidSow({ prerequisites: [] });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    expect(result.sectionChecklist.prerequisites).toBe(false);
  });

  it("fails when mandatory PM tasks are missing", () => {
    const sow = buildValidSow({
      projectManagement: {
        pmTasks: ["Some random task", "Another task", "Third task"],
      },
    });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    const pmErrors = result.issues.filter(
      (i) => i.section === "projectManagement" && i.severity === "error"
    );
    expect(pmErrors.length).toBeGreaterThan(0);
  });

  it("passes when all 3 mandatory PM tasks are present", () => {
    const sow = buildValidSow();
    const result = validateSowDocument(sow);

    const pmErrors = result.issues.filter(
      (i) => i.section === "projectManagement" && i.severity === "error"
    );
    expect(pmErrors).toHaveLength(0);
  });

  it("fails when phases are empty", () => {
    const sow = buildValidSow({ phases: [] });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    expect(result.sectionChecklist.phases).toBe(false);
  });

  it("warns when phase is missing tasks or deliverables", () => {
    const sow = buildValidSow({
      phases: [{
        number: 1,
        title: "Setup",
        objective: "Setup everything",
        tasks: [],
        deliverables: [],
      }],
    });
    const result = validateSowDocument(sow);

    const phaseWarnings = result.issues.filter(
      (i) => i.section === "phases" && i.severity === "warning"
    );
    expect(phaseWarnings.length).toBeGreaterThanOrEqual(2);
  });

  it("fails when completion criteria are empty", () => {
    const sow = buildValidSow({ completionCriteria: [] });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    expect(result.sectionChecklist.completionCriteria).toBe(false);
  });

  it("fails when labor hours are empty", () => {
    const sow = buildValidSow({
      laborHours: { format: "v2.1", rows: [], notes: [] },
    });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    expect(result.sectionChecklist.laborHours).toBe(false);
  });

  it("detects pricing in labor hours range", () => {
    const sow = buildValidSow({
      laborHours: {
        format: "v2.1",
        rows: [
          { role: "Engineer", scope: "Config work", hoursRange: "$185 – $225" },
        ],
      },
    });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    const pricingError = result.issues.find(
      (i) => i.section === "laborHours" && i.message.includes("pricing")
    );
    expect(pricingError).toBeDefined();
  });

  it("warns when no Project Manager role in labor hours", () => {
    const sow = buildValidSow({
      laborHours: {
        format: "v2.1",
        rows: [
          { role: "Senior Engineer", scope: "All technical work", hoursRange: "20 – 30" },
        ],
        totalHoursRange: "20 – 30",
      },
    });
    const result = validateSowDocument(sow);

    const pmWarning = result.issues.find(
      (i) => i.section === "laborHours" && i.message.includes("Project Manager")
    );
    expect(pmWarning).toBeDefined();
  });

  it("warns when approval section is present (excluded by default per spec)", () => {
    const sow = buildValidSow({
      approval: {
        clientEntity: "Acme Corp",
        providerEntity: "Test MSP",
      },
    });
    const result = validateSowDocument(sow);

    const approvalWarning = result.issues.find(
      (i) => i.section === "approval" && i.severity === "warning"
    );
    expect(approvalWarning).toBeDefined();
  });

  it("fails when change control statement is missing", () => {
    const sow = buildValidSow({
      caveatsRisks: {
        exclusions: ["Cabling"],
        assumptions: ["Cat6 in place"],
        risks: [],
        changeControl: "",
      },
    });
    const result = validateSowDocument(sow);

    expect(result.valid).toBe(false);
    const ccError = result.issues.find(
      (i) => i.section === "caveatsRisks" && i.message.includes("Change control")
    );
    expect(ccError).toBeDefined();
  });
});

describe("normalizeSowJson", () => {
  it("normalizes a minimal raw object into full SowDocumentV2", () => {
    const raw = {
      title: "Test Project",
      summary: "A test summary.",
      solution: "Deploy everything.",
      prerequisites: ["Have access"],
      completionCriteria: ["Done when tested"],
    };

    const result = normalizeSowJson(raw, "Test Vendor");

    expect(result.cover.provider).toBe("Test Vendor");
    expect(result.cover.projectName).toBe("Test Project");
    expect(result.summary).toBe("A test summary.");
    expect(result.proposedSolution.overview).toBe("Deploy everything.");
    expect(result.prerequisites).toEqual(["Have access"]);
    expect(result.completionCriteria).toEqual(["Done when tested"]);
    // Mandatory PM tasks always present
    expect(result.projectManagement.pmTasks.length).toBeGreaterThanOrEqual(3);
  });

  it("injects mandatory PM tasks even when raw has none", () => {
    const result = normalizeSowJson({}, "Provider");
    expect(result.projectManagement.pmTasks.length).toBe(3);
    expect(result.projectManagement.pmTasks[0]).toContain("project plan");
    expect(result.projectManagement.pmTasks[1]).toContain("regular updates");
    expect(result.projectManagement.pmTasks[2]).toContain("documentation");
  });

  it("normalizes v2.1 labor hours with hours_range keys", () => {
    const raw = {
      labor_hours: {
        rows: [
          { role: "PM", scope: "Planning", hours_range: "4 – 8" },
        ],
        total_hours_range: "4 – 8",
      },
    };

    const result = normalizeSowJson(raw, "Provider");
    expect(result.laborHours.format).toBe("v2.1");
    expect(result.laborHours.rows).toHaveLength(1);
    const row = result.laborHours.rows[0];
    // Type guard check
    if ("hoursRange" in row) {
      expect(row.hoursRange).toBe("4 – 8");
    }
    expect(result.laborHours.totalHoursRange).toBe("4 – 8");
  });

  it("normalizes legacy workloadEstimate into v2.1 format", () => {
    const raw = {
      workloadEstimate: {
        lineItems: [
          { role: "Engineer", description: "Config work", hours: 10 },
        ],
      },
    };

    const result = normalizeSowJson(raw, "Provider");
    expect(result.laborHours.format).toBe("v2.1");
    expect(result.laborHours.rows).toHaveLength(1);
  });

  it("uses default change control text when not provided", () => {
    const result = normalizeSowJson({}, "Provider");
    expect(result.caveatsRisks.changeControl).toContain("out of scope");
  });
});
