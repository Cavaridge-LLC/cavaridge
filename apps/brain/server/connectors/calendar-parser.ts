/**
 * Calendar Parser Connector — CVG-BRAIN Integration Layer
 *
 * Extracts meeting context from calendar event data.
 * Parses iCal/ICS format and structured calendar JSON.
 */

import type {
  IBaseConnector,
  ConnectorConfig,
  ConnectorHealth,
  AuthResult,
  SyncResult,
  SyncMode,
} from "@cavaridge/connector-core";

export interface ParsedCalendarEvent {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location: string;
  organizer: { name: string; email: string };
  attendees: Array<{ name: string; email: string; status: string }>;
  isRecurring: boolean;
  conferenceUrl?: string;
}

/**
 * Parse a calendar event from structured JSON data.
 */
export function parseCalendarEvent(data: Record<string, unknown>): ParsedCalendarEvent {
  const organizer = data.organizer as Record<string, string> | undefined;
  const attendees = data.attendees as Array<Record<string, string>> | undefined;

  return {
    title: String(data.title || data.subject || data.summary || ""),
    description: String(data.description || data.body || ""),
    startTime: data.startTime ? new Date(String(data.startTime)) : new Date(),
    endTime: data.endTime ? new Date(String(data.endTime)) : new Date(),
    location: String(data.location || ""),
    organizer: {
      name: organizer?.name || "",
      email: organizer?.email || "",
    },
    attendees: (attendees || []).map((a) => ({
      name: a.name || "",
      email: a.email || "",
      status: a.status || "unknown",
    })),
    isRecurring: Boolean(data.isRecurring || data.recurrence),
    conferenceUrl: data.conferenceUrl ? String(data.conferenceUrl) : undefined,
  };
}

/**
 * Parse an ICS/iCal text string into a calendar event.
 */
export function parseIcsEvent(icsText: string): ParsedCalendarEvent {
  const getValue = (key: string): string => {
    const regex = new RegExp(`^${key}[;:](.+)$`, "mi");
    const match = icsText.match(regex);
    return match ? match[1].trim() : "";
  };

  const parseIcsDate = (val: string): Date => {
    // Format: 20260315T100000Z or TZID=...:20260315T100000
    const dateStr = val.replace(/^.*:/, "").replace(/Z$/, "");
    if (dateStr.length >= 15) {
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      const hour = dateStr.slice(9, 11);
      const min = dateStr.slice(11, 13);
      const sec = dateStr.slice(13, 15);
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
    }
    return new Date(val);
  };

  const attendeeLines = icsText.match(/^ATTENDEE[;:].+$/gmi) || [];
  const attendees = attendeeLines.map((line) => {
    const cnMatch = line.match(/CN=([^;:]+)/i);
    const emailMatch = line.match(/mailto:([^\s;]+)/i);
    const statusMatch = line.match(/PARTSTAT=([^;]+)/i);
    return {
      name: cnMatch ? cnMatch[1] : "",
      email: emailMatch ? emailMatch[1] : "",
      status: statusMatch ? statusMatch[1].toLowerCase() : "unknown",
    };
  });

  const organizerLine = getValue("ORGANIZER");
  const orgCnMatch = organizerLine.match(/CN=([^;:]+)/i);
  const orgEmailMatch = organizerLine.match(/mailto:([^\s;]+)/i);

  return {
    title: getValue("SUMMARY"),
    description: getValue("DESCRIPTION").replace(/\\n/g, "\n"),
    startTime: parseIcsDate(getValue("DTSTART")),
    endTime: parseIcsDate(getValue("DTEND")),
    location: getValue("LOCATION"),
    organizer: {
      name: orgCnMatch ? orgCnMatch[1] : "",
      email: orgEmailMatch ? orgEmailMatch[1] : "",
    },
    attendees,
    isRecurring: icsText.includes("RRULE"),
    conferenceUrl: getValue("X-GOOGLE-CONFERENCE") || undefined,
  };
}

export class CalendarParserConnector implements IBaseConnector {
  readonly id = "brain-calendar-parser";
  readonly name = "Calendar Parser";
  readonly type = "communication" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "ICS/JSON";

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
      details: { type: "calendar-parser", description: "Parses calendar event data" },
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

  parseEvent(data: Record<string, unknown>): ParsedCalendarEvent {
    return parseCalendarEvent(data);
  }

  parseIcs(icsText: string): ParsedCalendarEvent {
    return parseIcsEvent(icsText);
  }

  private emptySyncResult(mode: SyncMode, entityType: string): SyncResult {
    return {
      mode, entityType,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, recordsDeleted: 0,
      errors: [], cursor: null, durationMs: 0,
    };
  }
}
