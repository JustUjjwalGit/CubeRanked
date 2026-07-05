export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required", details?: unknown) {
    super(message, 401, "AUTHENTICATION_ERROR", details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal server error", details?: unknown) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
  }
}
