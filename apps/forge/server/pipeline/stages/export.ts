/**
 * Stage 5: Export
 *
 * Renders final content into the requested output format.
 * Supports DOCX, PDF, and static HTML for Phase 1.
 */

import { db } from "../../db";
import { forgeContent } from "@shared/schema";
import { eq } from "drizzle-orm";
import { renderDocx } from "../../workers/docx-render";
import { renderPdf } from "../../workers/pdf-render";
import { renderHtml } from "../../workers/html-render";
import { renderMarkdown } from "../../workers/markdown-render";
import { QC_THRESHOLD } from "../../llm.config";
import type {
  PipelineState,
  ForgeBrief,
  ContentPayload,
  BrandVoiceConfig,
} from "@shared/models/pipeline";
import type { StageHandler } from "../engine";

function getContentType(format: string): string {
  switch (format) {
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pdf":
      return "application/pdf";
    case "html":
      return "text/html";
    default:
      return "application/octet-stream";
  }
}

export const exportHandler: StageHandler = async (
  state: PipelineState,
  brief: ForgeBrief,
  _tenantId: string,
  _userId: string,
  _brandVoice?: BrandVoiceConfig,
): Promise<PipelineState> => {
  const spec = state.projectSpec;
  if (!spec) {
    throw new Error("Pipeline must have a project spec before export");
  }

  // Use polished payload if available, fall back to content payload
  const finalContent: ContentPayload = state.polishedPayload
    ? {
        sections: state.polishedPayload.sections,
        metadata: {
          totalWordCount: state.polishedPayload.metadata.totalWordCount,
          generationModel: state.polishedPayload.metadata.generationModel,
        },
      }
    : state.contentPayload!;

  if (!finalContent) {
    throw new Error("No content available for export");
  }

  let outputBuffer: Buffer;
  let outputFilename: string;
  const safeName = spec.title.replace(/[^a-zA-Z0-9]/g, "_");

  switch (brief.outputFormat) {
    case "docx":
      outputBuffer = await renderDocx(spec, finalContent);
      outputFilename = `${safeName}.docx`;
      break;
    case "pdf":
      outputBuffer = await renderPdf(spec, finalContent);
      outputFilename = `${safeName}.pdf`;
      break;
    case "html":
      outputBuffer = Buffer.from(renderHtml(spec, finalContent));
      outputFilename = `${safeName}.html`;
      break;
    default:
      throw new Error(`Unsupported output format: ${brief.outputFormat}`);
  }

  // Store output as base64 in metadata (MVP — Phase 2 uses Supabase Storage)
  const outputBase64 = outputBuffer.toString("base64");
  const contentType = getContentType(brief.outputFormat);
  const outputUrl = `data:${contentType};base64,${outputBase64}`;

  await db
    .update(forgeContent)
    .set({
      outputUrl,
      qualityScore: state.qualityReport?.overallScore ?? null,
      actualCredits: 0,
      metadata: {
        filename: outputFilename,
        format: brief.outputFormat,
        qualityScore: state.qualityReport?.overallScore,
        totalWordCount: finalContent.metadata.totalWordCount,
        revisionCount: state.revisionCount,
      },
      updatedAt: new Date(),
    })
    .where(eq(forgeContent.id, state.contentId));

  return {
    ...state,
    exportResult: {
      filename: outputFilename,
      contentType,
      format: brief.outputFormat,
    },
  };
};
