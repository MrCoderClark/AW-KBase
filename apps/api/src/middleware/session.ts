import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import {
  destroySession,
  readSession,
  touchSession,
  type SessionData,
} from "../modules/auth/session.js";
import {
  getUserForSession,
  type AuthUser,
} from "../modules/auth/auth.service.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: { sid: string; data: SessionData };
    }
  }
}

/**
 * Reads the session cookie, loads the Redis-backed session, hydrates req.user.
 * Does NOT require auth — just attaches if present. Use requireAuth for gating.
 */
export const sessionMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    const sid = req.signedCookies?.[env.SESSION_COOKIE_NAME] as
      | string
      | false
      | undefined;
    if (!sid || typeof sid !== "string") return next();

    const data = await readSession(sid);
    if (!data) return next();

    const user = await getUserForSession(data.userId);
    if (!user) {
      // User deleted/suspended — kill the session.
      await destroySession(sid);
      return next();
    }

    // Permission version changed since login → session is stale.
    if (user.permVer !== data.permVer) {
      await destroySession(sid);
      return next();
    }

    await touchSession(sid, data);
    req.user = user;
    req.session = { sid, data };
    next();
  } catch (err) {
    next(err);
  }
};
