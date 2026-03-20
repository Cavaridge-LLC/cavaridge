import { StubConnector } from "./stub-connector.js";
export class SlackConnector extends StubConnector {
  readonly id = "brain-slack";
  readonly name = "Slack";
  readonly type = "communication" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Slack Web API v2";
}
