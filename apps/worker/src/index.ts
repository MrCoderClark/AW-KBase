import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

// Load the repo-root .env before anything reads process.env.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../../../.env") });

const { Worker } = await import("bullmq");
type Job<T = unknown> = import("bullmq").Job<T>;
const { Redis } = await import("ioredis");
const { default: pino } = await import("pino");
const { env } = await import("./config/env.js");

const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * Queue processors.
 * Add new queues as modules under src/processors/* and register them here.
 */

const { processSearchIndexJob } = await import("./processors/search-index.js");
const { ensureArticlesIndex } = await import("./infra/meilisearch.js");

// Ensure the Meilisearch index + settings exist before consuming jobs. If
// MEILI_HOST isn't set this is a no-op.
await ensureArticlesIndex().catch((err) =>
  logger.error({ err }, "meili.ensureIndex.failed"),
);

const searchIndexWorker = new Worker(
  "search-index",
  async (job: Job) => {
    const result = await processSearchIndexJob(job as Job<{ articleId: string }>);
    logger.info(
      { id: job.id, name: job.name, ...result },
      "search-index.processed",
    );
    return result;
  },
  { connection, concurrency: env.WORKER_CONCURRENCY },
);

const notificationsWorker = new Worker(
  "notifications",
  async (job: Job) => {
    logger.info({ id: job.id, name: job.name }, "notifications.process");
    // TODO: email / Slack / in-app
    return { delivered: true };
  },
  { connection, concurrency: env.WORKER_CONCURRENCY },
);

for (const w of [searchIndexWorker, notificationsWorker]) {
  w.on("completed", (job) => logger.info({ id: job.id, queue: w.name }, "job.completed"));
  w.on("failed", (job, err) =>
    logger.error({ id: job?.id, queue: w.name, err }, "job.failed"),
  );
}

logger.info(
  { queues: ["search-index", "notifications"] },
  "worker.started",
);

async function shutdown(signal: string) {
  logger.info({ signal }, "worker.shutting_down");
  await Promise.allSettled([
    searchIndexWorker.close(),
    notificationsWorker.close(),
  ]);
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) =>
  logger.error({ reason }, "unhandledRejection"),
);
