import { z } from "zod";

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const MeResponse = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
  }),
  session: z.object({
    expiresAt: z.string(),
  }),
});
export type MeResponse = z.infer<typeof MeResponse>;
