# Enterprise Knowledge Base — System Architecture

> Production-grade architecture for an IT-support Knowledge Base SaaS.
> Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · Node.js/Express · PostgreSQL (Neon) · Prisma.

---

## 1. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            CLIENTS                                  │
│   Web (Next.js SSR/CSR) · Internal Admin · API Consumers (SSO)      │
└───────────────┬─────────────────────────────────────────────────────┘
                │ HTTPS
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EDGE / CDN (Vercel / CloudFront)                 │
│   Static assets · ISR cache · WAF · L7 rate limiting                │
└───────────────┬─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APP (App Router)                        │
│   - RSC / Server Actions for reads + light mutations                │
│   - Route Handlers (BFF) for auth-scoped browser calls              │
│   - Proxies heavy/domain logic to the Express API                   │
└───────────────┬─────────────────────────────────────────────────────┘
                │ internal HTTPS (JWT / service token)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   EXPRESS API (Node.js) — Core Domain               │
│   Routes → Controllers → Services → Repositories → Prisma           │
│   Cross-cutting: AuthN/Z · Validation (Zod) · Logging · Tracing     │
└───┬───────────────┬───────────────┬───────────────┬─────────────────┘
    ▼               ▼               ▼               ▼
┌────────┐   ┌────────────┐   ┌────────────┐   ┌─────────────────┐
│Postgres│   │ Redis      │   │ Search     │   │ Job Queue       │
│ (Neon) │   │ cache+lock │   │(Meili/OS)  │   │ (BullMQ+Redis)  │
└────────┘   └────────────┘   └────────────┘   └────────┬────────┘
                                                        ▼
                                                ┌───────────────┐
                                                │ Workers       │
                                                │ - indexing    │
                                                │ - notifications│
                                                │ - embeddings  │
                                                │ - exports     │
                                                └───────┬───────┘
                                                        ▼
                                        ┌──────────────────────────┐
                                        │ External: S3, SMTP,      │
                                        │ SSO/IdP, Slack/Teams,    │
                                        │ LLM provider (optional)  │
                                        └──────────────────────────┘
