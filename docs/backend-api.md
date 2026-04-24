# Backend API Design — Express + Prisma + Zod

> Production Express API for the KB. Clean architecture, Zod-validated, Prisma-backed, observable, and safe by default.

---

## 1. Folder Structure

```
apps/api/
├── src/
│   ├── index.ts                      # process bootstrap (http.listen)
│   ├── app.ts                        # express app factory (pure, testable)
│   ├── config/
│   │   ├── env.ts                    # Zod-parsed env (fail-fast)
│   │   ├── constants.ts
│   │   └── logger.ts                 # pino instance
│   │
│   ├── modules/                      # one folder per bounded context
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   └── auth.schema.ts        # Zod request/response
│   │   ├── articles/
│   │   │   ├── articles.routes.ts
│   │   │   ├── articles.controller.ts
│   │   │   ├── articles.service.ts
│   │   │   ├── articles.repository.ts
│   │   │   ├── articles.mapper.ts    # Prisma row ↔ DTO
│   │   │   ├── articles.policy.ts    # resource-level authz
│   │   │   └── articles.schema.ts
│   │   ├── categories/
│   │   ├── tags/
│   │   ├── comments/
│   │   ├── feedback/
│   │   ├── search/
│   │   ├── attachments/
│   │   ├── users/
│   │   ├── admin/
│   │   └── audit/
│   │
│   ├── middleware/
│   │   ├── request-context.ts        # correlationId, req start time
│   │   ├── error-handler.ts          # RFC 7807 output
│   │   ├── not-found.ts
│   │   ├── authenticate.ts           # populates req.user from session
│   │   ├── require-auth.ts
│   │   ├── rbac.ts                   # requirePermission(...)
│   │   ├── validate.ts               # validate(schema) using Zod
│   │   ├── rate-limit.ts             # global + per-route
│   │   ├── csrf.ts                   # double-submit for cookie auth
│   │   ├── idempotency.ts            # Idempotency-Key handling
│   │   └── cors.ts
│   │
│   ├── infra/
│   │   ├── prisma.ts                 # PrismaClient singleton + extensions
│   │   ├── redis.ts
│   │   ├── cache.ts                  # typed wrapper (get/set/invalidate)
│   │   ├── queue.ts                  # BullMQ producer
│   │   ├── search-client.ts          # Meilisearch/OpenSearch client
│   │   ├── storage.ts                # S3 signed URLs
│   │   └── mailer.ts
│   │
│   ├── events/
│   │   ├── event-bus.ts              # in-process emitter → queue publisher
│   │   └── events.ts                 # domain event types
│   │
│   ├── jobs/                         # job name constants + enqueue helpers
│   │   ├── index-article.ts
│   │   └── send-notification.ts
│   │
│   ├── errors/
│   │   ├── app-error.ts              # base class
│   │   ├── http-errors.ts            # NotFound, Forbidden, Conflict, ...
│   │   └── problem-details.ts        # RFC 7807 serializer
│   │
│   └── utils/
│       ├── async-handler.ts          # Promise → next(err)
│       ├── pagination.ts             # cursor encode/decode
│       └── slug.ts
│
├── test/
│   ├── unit/
│   ├── integration/                  # against ephemeral Neon branch
│   └── fixtures/
├── package.json
└── tsconfig.json
```

**Layering rules (enforced by ESLint boundaries plugin):**
- `controllers` may import `services`, `schema`, `errors`, `utils`. Never `repositories` or `prisma`.
- `services` may import `repositories`, other `services`, `events`, `errors`. Never `express`.
- `repositories` own all Prisma access. Return domain objects, not Prisma rows (via `mapper`).
- `routes` only wire middleware + controllers; no logic.

---

## 2. Example Endpoints

All under `/v1`. JSON over HTTPS. Cursor pagination (`?cursor=&limit=`). RFC 7807 errors.

