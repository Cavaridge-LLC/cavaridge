import { StubConnector } from "./stub-connector.js";
export class GoogleCalendarConnector extends StubConnector {
  readonly id = "brain-google-calendar";
  readonly name = "Google Calendar";
  readonly type = "communication" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Google Calendar API v3";
}
