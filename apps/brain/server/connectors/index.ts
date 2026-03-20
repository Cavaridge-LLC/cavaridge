/**
 * CVG-BRAIN Connector Stubs
 *
 * 11 integration connectors per Brain architecture.
 * Phase 1: M365 Calendar + Email (implemented)
 * Phase 2+: Remaining stubs ready for implementation.
 *
 * All connectors implement IBaseConnector from @cavaridge/connector-core.
 */

export { M365CalendarConnector } from "./m365-calendar.js";
export { M365EmailConnector } from "./m365-email.js";
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
  { id: "m365-calendar", name: "Microsoft 365 Calendar", phase: 1, status: "implemented" },
  { id: "m365-email", name: "Microsoft 365 Email", phase: 1, status: "implemented" },
  { id: "teams", name: "Microsoft Teams", phase: 2, status: "stub" },
  { id: "slack", name: "Slack", phase: 2, status: "stub" },
  { id: "google-calendar", name: "Google Calendar", phase: 2, status: "stub" },
  { id: "google-meet", name: "Google Meet", phase: 2, status: "stub" },
  { id: "zoom", name: "Zoom", phase: 2, status: "stub" },
  { id: "notion", name: "Notion", phase: 3, status: "stub" },
  { id: "confluence", name: "Confluence", phase: 3, status: "stub" },
  { id: "jira", name: "Jira", phase: 3, status: "stub" },
  { id: "linear", name: "Linear", phase: 3, status: "stub" },
] as const;