### 2.1 Auth
| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | — | email + password → session cookie |
| `POST` | `/auth/mfa` | session (pending) | submit TOTP |
| `POST` | `/auth/logout` | session | destroy current session |
| `POST` | `/auth/logout-all` | session | destroy all sessions |
| `GET`  | `/auth/me` | session | current user + permissions |
| `POST` | `/auth/password-reset` | — | request reset email |
| `POST` | `/auth/password-reset/confirm` | — | submit token + new password |

### 2.2 Articles (CRUD)
| Method | Path | Permission |
|---|---|---|
| `GET`    | `/articles` | optional (visibility filtered) |
| `GET`    | `/articles/:slug` | optional |
| `GET`    | `/articles/:id/versions` | `article:read` |
| `POST`   | `/articles` | `article:create` |
| `PATCH`  | `/articles/:id` | `article:update` + policy |
| `POST`   | `/articles/:id/publish` | `article:publish` + policy |
| `POST`   | `/articles/:id/archive` | `article:archive` |
| `DELETE` | `/articles/:id` | `article:delete` |

### 2.3 Categories
| Method | Path | Permission |
|---|---|---|
| `GET`    | `/categories` | optional |
| `GET`    | `/categories/:slug` | optional |
| `POST`   | `/categories` | `category:manage` |
| `PATCH`  | `/categories/:id` | `category:manage` |
| `POST`   | `/categories/:id/move` | `category:manage` |
| `DELETE` | `/categories/:id` | `category:manage` |

### 2.4 Search
| Method | Path | Permission |
|---|---|---|
| `GET` | `/search?q=&category=&tags=&status=&cursor=&limit=` | optional |
| `GET` | `/search/suggest?q=` | optional |

### 2.5 Feedback
| Method | Path | Permission |
|---|---|---|
| `POST`   | `/articles/:id/feedback` | optional (anon allowed) |
| `GET`    | `/articles/:id/feedback/summary` | `feedback:read` |

---

## 3. Request / Response Formats

### 3.1 Success envelope
Responses return the resource directly. Lists use a paging envelope:

```json
{
  "data": [ { "...": "..." } ],
  "pageInfo": {
    "nextCursor": "eyJwdWJsaXNoZWRBdCI6I...",
    "hasNextPage": true
  }
}
```

### 3.2 Create article request
```http
POST /v1/articles
Content-Type: application/json
Cookie: __Host-kb_session=...
X-CSRF-Token: ...
Idempotency-Key: 2f6c...-a41e
```
```json
{
  "title": "How to reset the corporate VPN client",
  "summary": "Steps to fully reset GlobalProtect on Windows and macOS.",
  "contentMd": "# Reset VPN\n\n1. Quit the client...\n",
  "categoryId": "6b4e...-uuid",
  "tagSlugs": ["vpn", "windows", "macos"],
  "visibility": "INTERNAL",
  "status": "DRAFT"
}
```

### 3.3 Create article response
```http
HTTP/1.1 201 Created
Location: /v1/articles/how-to-reset-the-corporate-vpn-client
```
```json
{
  "id": "9e0c...-uuid",
  "slug": "how-to-reset-the-corporate-vpn-client",
  "title": "How to reset the corporate VPN client",
  "summary": "Steps to fully reset GlobalProtect on Windows and macOS.",
  "status": "DRAFT",
  "visibility": "INTERNAL",
  "locale": "en",
  "categoryId": "6b4e...-uuid",
  "author": { "id": "...", "name": "Jane Doe" },
  "tags": [ { "slug": "vpn", "name": "VPN" } ],
  "currentVersion": {
    "id": "...", "versionNo": 1, "createdAt": "2026-04-22T14:50:00Z"
  },
  "createdAt": "2026-04-22T14:50:00Z",
  "updatedAt": "2026-04-22T14:50:00Z"
}
```

