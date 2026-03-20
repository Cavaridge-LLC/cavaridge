import { StubConnector } from "./stub-connector.js";
export class NotionConnector extends StubConnector {
  readonly id = "brain-notion";
  readonly name = "Notion";
  readonly type = "documentation" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Notion API 2022-06-28";
}
