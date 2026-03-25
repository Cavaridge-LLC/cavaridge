/**
 * Caelum DOCX Generation Tests
 * Tests that generateDocxV2 produces a valid Buffer from SowDocumentV2.
 */

import { describe, it, expect } from "vitest";
import { generateDocxV2 } from "../../../sowDocxExportV2";
import type { SowDocumentV2 } from "../../../../shared/models/sow";

function buildSow(): SowDocumentV2 {
  return {
    cover: {
      client: "Test Client",
      projectName: "DOCX Generation Test",
      provider: "Test Provider",
      billingModel: "Fixed-Fee",
      documentDate: "March 24, 2026",
      version: "1.0",
      classification: "Confidential",
    },
    summary: "Test summary for DOCX generation.",
    proposedSolution: {
      overview: "Deploy a test solution.",
      subsections: [
        { number: "2.1", title: "Phase One", narrative: "Do the first thing." },
      ],
      keyDeliverables: ["Delivered item 1"],
    },
    prerequisites: ["Have access to the building"],
    projectManagement: {
      siteAddress: "456 Test Ave",
      contacts: [{ role: "POC", name: "John Doe" }],
      pmTasks: [
        "Provide project plan with milestones (if applicable) and estimated time of completion.",
        "Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting.",
        "Remove old documentation references and update documentation to reflect new configurations.",
      ],
    },
    phases: [
      {
        number: 1,
        title: "Setup",
        objective: "Set everything up.",
        tasks: ["Install equipment"],
        deliverables: ["Working system"],
      },
    ],
    caveatsRisks: {
      exclusions: ["Not included: painting walls"],
      assumptions: ["Walls exist"],
      risks: [
        { risk: "Delay", impact: "Schedule slip", mitigation: "Plan ahead" },
      ],
      changeControl: "Changes require separate approval.",
    },
    completionCriteria: ["System operational", "Client sign-off received"],
    laborHours: {
      format: "v2.1",
      rows: [
        { role: "Project Manager", scope: "Oversight", hoursRange: "2 – 4" },
        { role: "Engineer", scope: "Technical work", hoursRange: "8 – 12" },
      ],
      totalHoursRange: "10 – 16",
      notes: ["Estimate includes travel."],
    },
  };
}

describe("generateDocxV2", () => {
  it("produces a non-empty Buffer", async () => {
    const sow = buildSow();
    const buffer = await generateDocxV2(sow);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("produces a DOCX file (starts with PK zip signature)", async () => {
    const sow = buildSow();
    const buffer = await generateDocxV2(sow);

    // DOCX files are ZIP archives starting with PK signature (0x504B)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("handles SoW with optional approval section", async () => {
    const sow = buildSow();
    sow.approval = {
      clientEntity: "Test Client",
      providerEntity: "Test Provider",
    };

    const buffer = await generateDocxV2(sow);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles legacy single_role labor format", async () => {
    const sow = buildSow();
    sow.laborHours = {
      format: "single_role",
      rows: [
        { phase: "Setup", hours: 10, role: "Engineer", rate: 185 },
      ],
    };

    const buffer = await generateDocxV2(sow);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles legacy multi_role labor format", async () => {
    const sow = buildSow();
    sow.laborHours = {
      format: "multi_role",
      rows: [
        { phase: "Setup", standardHours: 8, seniorHours: 4, totalHours: 12, estCost: 2220 },
      ],
    };

    const buffer = await generateDocxV2(sow);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