### 3.4 Error (RFC 7807)
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json
```
```json
{
  "type": "https://errors.kb.example.com/validation",
  "title": "Invalid request body",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "instance": "/v1/articles",
  "correlationId": "01HV8X...ZK",
  "errors": [
    { "path": "title", "code": "too_small", "message": "Title must be at least 3 characters" },
    { "path": "tagSlugs.2", "code": "invalid_string", "message": "Must be a valid slug" }
  ]
}
```

---

## 4. Error Handling Strategy

### 4.1 Principles
- **Throw typed errors in services**, never `res.status(...).send(...)` outside controllers.
- **Single error handler** converts any error to an RFC 7807 Problem Details response.
- **Never leak internals** (stack, SQL, Prisma error codes) to clients — logged server-side only.
- **Correlation id** on every error response for support lookups.

### 4.2 Error hierarchy
```
AppError (abstract)
 ├─ ValidationError         (422)  from Zod failures
 ├─ AuthenticationError     (401)
 ├─ AuthorizationError      (403)
 ├─ NotFoundError           (404)
 ├─ ConflictError           (409)  slug collision, version race
 ├─ RateLimitError          (429)
 ├─ UnprocessableError      (422)  business-rule violation
 └─ InternalError           (500)  default for unmapped
```

### 4.3 Error middleware (behavior)
- Catches Zod, Prisma (`P2002` → Conflict, `P2025` → NotFound), and `AppError` subclasses.
- Produces Problem Details JSON (`application/problem+json`).
- Logs at `warn` for 4xx, `error` for 5xx with full stack + Prisma meta.
- Emits an `error_count` metric tagged by route and error class.

### 4.4 Async safety
- All controllers wrapped in `asyncHandler` so rejected promises flow into the error middleware (no unhandled rejections in Express).
- Process-level `uncaughtException` / `unhandledRejection` handlers log, flush telemetry, and exit — the orchestrator restarts.

---

## 5. Logging Strategy

- **pino** structured JSON logs; no `console.*` anywhere.
- Per-request child logger with `{ correlationId, userId, route, method, ip }`.
- **Never log**: passwords, tokens, session ids, cookies, `Authorization` headers, PII-heavy bodies. A field-redaction list is enforced in the logger config.
- Levels:
  - `debug` — development only.
  - `info` — request completion, domain events, job enqueue/consume.
  - `warn` — validation failures, auth denials, upstream retries.
  - `error` — 5xx, DB/Redis/search failures, job dead-letter.
- **Access log**: `pino-http` (one line per request with status, latency, route, userId, contentLength).
- **Traces**: OpenTelemetry SDK auto-instruments Express, Prisma, Redis, HTTP clients; trace id = `correlationId`.
- **Sinks**: stdout → log collector (Datadog/Loki/CloudWatch). Errors also to Sentry.
- **Audit log** is a *domain* log, not an ops log — it lives in Postgres `audit_logs`, written inside service transactions.

---

## 6. Rate Limiting & Security Middleware

### 6.1 Security stack (order matters)
```
helmet({ contentSecurityPolicy: false })   // CSP handled at Next.js edge
cors(strictOrigins, { credentials: true })
cookieParser(env.COOKIE_SECRET)
compression()
requestContext()                           // generates correlationId
pinoHttp({ logger, redact })
rateLimit.global                           // per-IP baseline
express.json({ limit: '1mb' })
csrf({ skip: isInternalOrWebhook })
authenticate()                             // optional, attaches req.user
```

### 6.2 Rate limiting (Redis-backed, sliding window)
- **Global**: 600 req/min per IP.
- **Per-user**: 300 req/min per authenticated user.
- **Sensitive routes**:
  - `POST /auth/login`: 5/min/ip + 10/hour/email.
  - `POST /auth/password-reset`: 3/hour/(email+ip).
  - `POST /articles`: 30/hour/user.
  - `POST /articles/:id/feedback`: 10/min/(user|anonHash).
  - `POST /comments`: 20/min/user.
- Responses include `RateLimit-*` headers; `429` uses Problem Details with `Retry-After`.

### 6.3 Other protections
- **Idempotency-Key** middleware for `POST` that may be retried (create article, publish, feedback) — stored in Redis with a 24h TTL, keyed by `(userId, route, key)`.
- **Body size** capped (1 MB JSON; uploads go direct-to-S3 via presigned URLs).
- **CSRF** double-submit token for browser cookie auth; skipped for service-to-service JWT and HMAC webhooks.
- **Parameter pollution** guard (`hpp`).
- **Prototype pollution** — JSON body parser only; no query-string objects deeper than N.
- **Timeouts**: per-request 30s; DB query 10s; external HTTP 5s.

---

## 7. Sample Implementation — Create Article (Full Flow)

All code below lives in `apps/api/src`.

### 7.1 Zod schema — `modules/articles/articles.schema.ts`
```ts
import { z } from 'zod';

