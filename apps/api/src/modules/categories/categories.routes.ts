import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  getCategoryBySlug,
  listCategories,
} from "./categories.service.js";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const data = await listCategories();
    res.json({ data });
  }),
);

const SlugParams = z.object({
  slug: z.string().min(1).max(100),
});

categoriesRouter.get(
  "/:slug",
  requireAuth,
  validate({ params: SlugParams }),
  asyncHandler(async (req, res) => {
    const category = await getCategoryBySlug(req.params.slug!);
    res.json(category);
  }),
);
