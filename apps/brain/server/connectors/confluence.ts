import { StubConnector } from "./stub-connector.js";
export class ConfluenceConnector extends StubConnector {
  readonly id = "brain-confluence";
  readonly name = "Confluence";
  readonly type = "documentation" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Confluence Cloud REST API v2";
}
