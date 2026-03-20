import { StubConnector } from "./stub-connector.js";
export class GoogleMeetConnector extends StubConnector {
  readonly id = "brain-google-meet";
  readonly name = "Google Meet";
  readonly type = "communication" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Google Meet REST API v2";
}
