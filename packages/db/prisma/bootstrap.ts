import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";
import argon2 from "argon2";

// Load repo-root .env before importing Prisma.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../../../.env") });

const { prisma } = await import("../src/index.js");

/**
 * Creates or updates a bootstrap admin user.
 *
 * Usage:
 *   BOOTSTRAP_EMAIL=admin@example.com BOOTSTRAP_PASSWORD=… BOOTSTRAP_NAME="Site Admin" pnpm db:bootstrap
 *
 * Idempotent: re-running updates the password/name and re-asserts the admin role.
 */

const email = process.env.BOOTSTRAP_EMAIL;
const password = process.env.BOOTSTRAP_PASSWORD;
const name = process.env.BOOTSTRAP_NAME ?? "Admin";

if (!email || !password) {
  console.error(
    "Missing env: BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD are required.",
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error("BOOTSTRAP_PASSWORD must be ≥ 12 characters.");
  process.exit(1);
}

const adminRole = await prisma.role.findUnique({ where: { key: "admin" } });
if (!adminRole) {
  console.error(
    "Admin role is missing. Run `pnpm db:seed` first to create system roles.",
  );
  process.exit(1);
}

const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
});

const user = await prisma.user.upsert({
  where: { email: email.toLowerCase() },
  update: {
    name,
    passwordHash,
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
  },
  create: {
    email: email.toLowerCase(),
    name,
    passwordHash,
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
  },
});

await prisma.userRole.upsert({
  where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
  update: {},
  create: { userId: user.id, roleId: adminRole.id },
});

console.log(`✓ Admin user ready: ${user.email} (${user.id})`);

await prisma.$disconnect();
