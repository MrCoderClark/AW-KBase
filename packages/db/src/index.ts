import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client singleton for Prisma 7.
 *
 * Prisma 7 requires a driver adapter. We use @prisma/adapter-pg (node-postgres),
 * which works against both local Postgres and Neon's standard endpoint.
 *
 * - DATABASE_URL should be the pooled Neon URL in prod; direct URL is fine in dev.
 * - In dev, the client is cached on globalThis to survive tsx/Next HMR reloads.
 */

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrisma>;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export type { PrismaClient } from "@prisma/client";
