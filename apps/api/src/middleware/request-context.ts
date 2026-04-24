import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      startedAt: number;
    }
  }
}

export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-correlation-id");
  const id = incoming && /^[\w-]{6,64}$/.test(incoming) ? incoming : randomUUID();
  req.correlationId = id;
  req.startedAt = Date.now();
  res.setHeader("x-correlation-id", id);
  next();
};
