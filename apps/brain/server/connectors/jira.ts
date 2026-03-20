import { StubConnector } from "./stub-connector.js";
export class JiraConnector extends StubConnector {
  readonly id = "brain-jira";
  readonly name = "Jira";
  readonly type = "psa" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Jira Cloud REST API v3";
}