```

---

## 2. Separation of Concerns

- **Frontend (Next.js)** — UI, routing, SSR/ISR, session cookies, thin BFF via Route Handlers. No business rules, no direct DB access from the browser.
- **Backend (Express API)** — Single source of truth for domain logic, authorization, validation, persistence. Stateless and horizontally scalable.
- **Service layer (inside API)** — Use-case orchestration (e.g. `ArticleService.publish`), isolated from HTTP and DB concerns.
- **Infra services** — Postgres (Neon), Redis, Search engine, Object storage, Queue workers. Reached only via the API.

**Rule:** Next.js never queries Postgres directly in production paths. Prisma lives only in the API package — this prevents UI/schema coupling and keeps a single boundary for auth and auditing.

---

## 3. API Structure (Hybrid: REST + Server Actions)

**REST** for the Express core API — stable, cacheable, easy to consume from non-web clients.

**Versioned** under `/api/v1/*`. Resource-oriented, predictable verbs.

| Domain        | Endpoints (examples)                                              |
| ------------- | ----------------------------------------------------------------- |
| Auth          | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`   |
| Users         | `GET/POST /users` · `GET/PATCH/DELETE /users/:id`                 |
| Articles      | `GET/POST /articles` · `GET/PATCH/DELETE /articles/:id`           |
| Versions      | `GET /articles/:id/versions` · `POST /articles/:id/publish`       |
| Categories    | `GET/POST /categories` · `PATCH/DELETE /categories/:id`           |
| Tags          | `GET/POST /tags`                                                  |
| Search        | `GET /search?q=...&filters=...`                                   |
| Comments      | `GET/POST /articles/:id/comments`                                 |
| Attachments   | `POST /attachments` (presigned S3) · `DELETE /attachments/:id`    |
| Feedback      | `POST /articles/:id/feedback`                                     |
| Audit         | `GET /audit-logs`                                                 |
| Admin         | `GET /admin/metrics` · `POST /admin/reindex`                      |

**Conventions**
- JSON over HTTPS, `application/json`.
- Auth: short-lived JWT access + rotating refresh (HttpOnly cookie) or SSO/OIDC session.
- Pagination: cursor-based (`?cursor=&limit=`). Filtering/sorting via query params.
- Errors: RFC 7807 Problem Details (`type`, `title`, `status`, `detail`, `traceId`).
- Idempotency: `Idempotency-Key` header for POSTs that can be retried.
- Validation: Zod schemas shared via a `packages/contracts` module.

**Server Actions / Route Handlers (Next.js)** — used for:
- Session-bound lightweight mutations (e.g. "favorite article").
- Form submissions that benefit from progressive enhancement.
- Never for cross-cutting domain logic — they call the Express API internally.

---

## 4. Folder Structure

### Monorepo layout (pnpm workspaces recommended)

```
aw-kbase/
├── apps/
│   ├── web/                  # Next.js (App Router)
│   ├── api/                  # Express API
│   └── worker/               # BullMQ workers (separate process)
├── packages/
│   ├── contracts/            # Zod schemas + TS types shared FE/BE
│   ├── db/                   # Prisma schema, migrations, client
│   ├── config/               # env loader, logger, tracing
│   └── ui/                   # (optional) shared shadcn components
├── docs/
│   └── architecture.md
└── package.json
```

### Frontend — `apps/web`

```
apps/web/
├── src/
│   ├── app/                          # App Router
│   │   ├── (marketing)/              # public landing
│   │   ├── (app)/                    # authenticated shell
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── articles/
│   │   │   │   ├── page.tsx          # list (RSC)
│   │   │   │   ├── [slug]/page.tsx   # detail (RSC + ISR)
│   │   │   │   └── new/page.tsx
│   │   │   ├── search/page.tsx
│   │   │   └── admin/
│   │   ├── api/                      # Route Handlers (BFF only)
│   │   │   ├── auth/[...nextauth]/
│   │   │   └── proxy/[...path]/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                       # shadcn primitives
│   │   ├── editor/                   # rich-text editor (Tiptap)
│   │   ├── article/
│   │   └── search/
│   ├── features/                     # feature-sliced modules
│   │   ├── articles/
│   │   │   ├── api.ts                # client fetchers
│   │   │   ├── hooks.ts
│   │   │   └── types.ts
│   │   └── search/
│   ├── lib/
│   │   ├── api-client.ts             # typed fetch wrapper
│   │   ├── auth.ts
│   │   └── utils.ts
│   ├── server/                       # server-only helpers (RSC)
│   │   ├── api.ts                    # server-side fetcher w/ cookie fwd
│   │   └── session.ts
│   ├── styles/
│   └── middleware.ts                 # auth gating, locale, headers
└── next.config.ts
```

### Backend — `apps/api`

```
apps/api/
├── src/
│   ├── index.ts                      # bootstrap
│   ├── app.ts                        # express app factory
│   ├── config/                       # env, constants
│   ├── modules/                      # one folder per bounded context
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   └── auth.schema.ts        # Zod
│   │   ├── articles/
│   │   ├── categories/
│   │   ├── search/
│   │   ├── comments/
│   │   ├── attachments/
│   │   ├── feedback/
│   │   └── audit/
│   ├── middleware/
│   │   ├── auth.ts                   # JWT / session
│   │   ├── rbac.ts                   # role/permission checks
│   │   ├── validate.ts               # Zod request validation
│   │   ├── error-handler.ts
│   │   ├── rate-limit.ts
│   │   └── request-context.ts        # correlation id, tracing
│   ├── infra/
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── search-client.ts
│   │   ├── storage.ts                # S3 / R2
│   │   └── queue.ts                  # BullMQ producer
│   ├── events/                       # domain events (pub/sub)
│   ├── jobs/                         # job definitions (enqueue side)
│   └── utils/
├── test/
└── package.json
```

### Workers — `apps/worker`

```
apps/worker/
├── src/
│   ├── index.ts
│   ├── processors/
│   │   ├── index-article.ts
│   │   ├── send-notification.ts
│   │   ├── generate-embedding.ts
│   │   └── export-report.ts
│   └── schedulers/                   # cron-like (repeatable jobs)
```

### Shared — `packages/db`

```
packages/db/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── src/index.ts                      # exports PrismaClient singleton
```

---

## 5. Data Flow — Request Lifecycle

### Read (article detail page)

1. Browser requests `/articles/how-to-reset-vpn`.
2. Edge/CDN checks ISR cache → hit returns static HTML; miss forwards to Next.js.
3. Next.js RSC runs on server, calls `GET /api/v1/articles/:slug` on the Express API using a server-side fetcher that forwards the session cookie/JWT.
4. Express middleware chain: `requestContext → rateLimit → auth → rbac → validate`.
5. Controller → `ArticleService.getBySlug` → checks **Redis** cache → miss falls through to `ArticleRepository` → Prisma → Postgres.
6. Response is cached in Redis (short TTL) and returned.
7. Next.js renders RSC output; page is revalidated via ISR tag (`revalidateTag('article:slug')`).

### Write (publish article)

1. User submits form → Next.js Server Action or client `fetch` → `POST /api/v1/articles/:id/publish`.
2. Express: auth → RBAC (`article:publish`) → Zod validation.
3. `ArticleService.publish` runs in a **Prisma transaction**: create new version, update current pointer, write audit log.
4. On commit, service emits domain event → enqueues jobs: `index-article`, `send-notification`, `generate-embedding`.
5. API returns `202`/`200` with the updated resource.
6. Next.js calls `revalidateTag('article:slug')` to invalidate ISR; client state updated optimistically.
7. Worker consumes jobs asynchronously (search index, email/Slack, embeddings).

### Search

1. `GET /api/v1/search?q=...` → Express search module.
2. Service queries **Meilisearch/OpenSearch** (not Postgres) with filters, ACL pre-filter, and pagination.
3. Results hydrated with minimal Postgres lookups only when needed; cached in Redis per `(query, filters, userRole)`.

---

## 6. Caching, Search, Background Jobs

### Caching (layered)
- **CDN/Edge** — static assets, public marketing pages, ISR-cached public article HTML.
- **Next.js Data Cache** — `fetch` results tagged per resource; invalidated via `revalidateTag`.
- **Redis (API-side)** —
  - Hot reads (article by slug, category trees, user permissions).
  - Rate-limit counters, idempotency keys, distributed locks.
  - Short TTL + explicit invalidation on writes.
- **HTTP caching** — `ETag` / `Cache-Control` on GETs where safe.

### Search
- **Meilisearch** (simpler) or **OpenSearch** (enterprise-scale, analyzers, security) as the primary search.
- Postgres is the source of truth; search index is a derived read model kept in sync through the job queue (eventual consistency acceptable).
- Multi-tenant / ACL filters applied at query time using document-level permissions.
- Optional: **pgvector** in Postgres or external vector store for semantic search / AI assist. Embeddings generated by a worker.

### Background Jobs — **BullMQ on Redis**
Separate `apps/worker` process, horizontally scalable. Queues:
- `search-index` — create/update/delete index docs.
- `notifications` — email, Slack, Teams, in-app.
- `embeddings` — generate vectors on publish.
- `exports` — PDF/CSV, long-running report generation.
- `maintenance` (repeatable) — cleanup, re-index drift, analytics rollups.

Characteristics: retries with exponential backoff, dead-letter queue, job-level observability, idempotent processors.

---

## 7. Cross-Cutting Concerns

- **AuthN** — OIDC/SAML SSO (Okta/Azure AD/Google) for enterprise; JWT access + refresh for API; HttpOnly cookies for web.
- **AuthZ** — RBAC (Admin, Editor, Reviewer, Viewer) + resource-level policies (category/space scoped). Enforced in services, not controllers.
- **Validation** — Zod schemas in `packages/contracts`, used by both FE forms and BE middleware.
- **Observability** — OpenTelemetry traces (web → api → worker), structured logs (pino) with correlation IDs, metrics (Prom/OTel), Sentry for errors.
- **Audit** — append-only `audit_logs` table for every mutating action.
- **Security** — Helmet, CORS allowlist, CSRF for cookie auth on Route Handlers, per-route rate limiting, secret manager (no `.env` in prod), input sanitization for rich text (DOMPurify server-side), signed URLs for uploads.
- **Compliance readiness** — PII tagging, soft deletes, data retention jobs, export/delete endpoints (GDPR).

---

## 8. Dev vs Production

### Development
- Single `pnpm dev` runs `web`, `api`, `worker` concurrently (Turborepo).
- Neon **branch database** per developer/PR (cheap ephemeral branches).
- Local Redis + Meilisearch via `docker-compose.dev.yml`.
- Prisma migrate dev, seed scripts, MailHog for email, Minio for S3.
- Hot reload (Next.js + `tsx watch` for API/worker).
- Feature flags via env; verbose logs; no CDN.

### Production
- **Web** on Vercel (or containerized Next.js behind CDN).
- **API** + **Worker** as separate containers (Fly.io / ECS / Kubernetes); autoscaled independently — workers scale on queue depth, API on RPS.
- **Postgres** on Neon (autoscaling, PITR, read replicas if needed).
- **Redis** managed (Upstash / Elasticache).
- **Search** managed Meilisearch Cloud or OpenSearch Service.
- **Object storage** S3/R2 with lifecycle policies; uploads via presigned URLs (never through the API).
- **Migrations** gated in CI/CD (expand → deploy → contract pattern for zero-downtime).
- **Secrets** via Vault / AWS Secrets Manager / Doppler.
- **CI/CD** — lint, typecheck, unit + integration tests (ephemeral Neon branch), build, deploy; blue-green or rolling.
- **Monitoring** — SLOs on p95 latency, error rate, queue lag; alerting to PagerDuty.
- **Backups** — Neon PITR + nightly logical dumps; search index is rebuildable from Postgres (not backed up separately).

---

## 9. Scalability & Clean-Architecture Notes

- **Statelessness** — API and worker carry no local state; sessions in Redis or JWT.
- **Bounded contexts** — each `modules/*` folder is independently ownable; could be extracted to a microservice later without reshaping the frontend.
- **Dependency rule** — Controllers depend on Services; Services depend on Repository interfaces; Repositories depend on Prisma. Domain types never import HTTP or Prisma types directly.
- **Derived data** — search index, embeddings, analytics are all rebuildable from Postgres, the single source of truth.
- **Read/write split ready** — repositories can route reads to Neon replicas without touching service logic.
- **Multi-tenant ready** — `tenantId` column + middleware-injected tenant context; row-level security optional.

---

## 10. Next Steps (before coding)

1. Lock the domain model (articles, versions, categories, tags, spaces, permissions).
2. Define the Prisma schema and ACL model.
3. Decide SSO provider(s) and session strategy.
4. Pick Meilisearch vs OpenSearch based on scale targets.
5. Set up monorepo tooling (pnpm + Turborepo) and CI skeleton.
6. Draft the OpenAPI spec from the Zod contracts in `packages/contracts`.