export const SlugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a valid slug');

export const CreateArticleBody = z.object({
  title: z.string().min(3).max(200).trim(),
  summary: z.string().max(500).trim().optional(),
  contentMd: z.string().min(1).max(500_000),
  categoryId: z.string().uuid().optional(),
  tagSlugs: z.array(SlugSchema).max(20).default([]),
  visibility: z.enum(['INTERNAL', 'RESTRICTED', 'PUBLIC']).default('INTERNAL'),
  status: z.enum(['DRAFT', 'IN_REVIEW']).default('DRAFT'),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('en'),
});
export type CreateArticleInput = z.infer<typeof CreateArticleBody>;

export const ArticleDto = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  status: z.string(),
  visibility: z.string(),
  locale: z.string(),
  categoryId: z.string().uuid().nullable(),
  author: z.object({ id: z.string().uuid(), name: z.string() }),
  tags: z.array(z.object({ slug: z.string(), name: z.string() })),
  currentVersion: z
    .object({ id: z.string().uuid(), versionNo: z.number(), createdAt: z.date() })
    .nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ArticleDto = z.infer<typeof ArticleDto>;
```

### 7.2 Route — `modules/articles/articles.routes.ts`
```ts
import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requireAuth } from '../../middleware/require-auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { idempotency } from '../../middleware/idempotency';
import { rateLimit } from '../../middleware/rate-limit';
import { CreateArticleBody } from './articles.schema';
import * as controller from './articles.controller';

export const articlesRouter = Router();

articlesRouter.post(
  '/',
  requireAuth,
  requirePermission('article:create'),
  rateLimit({ key: 'articles:create', limit: 30, windowSec: 3600, scope: 'user' }),
  idempotency({ ttlSec: 86_400 }),
  validate({ body: CreateArticleBody }),
  asyncHandler(controller.create),
);
```

### 7.3 Controller — `modules/articles/articles.controller.ts`
```ts
import type { Request, Response } from 'express';
import type { CreateArticleInput } from './articles.schema';
import * as service from './articles.service';
import { toArticleDto } from './articles.mapper';

export async function create(req: Request, res: Response) {
  const input = req.body as CreateArticleInput;
  const article = await service.createArticle({
    input,
    actor: req.user!,                 // requireAuth guarantees presence
    correlationId: req.correlationId,
  });

  res
    .status(201)
    .location(`/v1/articles/${article.slug}`)
    .json(toArticleDto(article));
}
```

### 7.4 Service — `modules/articles/articles.service.ts`
```ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/prisma';
import { logger } from '../../config/logger';
import { slugify } from '../../utils/slug';
import { ConflictError, NotFoundError } from '../../errors/http-errors';
import { eventBus } from '../../events/event-bus';
import { enqueueIndexArticle } from '../../jobs/index-article';
import * as repo from './articles.repository';
import type { CreateArticleInput } from './articles.schema';
import type { ActorContext } from '../auth/types';

type CreateArgs = {
  input: CreateArticleInput;
  actor: ActorContext;
  correlationId: string;
};

