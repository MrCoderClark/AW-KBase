import type { RequestHandler } from "express";
import { AuthenticationError, AuthorizationError } from "../errors/app-error.js";

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new AuthenticationError());
  next();
};

export const requirePermission =
  (...keys: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new AuthenticationError());
    const have = new Set(req.user.permissions);
    for (const k of keys) {
      if (!have.has(k)) return next(new AuthorizationError(`Missing permission: ${k}`));
    }
    next();
  };
