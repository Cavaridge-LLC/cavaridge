/**
 * Markdown Render Worker
 *
 * Generates Markdown files from ContentPayload.
 * Simplest renderer — just assembles sections with proper headings.
 */

import type { ProjectSpec, ContentPayload } from "@shared/models/pipeline";

export function renderMarkdown(spec: ProjectSpec, content: ContentPayload): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${spec.title}`);
  lines.push("");
  lines.push(`*Audience: ${spec.audience} | Tone: ${spec.tone}*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Sections
  for (const section of content.sections) {
    const prefix = "#".repeat(section.headingLevel + 1); // H1 sections get ## (title already took #)
    lines.push(`${prefix} ${section.title}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("*Powered by Ducky Intelligence.*");
  lines.push("");

  return lines.join("\n");
}
