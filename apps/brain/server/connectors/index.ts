/**
 * CVG-BRAIN Connector Registry
 *
 * 14 integration connectors per Brain architecture.
 * Phase 1: M365 Calendar + Email + Email Parser + Calendar Parser + Notes Parser (implemented)
 * Phase 2+: Remaining stubs ready for implementation.
 *
 * All connectors implement IBaseConnector from @cavaridge/connector-core.
 */

// Phase 1 — Implemented
export { M365CalendarConnector } from "./m365-calendar.js";
export { M365EmailConnector } from "./m365-email.js";
export { EmailParserConnector } from "./email-parser.js";
export { CalendarParserConnector } from "./calendar-parser.js";
export { NotesParserConnector } from "./notes-parser.js";

// Phase 2+ — Stubs
export { TeamsConnector } from "./teams.js";
export { SlackConnector } from "./slack.js";
export { GoogleCalendarConnector } from "./google-calendar.js";
export { GoogleMeetConnector } from "./google-meet.js";
export { ZoomConnector } from "./zoom.js";
export { NotionConnector } from "./notion.js";
export { ConfluenceConnector } from "./confluence.js";
export { JiraConnector } from "./jira.js";
export { LinearConnector } from "./linear.js";

export const BRAIN_CONNECTORS = [
  // Phase 1 — Implemented
  { id: "m365-calendar", name: "Microsoft 365 Calendar", phase: 1, status: "implemented" },
  { id: "m365-email", name: "Microsoft 365 Email", phase: 1, status: "implemented" },
  { id: "email-parser", name: "Email Parser", phase: 1, status: "implemented" },
  { id: "calendar-parser", name: "Calendar Parser", phase: 1, status: "implemented" },
  { id: "notes-parser", name: "Notes Parser", phase: 1, status: "implemented" },
  // Phase 2 — Stubs
  { id: "teams", name: "Microsoft Teams", phase: 2, status: "stub" },
  { id: "slack", name: "Slack", phase: 2, status: "stub" },
  { id: "google-calendar", name: "Google Calendar", phase: 2, status: "stub" },
  { id: "google-meet", name: "Google Meet", phase: 2, status: "stub" },
  { id: "zoom", name: "Zoom", phase: 2, status: "stub" },
  // Phase 3 — Stubs
  { id: "notion", name: "Notion", phase: 3, status: "stub" },
  { id: "confluence", name: "Confluence", phase: 3, status: "stub" },
  { id: "jira", name: "Jira", phase: 3, status: "stub" },
  { id: "linear", name: "Linear", phase: 3, status: "stub" },
] as const;
