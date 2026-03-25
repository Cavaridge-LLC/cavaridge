/**
 * Notes Parser Connector — CVG-BRAIN Integration Layer
 *
 * Imports markdown/text notes into the knowledge base.
 * Extracts headings, lists, code blocks, links, and metadata.
 */

import type {
  IBaseConnector,
  ConnectorConfig,
  ConnectorHealth,
  AuthResult,
  SyncResult,
  SyncMode,
} from "@cavaridge/connector-core";

export interface ParsedNote {
  title: string;
  content: string;
  format: "markdown" | "plain" | "html";
  headings: string[];
  links: Array<{ text: string; url: string }>;
  codeBlocks: Array<{ language: string; code: string }>;
  listItems: string[];
  wordCount: number;
  metadata: Record<string, string>;
}

/**
 * Parse a markdown note into structured data.
 */
export function parseMarkdownNote(text: string): ParsedNote {
  const lines = text.split("\n");

  // Extract title from first H1 or first line
  let title = "";
  const h1Match = text.match(/^#\s+(.+)$/m);
  if (h1Match) {
    title = h1Match[1].trim();
  } else if (lines.length > 0) {
    title = lines[0].trim().slice(0, 100);
  }

  // Extract all headings
  const headings: string[] = [];
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(text)) !== null) {
    headings.push(match[1].trim());
  }

  // Extract links
  const links: Array<{ text: string; url: string }> = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = linkRegex.exec(text)) !== null) {
    links.push({ text: match[1], url: match[2] });
  }

  // Extract code blocks
  const codeBlocks: Array<{ language: string; code: string }> = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({ language: match[1] || "text", code: match[2].trim() });
  }

  // Extract list items
  const listItems: string[] = [];
  const listRegex = /^[\s]*[-*+]\s+(.+)$/gm;
  while ((match = listRegex.exec(text)) !== null) {
    listItems.push(match[1].trim());
  }
  const numberedListRegex = /^[\s]*\d+\.\s+(.+)$/gm;
  while ((match = numberedListRegex.exec(text)) !== null) {
    listItems.push(match[1].trim());
  }

  // Extract YAML frontmatter metadata
  const metadata: Record<string, string> = {};
  const frontmatterMatch = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fmLines = frontmatterMatch[1].split("\n");
    for (const fmLine of fmLines) {
      const kvMatch = fmLine.match(/^(\w[\w\s]*?):\s*(.+)$/);
      if (kvMatch) {
        metadata[kvMatch[1].trim()] = kvMatch[2].trim();
      }
    }
  }

  // Word count
  const wordCount = text.replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean).length;

  return {
    title,
    content: text,
    format: "markdown",
    headings,
    links,
    codeBlocks,
    listItems,
    wordCount,
    metadata,
  };
}

/**
 * Parse a plain text note.
 */
export function parsePlainTextNote(text: string): ParsedNote {
  const lines = text.split("\n").filter(Boolean);
  const title = lines[0]?.slice(0, 100) || "Untitled Note";

  return {
    title,
    content: text,
    format: "plain",
    headings: [],
    links: [],
    codeBlocks: [],
    listItems: lines.slice(1).filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*")),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    metadata: {},
  };
}

export class NotesParserConnector implements IBaseConnector {
  readonly id = "brain-notes-parser";
  readonly name = "Notes Parser";
  readonly type = "documentation" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Markdown/Text";

  private config: ConnectorConfig | null = null;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      connectorId: this.id,
      status: "healthy",
      lastSyncAt: null,
      lastErrorAt: null,
      syncLagSeconds: 0,
      recordsSynced: 0,
      errorRate: 0,
      details: { type: "notes-parser", description: "Imports markdown/text notes" },
      checkedAt: new Date(),
    };
  }

  async shutdown(): Promise<void> {}

  async authenticate(): Promise<AuthResult> {
    return { authenticated: true };
  }

  async refreshAuth(): Promise<AuthResult> {
    return { authenticated: true };
  }

  isAuthenticated(): boolean {
    return true;
  }

  async fullSync(_entityType: string): Promise<SyncResult> {
    return this.emptySyncResult("full_sync", _entityType);
  }

  async incrementalSync(entityType: string, _cursor: string): Promise<SyncResult> {
    return this.emptySyncResult("incremental_sync", entityType);
  }

  async getLastSyncCursor(_entityType: string): Promise<string | null> {
    return null;
  }

  supportsWebhooks(): boolean {
    return false;
  }

  parseMarkdown(text: string): ParsedNote {
    return parseMarkdownNote(text);
  }

  parsePlainText(text: string): ParsedNote {
    return parsePlainTextNote(text);
  }

  private emptySyncResult(mode: SyncMode, entityType: string): SyncResult {
    return {
      mode, entityType,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, recordsDeleted: 0,
      errors: [], cursor: null, durationMs: 0,
    };
  }
}
