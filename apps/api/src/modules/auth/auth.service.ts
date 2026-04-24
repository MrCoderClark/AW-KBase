import { prisma } from "@kb/db";
import { verifyPassword } from "./password.js";
import {
  createSession,
  type SessionData,
} from "./session.js";
import { AuthenticationError } from "../../errors/app-error.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  permVer: number;
  roles: string[];
  permissions: string[];
};

async function loadUserWithRoles(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          user: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;

  // The schema's UserRole has a relation named `user` to Role (not to User).
  // Roles are reached via user.roles[].user (= Role), permissions via Role.permissions[].permission.
  const roleKeys = new Set<string>();
  const permKeys = new Set<string>();
  for (const ur of user.roles) {
    const role = ur.user; // Role
    roleKeys.add(role.key);
    for (const rp of role.permissions) permKeys.add(rp.permission.key);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    permVer: user.permVer,
    roles: [...roleKeys].sort(),
    permissions: [...permKeys].sort(),
  };
}

export async function authenticateWithPassword(
  email: string,
  password: string,
): Promise<{ user: AuthUser; sid: string; session: SessionData }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Constant-ish timing: always run a verify to avoid user-enumeration leaks.
  const ok =
    user && user.passwordHash
      ? await verifyPassword(user.passwordHash, password)
      : // Dummy verify against a known hash to keep timing close.
        await verifyPassword(
          "$argon2id$v=19$m=65536,t=3,p=1$YWFhYWFhYWFhYWFhYWFhYQ$0xDBvmC3DHAxK7rH1tZj9pB0f5Q5xkv+qG2pPqG1pAY",
          password,
        ).then(() => false);

  if (!ok || !user) throw new AuthenticationError("Invalid email or password");
  if (user.status !== "ACTIVE" || user.deletedAt)
    throw new AuthenticationError("Account is not active");

  const full = await loadUserWithRoles(user.id);
  if (!full) throw new AuthenticationError("Account is not active");

  const { sid, data } = await createSession(full.id, full.permVer);

  // Best-effort lastLoginAt update — fire-and-forget.
  prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => {});

  return { user: full, sid, session: data };
}

export async function getUserForSession(
  userId: string,
): Promise<AuthUser | null> {
  return loadUserWithRoles(userId);
}
