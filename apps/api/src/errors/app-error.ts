export type ProblemIssue = {
  path: string;
  code: string;
  message: string;
};

export class AppError extends Error {
  constructor(
    public override readonly message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly issues?: ProblemIssue[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request", issues?: ProblemIssue[]) {
    super(message, 422, "validation", issues);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Not authenticated") {
    super(message, 401, "authentication");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "authorization");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "not_found");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "conflict");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "rate_limit");
  }
}
