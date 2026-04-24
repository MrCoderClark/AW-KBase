import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { listTags } from "./tags.service.js";

export const tagsRouter = Router();

const TagsListQuery = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

tagsRouter.get(
  "/",
  requireAuth,
  validate({ query: TagsListQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof TagsListQuery>;
    const data = await listTags({ q: q.q, limit: q.limit });
    res.json({ data });
  }),
);
