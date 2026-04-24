import { Router } from "express";
import { LoginBody } from "@kb/contracts/auth";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { authenticateWithPassword } from "./auth.service.js";
import {
  clearSessionCookie,
  destroySession,
  setSessionCookie,
} from "./session.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  validate({ body: LoginBody }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const { user, sid, session } = await authenticateWithPassword(
      email,
      password,
    );
    setSessionCookie(res, sid);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        roles: user.roles,
        permissions: user.permissions,
      },
      session: { expiresAt: new Date(session.expiresAt).toISOString() },
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = req.user!;
    const s = req.session!;
    res.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatarUrl,
        roles: u.roles,
        permissions: u.permissions,
      },
      session: { expiresAt: new Date(s.data.expiresAt).toISOString() },
    });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    if (req.session) await destroySession(req.session.sid);
    clearSessionCookie(res);
    res.status(204).end();
  }),
);
