import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../errors/app-error.js";
import { logger } from "../config/logger.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let appErr: AppError;

  if (err instanceof ZodError) {
    appErr = new ValidationError(
      "Invalid request",
      err.issues.map((i) => ({
        path: i.path.join("."),
        code: i.code,
        message: i.message,
      })),
    );
  } else if (err instanceof AppError) {
    appErr = err;
  } else {
    appErr = new AppError("Internal server error", 500, "internal");
  }

  const log = appErr.status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(
    {
      err,
      correlationId: req.correlationId,
      route: req.originalUrl,
      method: req.method,
    },
    "request.failed",
  );

  res
    .status(appErr.status)
    .type("application/problem+json")
    .json({
      type: `https://errors.kb.example.com/${appErr.code}`,
      title: appErr.message,
      status: appErr.status,
      instance: req.originalUrl,
      correlationId: req.correlationId,
      ...(appErr.issues ? { errors: appErr.issues } : {}),
    });
};
