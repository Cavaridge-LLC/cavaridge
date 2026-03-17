/**
 * @cavaridge/agent-core — Agent error classes
 */

export class AgentError extends Error {
  public readonly agentId: string;
  public readonly code: string;

  constructor(message: string, agentId: string, code: string) {
    super(message);
    this.name = "AgentError";
    this.agentId = agentId;
    this.code = code;
  }
}

export class AgentValidationError extends AgentError {
  public readonly validationErrors: string[];

  constructor(agentId: string, errors: string[]) {
    super(`Validation failed: ${errors.join(", ")}`, agentId, "VALIDATION_ERROR");
    this.name = "AgentValidationError";
    this.validationErrors = errors;
  }
}

export class AgentSecurityError extends AgentError {
  public readonly threat: string;

  constructor(agentId: string, threat: string) {
    super(`Security violation: ${threat}`, agentId, "SECURITY_ERROR");
    this.name = "AgentSecurityError";
    this.threat = threat;
  }
}

export class AgentLlmError extends AgentError {
  public readonly taskType: string;

  constructor(agentId: string, taskType: string, cause?: Error) {
    super(
      `LLM call failed for task "${taskType}": ${cause?.message ?? "unknown error"}`,
      agentId,
      "LLM_ERROR",
    );
    this.name = "AgentLlmError";
    this.taskType = taskType;
    if (cause) this.cause = cause;
  }
}
