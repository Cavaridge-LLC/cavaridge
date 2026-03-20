import { StubConnector } from "./stub-connector.js";
export class TeamsConnector extends StubConnector {
  readonly id = "brain-teams";
  readonly name = "Microsoft Teams";
  readonly type = "communication" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Graph API v1.0";
}
