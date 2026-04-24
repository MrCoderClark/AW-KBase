import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { prisma } from "@kb/db";
import { redis } from "../../infra/redis.js";

export const healthRouter = Router();

healthRouter.get(
  "/live",
  asyncHandler(async (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  }),
);

healthRouter.get(
  "/ready",
  asyncHandler(async (_req, res) => {
    const [db, rds] = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);
    const ok = db.status === "fulfilled" && rds.status === "fulfilled";
    res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      checks: {
        database: db.status === "fulfilled" ? "ok" : "fail",
        redis: rds.status === "fulfilled" ? "ok" : "fail",
      },
    });
  }),
);
