import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { requestContext } from "./middleware/request-context.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { sessionMiddleware } from "./middleware/session.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { articlesRouter } from "./modules/articles/articles.routes.js";
import { categoriesRouter } from "./modules/categories/categories.routes.js";
import { tagsRouter } from "./modules/tags/tags.routes.js";
import { searchRouter } from "./modules/search/search.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "content-type",
        "accept",
        "authorization",
        "x-csrf-token",
        "x-correlation-id",
        "idempotency-key",
      ],
    }),
  );
  app.use(compression());
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ correlationId: (req as { correlationId?: string }).correlationId }),
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(sessionMiddleware);

  // Routes
  app.use("/healthz", healthRouter);
  app.use("/v1/health", healthRouter);
  app.use("/v1/auth", authRouter);
  app.use("/v1/tags", tagsRouter);
  app.use("/v1/categories", categoriesRouter);
  app.use("/v1/search", searchRouter);
  app.use("/v1/articles", articlesRouter);

  // 404 + error handler
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
