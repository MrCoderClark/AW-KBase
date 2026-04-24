import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * Dedicated Redis connection for BullMQ. We do NOT reuse the session Redis
 * client because BullMQ requires `maxRetriesPerRequest: null` and its own
 * connection state, and sharing connections between BullMQ Queue/Worker and
 * regular command clients is explicitly unsupported upstream.
 */
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/** Search-index queue — producer side. Worker consumes in `apps/worker`. */
export const searchIndexQueue = new Queue("search-index", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: 3_600, count: 1_000 },
    removeOnFail: { age: 24 * 3_600, count: 500 },
  },
});
