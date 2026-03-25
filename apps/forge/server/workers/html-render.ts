/**
 * HTML Render Worker
 *
 * Generates static HTML from ContentPayload.
 * Produces a self-contained HTML document with inline CSS.
 */

import { marked } from "marked";
import type { ProjectSpec, ContentPayload } from "@shared/models/pipeline";

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.7;
    color: #333333;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    background: #ffffff;
  }
  h1 { color: #2E5090; font-size: 2rem; margin: 1.5rem 0 1rem; border-bottom: 2px solid #2E5090; padding-bottom: 0.5rem; }
  h2 { color: #1A1A1A; font-size: 1.5rem; margin: 1.25rem 0 0.75rem; }
  h3 { color: #1A1A1A; font-size: 1.25rem; margin: 1rem 0 0.5rem; }
  p { margin: 0 0 1rem; }
  ul, ol { margin: 0 0 1rem 1.5rem; }
  li { margin: 0 0 0.25rem; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  blockquote { border-left: 4px solid #2E5090; padding: 0.5rem 1rem; margin: 1rem 0; background: #F2F6FA; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th { background: #2E5090; color: #ffffff; padding: 0.5rem; text-align: left; }
  td { padding: 0.5rem; border: 1px solid #BFBFBF; }
  tr:nth-child(even) td { background: #F2F6FA; }
  .header { text-align: center; margin-bottom: 2rem; }
  .header .title { color: #2E5090; font-size: 2.5rem; margin-bottom: 0.5rem; border: none; }
  .header .meta { color: #666666; font-style: italic; font-size: 0.9rem; }
  .footer { text-align: center; margin-top: 3rem; padding-top: 1rem; border-top: 2px solid #2E5090; color: #666666; font-style: italic; font-size: 0.85rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1a2e; color: #e0e0e0; }
    h1 { color: #6b8fd4; border-color: #6b8fd4; }
    h2, h3 { color: #d0d0d0; }
    blockquote { background: #2a2a3e; border-color: #6b8fd4; }
    th { background: #3a3a5e; }
    td { border-color: #444; }
    tr:nth-child(even) td { background: #2a2a3e; }
    .footer { border-color: #6b8fd4; }
  }
`;

export function renderHtml(spec: ProjectSpec, content: ContentPayload): string {
  const sectionHtml = content.sections
    .map((section) => {
      const headingTag = `h${Math.min(section.headingLevel + 1, 3)}`;
      const bodyHtml = marked.parse(section.content);
      return `<${headingTag}>${escapeHtml(section.title)}</${headingTag}>\n${bodyHtml}`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(spec.title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="header">
    <h1 class="title">${escapeHtml(spec.title)}</h1>
    <p class="meta">Audience: ${escapeHtml(spec.audience)} | Tone: ${escapeHtml(spec.tone)}</p>
  </div>

  ${sectionHtml}

  <div class="footer">
    <p>Powered by Ducky Intelligence.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
