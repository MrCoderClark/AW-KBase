import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

// Load the repo-root .env before importing the Prisma client
// (the client reads DATABASE_URL at construction time).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../../../.env") });

const { prisma } = await import("../src/index.js");

/**
 * Seed system roles, permissions, and a bootstrap admin category.
 * Idempotent: re-runs safely.
 */

const PERMISSIONS = [
  "article:read",
  "article:create",
  "article:update",
  "article:publish",
  "article:archive",
  "article:delete",
  "comment:create",
  "comment:moderate",
  "feedback:read",
  "category:manage",
  "tag:manage",
  "user:invite",
  "user:deactivate",
  "role:manage",
  "audit:read",
  "admin:access",
];

const ROLES: {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}[] = [
    {
      key: "admin",
      name: "Admin",
      description: "Full system access",
      permissions: PERMISSIONS,
    },
    {
      key: "editor",
      name: "Editor",
      description: "Create, edit, and publish articles",
      permissions: [
        "article:read",
        "article:create",
        "article:update",
        "article:publish",
        "article:archive",
        "comment:create",
        "comment:moderate",
        "feedback:read",
        "category:manage",
        "tag:manage",
      ],
    },
    {
      key: "reviewer",
      name: "Reviewer",
      description: "Review + comment, cannot publish",
      permissions: [
        "article:read",
        "article:update",
        "comment:create",
        "comment:moderate",
        "feedback:read",
      ],
    },
    {
      key: "viewer",
      name: "Viewer",
      description: "Read-only",
      permissions: ["article:read", "comment:create"],
    },
  ];

const CATEGORIES = [
  { slug: "networking", name: "Networking" },
  { slug: "hardware", name: "Hardware" },
  { slug: "access", name: "Access & Identity" },
  { slug: "software", name: "Software" },
  { slug: "security", name: "Security" },
  { slug: "productivity", name: "Productivity" },
];

async function main() {
  console.log("Seeding permissions…");
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  console.log("Seeding roles…");
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description },
      create: {
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: true,
      },
    });
    const perms = await prisma.permission.findMany({
      where: { key: { in: r.permissions } },
      select: { id: true },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log("Seeding categories…");
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { slug: c.slug, name: c.name, path: `/${c.slug}/`, depth: 1 },
    });
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
