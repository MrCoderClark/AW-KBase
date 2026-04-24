import argon2 from "argon2";

/**
 * Argon2id with OWASP-recommended params for interactive logins.
 * Tune memoryCost down if CPU/RAM-constrained; never lower than 19 MiB.
 */
const OPTS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MiB
  timeCost: 3,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTS);
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