export async function createArticle({ input, actor, correlationId }: CreateArgs) {
  // 1. Validate references (category exists & visible to actor)
  if (input.categoryId) {
    const category = await repo.findCategoryById(input.categoryId);
    if (!category) throw new NotFoundError('Category not found');
  }

  // 2. Derive slug; retry up to 3 times on collision with numeric suffix
  const baseSlug = slugify(input.title);

  // 3. Single transaction: article + version(1) + tags + audit
  try {
    const article = await prisma.$transaction(
      async (tx) => {
        const slug = await repo.reserveUniqueSlug(tx, baseSlug);

        const created = await repo.createArticle(tx, {
          slug,
          title: input.title,
          summary: input.summary ?? null,
          status: input.status,
          visibility: input.visibility,
          locale: input.locale,
          categoryId: input.categoryId ?? null,
          authorId: actor.id,
        });

        const version = await repo.createInitialVersion(tx, {
          articleId: created.id,
          title: input.title,
          summary: input.summary ?? null,
          contentMd: input.contentMd,
          contentHtml: await renderAndSanitize(input.contentMd),
          editorId: actor.id,
        });

        await repo.setCurrentVersion(tx, created.id, version.id);

        if (input.tagSlugs.length > 0) {
          await repo.attachTagsBySlug(tx, created.id, input.tagSlugs);
        }

        await repo.writeAudit(tx, {
          actorId: actor.id,
          action: 'CREATE',
          entityType: 'Article',
          entityId: created.id,
          metadata: { slug, status: input.status, visibility: input.visibility },
          correlationId,
        });

        return repo.findFullById(tx, created.id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 },
    );

    // 4. Fire-and-forget side effects (outside the transaction)
    eventBus.emit('article.created', {
      articleId: article!.id,
      actorId: actor.id,
      correlationId,
    });
    await enqueueIndexArticle({ articleId: article!.id });

    logger.info(
      { articleId: article!.id, slug: article!.slug, actorId: actor.id, correlationId },
      'article.created',
    );

    return article!;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Article slug already in use', { cause: err });
    }
    throw err;
  }
}

// Helper stubbed here; real impl lives in a rendering module using
// markdown-it + DOMPurify (jsdom) with a strict allowlist.
async function renderAndSanitize(md: string): Promise<string> {
  const { renderMarkdown } = await import('../../infra/markdown');
  return renderMarkdown(md);
}
```

### 7.5 Repository — `modules/articles/articles.repository.ts`
```ts
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../infra/prisma';

type Tx = Prisma.TransactionClient | PrismaClient;

export function findCategoryById(id: string) {
  return prisma.category.findFirst({ where: { id, deletedAt: null } });
}

