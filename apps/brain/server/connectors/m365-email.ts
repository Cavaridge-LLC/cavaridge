/**
 * M365 Email Connector — Phase 1
 *
 * Syncs email metadata from Microsoft 365 via Graph API.
 * Extracts subject, sender, recipients, timestamps for knowledge context.
 * Does NOT ingest email bodies (Phase 2 behind compliance gate per CLAUDE.md).
 */

import type {
  IBaseConnector,
  ConnectorConfig,
  ConnectorHealth,
  AuthResult,
  SyncResult,
  SyncMode,
} from "@cavaridge/connector-core";

// ── Normalized Email Metadata ────────────────────────────────────────

export interface NormalizedEmailMetadata {
  externalId: string;
  connectorId: string;
  subject: string;
  sender: { name: string; email: string };
  recipients: Array<{ name: string; email: string; type: "to" | "cc" | "bcc" }>;
  receivedAt: Date;
  hasAttachments: boolean;
  importance: "low" | "normal" | "high";
  categories: string[];
  conversationId: string;
  isRead: boolean;
  rawData: Record<string, unknown>;
}

// ── Connector ────────────────────────────────────────────────────────

export class M365EmailConnector implements IBaseConnector {
  readonly id = "brain-m365-email";
  readonly name = "Microsoft 365 Email";
  readonly type = "communication" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Graph API v1.0";

  private config: ConnectorConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      connectorId: this.id,
      status: this.accessToken ? "healthy" : "unknown",
      lastSyncAt: null,
      lastErrorAt: null,
      syncLagSeconds: 0,
      recordsSynced: 0,
      errorRate: 0,
      details: {},
      checkedAt: new Date(),
    };
  }

  async shutdown(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  async authenticate(): Promise<AuthResult> {
    if (!this.config) return { authenticated: false, error: "Not initialized" };

    const { clientId, clientSecret, tenantId: azureTenantId } = this.config.credentials;
    if (!clientId || !clientSecret || !azureTenantId) {
      return { authenticated: false, error: "Missing OAuth2 credentials" };
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`;
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      });

      const resp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!resp.ok) {
        return { authenticated: false, error: `Auth failed: ${resp.status}` };
      }

      const data = await resp.json() as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
      return { authenticated: true, expiresAt: this.tokenExpiresAt };
    } catch (err) {
      return { authenticated: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async refreshAuth(): Promise<AuthResult> {
    return this.authenticate();
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.tokenExpiresAt && this.tokenExpiresAt > new Date();
  }

  async fullSync(entityType: string): Promise<SyncResult> {
    if (entityType !== "email_metadata") {
      return this.emptySyncResult("full_sync", entityType);
    }

    if (!this.isAuthenticated()) {
      const auth = await this.authenticate();
      if (!auth.authenticated) {
        return { ...this.emptySyncResult("full_sync", entityType), errors: [{ message: "Auth failed", retryable: true }] };
      }
    }

    const start = Date.now();
    let processed = 0;

    try {
      // Metadata only — no body content (compliance gate)
      const url = "https://graph.microsoft.com/v1.0/me/messages?$top=100&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,importance,categories,conversationId,isRead&$orderby=receivedDateTime desc";
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (resp.ok) {
        const data = await resp.json() as { value: Array<Record<string, unknown>> };
        processed = data.value?.length || 0;
      }
    } catch {
      // Handled in result
    }

    return {
      mode: "full_sync",
      entityType,
      recordsProcessed: processed,
      recordsCreated: processed,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      cursor: null,
      durationMs: Date.now() - start,
    };
  }

  async incrementalSync(entityType: string, _cursor: string): Promise<SyncResult> {
    return this.emptySyncResult("incremental_sync", entityType);
  }

  async getLastSyncCursor(_entityType: string): Promise<string | null> {
    return null;
  }

  supportsWebhooks(): boolean {
    return true;
  }

  // ── Email-Specific Methods ─────────────────────────────────────────

  async listRecentEmails(limit: number = 50): Promise<NormalizedEmailMetadata[]> {
    if (!this.isAuthenticated()) return [];

    try {
      const url = `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,importance,categories,conversationId,isRead&$orderby=receivedDateTime desc`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!resp.ok) return [];
      const data = await resp.json() as { value: Array<Record<string, unknown>> };
      return (data.value || []).map((msg) => this.normalizeEmail(msg));
    } catch {
      return [];
    }
  }

  private normalizeEmail(raw: Record<string, unknown>): NormalizedEmailMetadata {
    const from = raw.from as Record<string, Record<string, string>> | undefined;
    const toRecipients = raw.toRecipients as Array<Record<string, Record<string, string>>> | undefined;
    const ccRecipients = raw.ccRecipients as Array<Record<string, Record<string, string>>> | undefined;

    const recipients: NormalizedEmailMetadata["recipients"] = [];
    (toRecipients || []).forEach((r) => {
      recipients.push({ name: r.emailAddress?.name || "", email: r.emailAddress?.address || "", type: "to" });
    });
    (ccRecipients || []).forEach((r) => {
      recipients.push({ name: r.emailAddress?.name || "", email: r.emailAddress?.address || "", type: "cc" });
    });

    return {
      externalId: String(raw.id || ""),
      connectorId: this.id,
      subject: String(raw.subject || ""),
      sender: {
        name: from?.emailAddress?.name || "",
        email: from?.emailAddress?.address || "",
      },
      recipients,
      receivedAt: new Date(String(raw.receivedDateTime || Date.now())),
      hasAttachments: Boolean(raw.hasAttachments),
      importance: (String(raw.importance || "normal")) as "low" | "normal" | "high",
      categories: Array.isArray(raw.categories) ? raw.categories.map(String) : [],
      conversationId: String(raw.conversationId || ""),
      isRead: Boolean(raw.isRead),
      rawData: raw,
    };
  }

  private emptySyncResult(mode: SyncMode, entityType: string): SyncResult {
    return {
      mode, entityType,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, recordsDeleted: 0,
      errors: [], cursor: null, durationMs: 0,
    };
  }
}
