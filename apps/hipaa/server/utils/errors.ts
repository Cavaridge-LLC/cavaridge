export class AppError extends Error {
  statusCode: number;
  type: string;

  constructor(statusCode: number, type: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, "ValidationError", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UnauthorizedError", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "ForbiddenError", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "NotFoundError", message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(429, "RateLimitError", message);
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(500, "InternalError", message);
  }
}