export async function reserveUniqueSlug(tx: Tx, base: string): Promise<string> {
  // Optimistic: try base, then base-2, base-3, ... bounded to avoid runaway
  for (let n = 0; n < 5; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const exists = await tx.article.findFirst({
      where: { slug: candidate, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Fallback: suffix with short random token
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createArticle(
  tx: Tx,
  data: {
    slug: string;
    title: string;
    summary: string | null;
    status: 'DRAFT' | 'IN_REVIEW';
    visibility: 'INTERNAL' | 'RESTRICTED' | 'PUBLIC';
    locale: string;
    categoryId: string | null;
    authorId: string;
  },
) {
  return tx.article.create({ data });
}

export function createInitialVersion(
  tx: Tx,
  data: {
    articleId: string;
    title: string;
    summary: string | null;
    contentMd: string;
    contentHtml: string;
    editorId: string;
  },
) {
  return tx.articleVersion.create({
    data: { ...data, versionNo: 1, isMajor: true },
  });
}

export function setCurrentVersion(tx: Tx, articleId: string, versionId: string) {
  return tx.article.update({
    where: { id: articleId },
    data: { currentVersionId: versionId },
  });
}

export async function attachTagsBySlug(tx: Tx, articleId: string, slugs: string[]) {
  const tags = await tx.tag.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const missing = slugs.filter((s) => !tags.find((t) => t.slug === s));
  if (missing.length) {
    const created = await Promise.all(
      missing.map((slug) =>
        tx.tag.create({ data: { slug, name: slug.replace(/-/g, ' ') } }),
      ),
    );
    tags.push(...created.map((t) => ({ id: t.id, slug: t.slug })));
  }
  await tx.articleTag.createMany({
    data: tags.map((t) => ({ articleId, tagId: t.id })),
    skipDuplicates: true,
  });
}

export function writeAudit(
  tx: Tx,
  entry: {
    actorId: string;
    action: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'DELETE';
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    correlationId: string;
  },
) {
  return tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
      correlationId: entry.correlationId,
    },
  });
}

export function findFullById(tx: Tx, id: string) {
  return tx.article.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      tags: { include: { tag: { select: { slug: true, name: true } } } },
      currentVersion: { select: { id: true, versionNo: true, createdAt: true } },
    },
  });
}
```

### 7.6 Mapper — `modules/articles/articles.mapper.ts`
```ts
import type { ArticleDto } from './articles.schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toArticleDto(row: any): ArticleDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    visibility: row.visibility,
    locale: row.locale,
    categoryId: row.categoryId,
    author: { id: row.author.id, name: row.author.name },
    tags: row.tags.map((t: any) => ({ slug: t.tag.slug, name: t.tag.name })),
    currentVersion: row.currentVersion
      ? {
          id: row.currentVersion.id,
          versionNo: row.currentVersion.versionNo,
          createdAt: row.currentVersion.createdAt,
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

### 7.7 Validation middleware — `middleware/validate.ts` (conceptual)
```ts
import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from '../errors/http-errors';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export const validate = (schemas: Schemas): RequestHandler => (req, _res, next) => {
  try {
    if (schemas.body)   req.body   = schemas.body.parse(req.body);
    if (schemas.query)  req.query  = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(new ValidationError('Invalid request', err.issues));
    }
    next(err);
  }
};
```

### 7.8 Error handler — `middleware/error-handler.ts` (conceptual)
```ts
import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, ConflictError, NotFoundError } from '../errors/http-errors';
import { toProblemDetails } from '../errors/problem-details';
import { logger } from '../config/logger';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let appErr: AppError;

  if (err instanceof AppError) {
    appErr = err;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') appErr = new ConflictError('Resource already exists');
    else if (err.code === 'P2025') appErr = new NotFoundError('Resource not found');
    else appErr = new AppError('Database error', 500, 'db_error');
  } else {
    appErr = new AppError('Internal server error', 500, 'internal');
  }

  const log = appErr.status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(
    { err, correlationId: req.correlationId, route: req.route?.path, userId: req.user?.id },
    'request.failed',
  );

  res
    .status(appErr.status)
    .type('application/problem+json')
    .json(toProblemDetails(appErr, { instance: req.originalUrl, correlationId: req.correlationId }));
};
```

### 7.9 End-to-end lifecycle recap (Create Article)
1. Browser → `POST /v1/articles` with session cookie, CSRF header, `Idempotency-Key`, JSON body.
2. `rateLimit` → `csrf` → `authenticate` → `requireAuth` → `requirePermission('article:create')` → `rateLimit:articles:create` → `idempotency` → `validate(body=CreateArticleBody)` → controller.
3. Controller calls `articlesService.createArticle({ input, actor, correlationId })`.
4. Service opens a Prisma transaction:
   - reserve unique slug,
   - insert `Article`,
   - insert `ArticleVersion` (v1, sanitized HTML),
   - set `currentVersionId`,
   - upsert/attach tags,
   - write `AuditLog`.
5. On commit: emit `article.created` event, enqueue `index-article` job (search engine sync).
6. Respond `201 Created` with the full `ArticleDto` and `Location` header.
7. Worker consumes `index-article`, writes to Meilisearch/OpenSearch; analytics/notification jobs also fire if wired.
8. Any failure surfaces as RFC 7807 JSON; Prisma `P2002` on slug race is converted to `409 Conflict` (or retried with a suffix inside `reserveUniqueSlug`).

---

## 8. Next Steps

1. Scaffold `apps/api` with the folder structure above and wire the middleware chain.
2. Implement `auth` module (login, `/me`, logout) — everything else depends on `req.user`.
3. Port this Create Article sample into real files; add integration tests against a Neon branch.
4. Add `PATCH /articles/:id` + `POST /articles/:id/publish` (reuses the same transactional pattern with a new version row).
5. Move to Step 5 — search indexing pipeline & the worker process.
