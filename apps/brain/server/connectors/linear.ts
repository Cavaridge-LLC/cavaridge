import { StubConnector } from "./stub-connector.js";
export class LinearConnector extends StubConnector {
  readonly id = "brain-linear";
  readonly name = "Linear";
  readonly type = "psa" as const;
  readonly version = "0.1.0";
  readonly platformVersion = "Linear GraphQL API 2024-01";
}
