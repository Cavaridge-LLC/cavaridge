import { StubConnector } from "./stub-connector.js";
export class ZoomConnector extends StubConnector {
  readonly id = "brain-zoom";
  readonly name = "Zoom";
  readonly type = "communication" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Zoom API v2";
}
