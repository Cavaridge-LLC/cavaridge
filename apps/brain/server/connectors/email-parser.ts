/**
 * Email Parser Connector — CVG-BRAIN Integration Layer
 *
 * Parses forwarded emails into knowledge entries.
 * Extracts subject, sender, recipients, key content, dates,
 * and action items from email text.
 */

import type {
  IBaseConnector,
  ConnectorConfig,
  ConnectorHealth,
  AuthResult,
  SyncResult,
  SyncMode,
} from "@cavaridge/connector-core";

export interface ParsedEmail {
  subject: string;
  from: { name: string; email: string };
  to: Array<{ name: string; email: string }>;
  cc: Array<{ name: string; email: string }>;
  date: Date;
  body: string;
  threadId?: string;
  hasAttachments: boolean;
}

/**
 * Parse raw forwarded email text into structured data.
 * Handles common "---------- Forwarded message ----------" patterns
 * and standard email headers.
 */
export function parseForwardedEmail(rawText: string): ParsedEmail {
  const lines = rawText.split("\n");

  let subject = "";
  let fromName = "";
  let fromEmail = "";
  const toList: Array<{ name: string; email: string }> = [];
  const ccList: Array<{ name: string; email: string }> = [];
  let date = new Date();
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Subject
    const subjectMatch = line.match(/^Subject:\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      continue;
    }

    // From
    const fromMatch = line.match(/^From:\s*(.+)/i);
    if (fromMatch) {
      const parsed = parseEmailAddress(fromMatch[1]);
      fromName = parsed.name;
      fromEmail = parsed.email;
      continue;
    }

    // To
    const toMatch = line.match(/^To:\s*(.+)/i);
    if (toMatch) {
      const addresses = toMatch[1].split(",").map((a) => parseEmailAddress(a.trim()));
      toList.push(...addresses);
      continue;
    }

    // CC
    const ccMatch = line.match(/^Cc:\s*(.+)/i);
    if (ccMatch) {
      const addresses = ccMatch[1].split(",").map((a) => parseEmailAddress(a.trim()));
      ccList.push(...addresses);
      continue;
    }

    // Date
    const dateMatch = line.match(/^Date:\s*(.+)/i);
    if (dateMatch) {
      try {
        date = new Date(dateMatch[1].trim());
      } catch {
        // keep default
      }
      continue;
    }

    // Body starts after a blank line following headers
    if (line === "" && (subject || fromEmail)) {
      bodyStart = i + 1;
      break;
    }
  }

  const body = lines.slice(bodyStart).join("\n").trim();

  return {
    subject,
    from: { name: fromName, email: fromEmail },
    to: toList,
    cc: ccList,
    date,
    body,
    hasAttachments: rawText.toLowerCase().includes("attachment") || rawText.includes("[attachment]"),
  };
}

function parseEmailAddress(raw: string): { name: string; email: string } {
  // "John Doe <john@example.com>" or "john@example.com"
  const match = raw.match(/^(.*?)\s*<([^>]+)>/);
  if (match) {
    return { name: match[1].trim().replace(/^["']|["']$/g, ""), email: match[2].trim() };
  }
  return { name: "", email: raw.trim() };
}

export class EmailParserConnector implements IBaseConnector {
  readonly id = "brain-email-parser";
  readonly name = "Email Parser";
  readonly type = "communication" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "N/A";

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
      details: { type: "email-parser", description: "Parses forwarded email text" },
      checkedAt: new Date(),
    };
  }

  async shutdown(): Promise<void> {}

  async authenticate(): Promise<AuthResult> {
    // Email parser does not require auth — it processes submitted text
    return { authenticated: true };
  }

  async refreshAuth(): Promise<AuthResult> {
    return { authenticated: true };
  }

  isAuthenticated(): boolean {
    return true;
  }

  async fullSync(_entityType: string): Promise<SyncResult> {
    // Email parser is on-demand, not sync-based
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

  /**
   * Parse a forwarded email into structured data for knowledge extraction.
   */
  parse(rawEmailText: string): ParsedEmail {
    return parseForwardedEmail(rawEmailText);
  }

  private emptySyncResult(mode: SyncMode, entityType: string): SyncResult {
    return {
      mode, entityType,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, recordsDeleted: 0,
      errors: [], cursor: null, durationMs: 0,
    };
  }
}
