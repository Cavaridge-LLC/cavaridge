/**
 * Forge Pipeline Orchestrator
 *
 * Orchestrates the 5-stage agent pipeline:
 * Brief → Intake → Estimate → [Approve] → Research → Structure → Generate → Validate → [Render]
 *
 * Handles auto-revision loops and progress reporting.
 */

import { runIntakeAgent } from "./intake";
import { runEstimateAgent } from "./estimate";
import { runResearchAgent } from "./research";
import { runStructureAgent } from "./structure";
import { runGenerateAgent } from "./generate";
import { runValidateAgent } from "./validate";
import { runRevisionAgent } from "./revise";
import { renderDocx } from "../workers/docx-render";
import { renderMarkdown } from "../workers/markdown-render";
import { renderPdf } from "../workers/pdf-render";
import { MAX_AUTO_REVISIONS, QC_THRESHOLD } from "../llm.config";
import { db } from "../db";
import { forgeProjects, forgeAgentRuns } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { ForgeBrief, PipelineState, DuckyState } from "@shared/models/pipeline";

export type ProgressCallback = (stage: PipelineState["stage"], duckyState: DuckyState, progress: number, message: string) => void;

/**
 * Run the full Forge pipeline from intake through rendering.
 * Called after user approves the cost estimate.
 */
export async function runForgePipeline(
  projectId: string,
  brief: ForgeBrief,
  tenantId: string,
  userId: string,
  onProgress?: ProgressCallback,
): Promise<PipelineState> {
  const state: PipelineState = {
    projectId,
    stage: "intake",
    duckyState: "thinking",
    revisionCount: 0,
  };

  const emit = (stage: PipelineState["stage"], duckyState: DuckyState, progress: number, message: string) => {
    state.stage = stage;
    state.duckyState = duckyState;
    onProgress?.(stage, duckyState, progress, message);
  };

  try {
    // Update project status
    await db.update(forgeProjects).set({ status: "running", updatedAt: new Date() }).where(eq(forgeProjects.id, projectId));

    // ── Stage 1: INTAKE ──
    emit("intake", "thinking", 0.05, "Analyzing your brief...");
    const intakeStart = Date.now();
    state.projectSpec = await runIntakeAgent(brief, tenantId, userId);
    await logAgentRun(projectId, "intake", "IntakeAgent", intakeStart);

    // ── Stage 3: RESEARCH ──
    emit("research", "thinking", 0.2, "Researching your topic...");
    const researchStart = Date.now();
    state.researchPayload = await runResearchAgent(state.projectSpec, tenantId, userId);
    await logAgentRun(projectId, "research", "ResearchAgent", researchStart);

    // ── Stage 4: STRUCTURE ──
    emit("structure", "planning", 0.4, "Planning document structure...");
    const structureStart = Date.now();
    state.structurePlan = await runStructureAgent(state.projectSpec, state.researchPayload, tenantId, userId);
    await logAgentRun(projectId, "structure", "StructureAgent", structureStart);

    // ── Stage 5: GENERATE ──
    emit("generate", "building", 0.55, "Generating content...");
    const generateStart = Date.now();
    state.contentPayload = await runGenerateAgent(state.projectSpec, state.researchPayload, state.structurePlan, tenantId, userId);
    await logAgentRun(projectId, "generate", "GenerateAgent", generateStart);

    // ── Stage 6: VALIDATE (with auto-revision loop) ──
    emit("validate", "reviewing", 0.8, "Ducky is reviewing quality...");
    let currentContent = state.contentPayload;

    for (let attempt = 0; attempt <= MAX_AUTO_REVISIONS; attempt++) {
      const validateStart = Date.now();
      state.qualityReport = await runValidateAgent(state.projectSpec, currentContent, tenantId, userId);
      await logAgentRun(projectId, "validate", "ValidateAgent", validateStart);

      if (state.qualityReport.passesThreshold || attempt === MAX_AUTO_REVISIONS) {
        break;
      }

      // Auto-revise (no credit charge)
      emit("validate", "determined", 0.85, `Improving quality (attempt ${attempt + 1})...`);
      const reviseStart = Date.now();
      currentContent = await runRevisionAgent(currentContent, state.qualityReport, tenantId, userId);
      await logAgentRun(projectId, "revise", "RevisionAgent", reviseStart);
      state.revisionCount++;
    }

    state.contentPayload = currentContent;

    // Update quality score
    await db.update(forgeProjects).set({
      qualityScore: state.qualityReport.overallScore,
      updatedAt: new Date(),
    }).where(eq(forgeProjects.id, projectId));

    // ── Stage 7: RENDER ──
    emit("render", "building", 0.9, "Rendering your document...");
    const renderStart = Date.now();

    let outputBuffer: Buffer;
    let outputFilename: string;

    switch (brief.outputFormat) {
      case "docx":
        outputBuffer = await renderDocx(state.projectSpec, currentContent);
        outputFilename = `${state.projectSpec.title.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
        break;
      case "pdf":
        outputBuffer = await renderPdf(state.projectSpec, currentContent);
        outputFilename = `${state.projectSpec.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
        break;
      case "markdown":
        outputBuffer = Buffer.from(renderMarkdown(state.projectSpec, currentContent));
        outputFilename = `${state.projectSpec.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
        break;
      default:
        throw new Error(`Unsupported output format: ${brief.outputFormat}`);
    }

    await logAgentRun(projectId, "render", "RenderWorker", renderStart);

    // Store the output (in production, upload to Supabase Storage)
    // For MVP, store as base64 in metadata
    const outputBase64 = outputBuffer.toString("base64");

    await db.update(forgeProjects).set({
      status: "completed",
      outputUrl: `data:${getContentType(brief.outputFormat)};base64,${outputBase64}`,
      actualCredits: state.costEstimate?.totalCredits ?? 0,
      completedAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        filename: outputFilename,
        format: brief.outputFormat,
        qualityScore: state.qualityReport?.overallScore,
        totalWordCount: currentContent.metadata.totalWordCount,
        revisionCount: state.revisionCount,
      },
    }).where(eq(forgeProjects.id, projectId));

    state.stage = "complete";

    if (state.qualityReport && state.qualityReport.overallScore >= QC_THRESHOLD) {
      emit("complete", "celebrating", 1.0, "Your document is ready!");
    } else {
      emit("complete", "concerned", 1.0, "Document ready — some quality notes below.");
    }

    return state;

  } catch (error) {
    state.stage = "failed";
    state.duckyState = "apologetic";
    state.error = error instanceof Error ? error.message : "Unknown error";

    await db.update(forgeProjects).set({
      status: "failed",
      metadata: { error: state.error },
      updatedAt: new Date(),
    }).where(eq(forgeProjects.id, projectId));

    emit("failed", "apologetic", 0, `Something went wrong: ${state.error}`);

    return state;
  }
}

async function logAgentRun(
  projectId: string,
  runType: string,
  agentName: string,
  startedAt: number,
) {
  await db.insert(forgeAgentRuns).values({
    projectId,
    runType: runType as any,
    agentName,
    status: "completed",
    startedAt: new Date(startedAt),
    completedAt: new Date(),
  });
}

function getContentType(format: string): string {
  switch (format) {
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pdf": return "application/pdf";
    case "markdown": return "text/markdown";
    default: return "application/octet-stream";
  }
}
