# Production Hardening — Audit & Gap Analysis

> Honest assessment of what's in the repo **today** vs. what the architecture docs promise.
> Priorities: **P0** = blocks production · **P1** = must ship in first 30 days · **P2** = within 90 days.

---

## 0. Current State — What Actually Exists

**Shipped**
- Next.js 16 + React 19 + Tailwind v4 + shadcn/ui scaffold.
- Four UI screens (dashboard, articles list, article detail, editor) driven by **in-memory mock data** in `src/lib/mock-data.ts`.
- Framer Motion micro-interactions.
- App shell: sidebar + topbar.

**Not shipped (documented but not built)**
- Express API (`apps/api`).
- Prisma schema + migrations + Postgres (Neon) connection.
- Auth / sessions / RBAC.
- Redis (cache, rate-limit, session store, queue backend).
- BullMQ workers (`apps/worker`).
- Search engine (Meilisearch / OpenSearch).
- Observability stack (pino, OTel, Sentry).
- CI/CD pipeline, test suite, Playwright.
- Monorepo split (pnpm workspaces).

**Bottom line:** this is a beautiful front-end on mock data. Zero of the hardening targets below are met. That is expected for where we are — this audit is the plan to close the gap.

---

## 1. Performance Optimizations

### Findings
- **Next 16 `fetch` is uncached by default.** We have not opted any route into `use cache` or `cache: 'force-cache'`. Every server fetch in production will be dynamic and contribute to TTFB.
- **No Next `Image` usage.** Real deployments will regress LCP on any screen that grows imagery. Avatars are generated, but article thumbnails, illustrations, and user-uploaded imagery need `next/image` + AVIF/WebP + `sizes`.
- **Client-only `articles/page.tsx`.** Marked `"use client"` but could be a server component streaming a client island for the table body + bulk bar. Loses RSC benefits (smaller JS, better TTI).
- **Framer Motion is shipped as a full import.** ~30KB gzip in every bundle that imports `motion`. Should use `LazyMotion` + `domAnimation` features for a smaller primary bundle, or swap route-level transitions for CSS where possible.
- **No route-level code splitting for the editor.** Tiptap (when wired) will balloon the `/articles/new` bundle. Must be dynamically imported with `ssr: false`.
- **No `next/font` variant subsetting audited.** Geist + JetBrains Mono + implicit Google fonts loaded.
- **No bundle analysis baseline.** Without `@next/bundle-analyzer` output in CI, regressions ship silently.
- **Mock data in the client bundle.** `mock-data.ts` will leak into client JS for any `"use client"` page that imports from it. Fine for now, critical to remove before prod.

### Actions (priority)
- **P0** Replace mock imports with API calls before production.
- **P0** Move `articles/page.tsx` to RSC + `<HydrationBoundary>` pattern already documented in `docs/frontend-architecture.md §3.2`.
- **P1** Dynamically import the Tiptap editor bundle.
- **P1** Add `@next/bundle-analyzer`; gate PRs on bundle-size deltas.
- **P1** `unstable_instant` on primary nav routes (Next 16) for instant client-nav transitions.
- **P1** `next/image` everywhere; signed S3 URLs through a loader.
- **P2** `LazyMotion` + `domAnimation` for Framer Motion.
- **P2** Pre-render ISR-safe public pages with `use cache` + `revalidateTag`.

### SLO targets to lock in
- TTFB p75 ≤ 250ms, LCP p75 ≤ 1.5s, CLS ≤ 0.05, INP p75 ≤ 150ms, JS per route p75 ≤ 180KB gzip.

---

## 2. Security Gaps

This is the largest risk surface. **Today the app has effectively no server-side security** because there is no server.

### Findings
- **No authentication.** Every screen is publicly reachable. `docs/auth-rbac.md` is unimplemented.
- **No authorization.** No RBAC checks, no resource policies.
- **No CSP, HSTS, or security headers** set in `next.config.ts` or in `middleware.ts`.
- **No CSRF protection.** When mutations exist, cookie-auth POSTs must use double-submit tokens per the auth doc.
- **No input validation.** Zod schemas are specified in the docs; no runtime validation is wired.
- **`dangerouslySetInnerHTML` in `article-body.tsx`** renders inline Markdown. Safe today because source is trusted mock data; **unsafe** the moment user-generated content flows through it. Must be replaced with server-side DOMPurify output on a strict allowlist.
- **No rate limiting.** `POST /login`, feedback, comments are all unprotected.
- **No env var validation.** No Zod-parsed `env.ts`; missing secrets would fail silently at runtime.
- **No secret management.** No `.env` governance; no indication of vault/SSM integration.
- **No dependency/SBOM scanning** in CI.
- **`npm audit` reports 3 moderate vulnerabilities** after installs — not triaged.
- **No audit log.** The `AuditLog` model exists on paper; nothing writes to it.
- **No session revocation path.** `permVer` mechanism specified but not implemented.
- **No signed-URL policy for uploads.** Attachments go nowhere today.
- **CORS, cookie domain, `__Host-` prefix** — all unset.

### Actions
- **P0** Build Express API per `docs/backend-api.md` and wire middleware chain (helmet, CORS allowlist, cookieParser, requestContext, pino-http, rate-limit, CSRF, authenticate, RBAC, Zod validation, errorHandler).
- **P0** Implement session store (Redis) + opaque cookie per `docs/auth-rbac.md`.
- **P0** `next.config.ts` + Next `middleware.ts`: HSTS, CSP with per-request nonce, Referrer-Policy, X-Content-Type-Options, Permissions-Policy, `frame-ancestors 'none'`.
- **P0** Server-side Markdown → sanitized HTML pipeline (markdown-it + DOMPurify in jsdom).
- **P0** Zod-parsed `env.ts` that **throws on boot** if required vars are missing.
- **P1** `npm audit fix` + Dependabot + Snyk in CI; fail build on `high`.
- **P1** OIDC SSO provider integration (Okta/Azure AD) per `docs/auth-rbac.md §7`.
- **P1** SBOM (`npm sbom`) generated per release.
- **P2** WAF in front of the edge (Cloudflare / AWS WAF) with bot & OWASP rulesets.
- **P2** Pen-test before GA; threat-model review with a second set of eyes.

---

## 3. Scaling Strategy

### Findings (vs. `docs/architecture.md` & `docs/database-schema.md`)
- **No Prisma client, no Neon connection.** Serverless Prisma needs either Neon's HTTP adapter (edge/serverless friendly) or PgBouncer-style pooling. Not configured.
- **No read/write split** plumbing in repositories.
- **No queue.** Publish → search-index is a synchronous TODO at best; that bottlenecks writes and couples latency to external systems.
- **No search engine.** All "search" is in-memory filters. Will not scale past thousands of articles.
- **No partitioning plan** executed for `audit_logs`.
- **Single-tenant schema.** Multi-tenant upgrade path is documented but not prepped.
- **No caching layer.** Every read will hit Postgres on day one.
- **Connection storm risk.** A Vercel serverless deployment without a pooled driver will exhaust Neon connections under burst.

### Actions
- **P0** Neon pooled connection (`DATABASE_URL` via pooler, `DIRECT_URL` for migrations). Prisma client singleton behind `globalThis` guard in dev.
- **P0** Redis (Upstash or Elasticache) for cache + rate limit + session.
- **P1** BullMQ queue + `apps/worker` process: `search-index`, `notifications`, `embeddings`, `exports`.
- **P1** Meilisearch (simpler) or OpenSearch (enterprise) as the primary search index; Postgres FTS as fallback.
- **P1** Repository-level `readReplica()` escape hatch for heavy list endpoints.
- **P2** `audit_logs` monthly range partitioning + detach/archive to S3.
- **P2** Multi-tenant migration: `tenantId` column + RLS policies; add to every composite unique.
- **P2** Horizontal autoscale policy: API on RPS, worker on queue depth.

### Capacity reference
- Neon autoscales CPU; cap max-branch at a budget ceiling.
- Aim for p95 DB query < 50ms; alert at 150ms.
- Search p95 < 200ms; queue lag < 60s.

---

## 4. CI/CD Suggestions

### Findings
- **No CI pipeline.** No lint/typecheck/test gate.
- **No tests.** Zero unit, integration, or E2E coverage.
- **No migration strategy in CI.** The documented expand-migrate-contract pattern has no automation.
- **No preview environments.** Reviewers have nothing to click.
- **No release versioning / changelog discipline.**

### Recommended pipeline (GitHub Actions or similar)
Stage by stage, each a required status check on PRs:

1. **Install + cache** — pnpm install with lockfile, `actions/cache` on node_modules + Next cache.
2. **Lint + typecheck** — `eslint`, `tsc --noEmit`, `prettier --check`.
3. **Unit tests** — Vitest on pure logic (services, schemas, mappers).
4. **Integration tests** — spin an **ephemeral Neon branch** (`neonctl branches create`), run Prisma migrations, Vitest against real Postgres + Redis (docker service).
5. **E2E smoke** — Playwright against a preview deploy (login → list → publish → logout).
6. **Build** — `next build` + `apps/api` build.
7. **Bundle budget check** — `@next/bundle-analyzer` diff vs. main; fail on > +10% primary bundle.
8. **Security** — `npm audit --production`, `osv-scanner`, `gitleaks`, SBOM artifact.
9. **Deploy preview** — Vercel preview + a fly.io/ECS preview for the API. Output URL to the PR.
10. **Promote** — on merge to `main`: run migrations against prod (expand phase), deploy API (rolling), deploy Web (Vercel). Contract-phase migrations run manually or in a scheduled job after the old code is drained.

### Actions
- **P0** Pipeline stages 1–2, 6, 9.
- **P1** Stages 3, 4, 5, 8.
- **P2** Bundle budget, SBOM publishing, release notes automation (`changesets`).

---

## 5. Observability

### Findings
- **No structured logging** — `console.*` will be the fallback.
- **No correlation IDs.** A failure today cannot be traced through the stack.
- **No metrics.** No RED/USE signals, no SLO dashboards, no alerting.
- **No tracing.** No OpenTelemetry SDK.
- **No error reporting.** Sentry not wired.
- **No audit-event shipping.** `audit_logs` will exist in Postgres; not mirrored to SIEM.

### Target stack
- **Logs:** pino (API + worker) → stdout → Vector/Fluent Bit → Datadog/Loki/CloudWatch. Field-level redaction enforced.
- **Traces:** OpenTelemetry auto-instrumentation for Express, Prisma, Redis, HTTP clients. Trace id === `correlationId` === `x-correlation-id` header propagated by `middleware.ts`.
- **Metrics:** OTel metrics or Prometheus scrape. RED per route, USE for Node event loop lag, Prisma pool saturation, Redis memory, BullMQ queue depth.
- **Errors:** Sentry (web + api + worker) with user/correlation tagging.
- **RUM:** Vercel Analytics + Speed Insights (or SpeedCurve) for Core Web Vitals in the wild.
- **Audit:** daily batch replicate `audit_logs` to immutable S3 object-lock bucket.

### SLOs
- Web availability 99.9%.
- API availability 99.95%.
- API p95 latency 300ms, p99 500ms.
- Queue lag p95 < 60s, DLQ rate < 0.1%.
- Error budget consumed → halt non-critical deploys.

### Actions
- **P0** pino + correlation-id middleware.
- **P0** Sentry on both web and api.
- **P1** OpenTelemetry traces + RED dashboards.
- **P1** PagerDuty (or equivalent) on SLO burn alerts.
- **P2** SIEM export; anomaly detection on auth events.

---

## 6. Caching Strategy (Redis)

### Findings
- **No Redis in the repo.** Every one of the cache roles from `docs/architecture.md` is unimplemented.

### Target layers (layered, explicit, invalidated)
| Layer | Backing | What it stores | TTL / Invalidation |
|---|---|---|---|
| Edge / CDN | Vercel / Cloudflare | public article HTML (ISR), static assets | ISR tag-based |
| Next.js Data Cache | Next runtime | `fetch` results tagged per resource | `revalidateTag('article:<slug>')` on publish |
| API response cache | Redis | hot reads (`article:slug`, `category:tree`, `user:perms`) | 60–300s TTL + explicit invalidation on write |
| Session / auth | Redis | `session:<id>`, `user_sessions:<userId>`, `perms:<userId>` | rolling idle 30m, absolute 12h |
| Rate limit | Redis | sliding window counters per route/user/IP | window-bound |
| Idempotency | Redis | `idem:<userId>:<route>:<key>` → response snapshot | 24h |
| Locks | Redis | `lock:<resource>` (redlock) | ≤ 10s |
| Queue | Redis (BullMQ) | jobs + delayed + repeat | per job |

### Invalidation rules (the hard part)
- **Writes invalidate explicitly**, never by TTL alone for user-visible reads (article publish bumps `revalidateTag` AND deletes `article:<slug>` in Redis).
- **`permVer` counter** per user mirrored in Redis and Postgres; role changes bump both.
- **Search index** is invalidated via `search-index` queue, not directly by writers.
- **Negative caching** (404s): 30s TTL to protect against scrape floods; clear on create.

### Actions
- **P0** Redis client singleton, typed `cache.ts` wrapper (`get/setJson/withLock/incr`).
- **P0** Session + rate-limit Redis usage.
- **P1** Response cache on high-traffic GETs + tag-based invalidation.
- **P1** Idempotency middleware.
- **P2** Redlock for long-running admin jobs.
- **P2** Redis metrics: keyspace hit rate, evictions, memory; alerts at 80% memory.

---

## 7. Deployment Architecture

### Recommended target (matches the architecture docs)

```
                        ┌──────────────────────┐
                        │  Edge (Vercel CDN)   │
                        │  WAF · HSTS · ISR    │
                        └──────────┬───────────┘
                                   ▼
                     ┌───────────────────────────┐
                     │  Next.js on Vercel        │   ← apps/web
                     │  RSC · Server Actions     │
                     │  middleware.ts (Edge)     │
                     └────────────┬──────────────┘
                                  │  internal HTTPS (service token)
                                  ▼
                     ┌───────────────────────────┐
                     │  Express API              │   ← apps/api
                     │  Fly.io / ECS / GKE       │
                     │  autoscale on RPS         │
                     └───┬───────────┬───────────┘
           ┌─────────────┘           └──────────────┐
           ▼                                        ▼
  ┌────────────────┐                       ┌────────────────┐
  │  Postgres      │                       │  Redis         │
  │  Neon          │                       │  Upstash /     │
  │  pooler + PITR │                       │  Elasticache   │
  └────────┬───────┘                       └────────┬───────┘
           │                                        │
           ▼                                        ▼
  ┌────────────────┐   ┌──────────────────┐   ┌────────────────┐
  │  Search        │   │  BullMQ Workers  │   │  Object store  │
  │  Meilisearch / │   │  apps/worker     │   │  S3 / R2       │
  │  OpenSearch    │   │  autoscale on    │   │  presigned URL │
  │  managed       │   │  queue depth     │   │  lifecycle     │
  └────────────────┘   └──────────────────┘   └────────────────┘
```

### Concrete wiring
- **Web** — Vercel project, production + preview + dev environments. Domain `kb.example.com`. Secrets via Vercel Env (scoped per env).
- **API** — Docker image, deploy to Fly.io (smaller ops) or ECS Fargate / GKE (enterprise). 2+ replicas behind an internal LB. Private DNS from Vercel to the API (or a signed public endpoint with strict allowlist).
- **Worker** — separate image, same repo. Scaled independently.
- **Database** — Neon project with two branches per env (pooler + direct). PITR on. Alerts on storage + CPU.
- **Redis** — Upstash global (for session stickiness) or a regional Elasticache cluster paired with the API region.
- **Search** — Meilisearch Cloud starter; upgrade to OpenSearch Service if we need fine-grained analyzers / ACL at scale.
- **Storage** — S3 bucket per env, presigned-only PUT, public reads via a separate cookie-less CDN domain.
- **DNS & TLS** — Cloudflare (or AWS ACM + CloudFront). HTTPS everywhere, HSTS preload.
- **Secrets** — Doppler / Vault / AWS Secrets Manager; rotated quarterly.

### Actions
- **P0** Stand up Vercel project + Neon + Upstash Redis + one-region API deploy.
- **P0** Env matrix: `development` (local + Neon branch), `preview` (per-PR), `staging`, `production`.
- **P1** Deploy the worker as a separate service.
- **P1** WAF in front of the edge.
- **P2** Multi-region read replicas once traffic justifies it.

---

## 8. Critical Weaknesses — Ranked

1. **No backend exists** — the top blocker. Every other hardening item depends on it.
2. **No auth** — app is effectively open.
3. **No observability** — a failure in prod is invisible.
4. **No tests or CI gates** — every PR is a gamble.
5. **No caching / rate limiting** — first traffic spike will melt Postgres.
6. **Unsanitized `dangerouslySetInnerHTML`** path — safe today, unsafe the moment real content flows.
7. **Mock data leaking into client bundles** — acceptable for now, must be removed.
8. **No secret management / env validation** — silent production misconfig.
9. **No search engine** — UX degrades the instant the corpus grows.
10. **No queue / workers** — publish-time operations block the request.

---

## 9. 30/60/90 Day Plan

### Days 0–30 (P0)
- Stand up Express API + Prisma + Neon with pooled connection.
- Auth: Redis sessions, CSRF, rate limit, RBAC, Zod validation, error handler, pino + correlation ids.
- Next.js security headers + CSP + `middleware.ts` session gate.
- Wire list + detail + create endpoints; replace mock data in the UI.
- CI: lint, typecheck, build, preview deploy.
- Sentry on web + api.

### Days 30–60 (P1)
- BullMQ worker + search-index + notifications queues.
- Meilisearch integration + reindex-from-Postgres job.
- Integration + E2E tests with ephemeral Neon branches.
- OpenTelemetry traces + RED dashboards + SLO alerts.
- Idempotency middleware + response cache for top endpoints.
- OIDC SSO integration.

### Days 60–90 (P2)
- `audit_logs` partitioning + SIEM export.
- Multi-tenant scaffolding (`tenantId` + RLS).
- Bundle budgets, `LazyMotion`, route-level `unstable_instant`.
- WAF, pen-test, SBOM, release automation.
- Dark-launch AI assist (embeddings job + pgvector or vector DB).

---

## 10. Answering the Express Question

**Yes — Express (or an equivalent backend process) needs to be set up next** if we want to realize the architecture and auth docs as specified. Today the UI runs on mock data; nothing it shows is real.

### Three valid paths, in order of fidelity to the docs

**Option A (recommended — matches `docs/backend-api.md`)**
Create `apps/api` as a separate Express process. Pair with `apps/worker`. Convert the repo to a pnpm + Turborepo monorepo. This is the most work up front but buys clean scaling boundaries, independent deploys, and a real home for BullMQ workers.

**Option B (faster MVP — deviates from docs)**
Keep a single Next.js app and put the backend behind **Next Route Handlers** (`/api/v1/*`), with Prisma on the Node runtime. Pros: one deploy, no monorepo overhead. Cons: queue workers still need a separate Node process; Vercel serverless runtimes need careful Prisma connection handling (pooled `DATABASE_URL`); rate limiting and long-lived websockets get awkward. Acceptable for an internal pilot; painful at scale.

**Option C (hybrid — pragmatic)**
Start with **Option B** for the read/write API, but stand up the worker as a separate Fly.io / Railway service from day one (queues and background jobs do not belong in Vercel serverless). Extract the API to Express later if/when the gains justify the split. Lowest initial ceremony without painting the worker architecture into a corner.

### My recommendation
Given the docs already describe an enterprise posture and the next steps (auth, RBAC, audit logging, search indexing) all benefit from a persistent server:
- Go **Option A** if you plan to ship this to real enterprise customers within the year.
- Go **Option C** if you want the UI wired to a real DB this week and will graduate to Express when a queue/worker's complexity demands it.

Either way, the **next concrete step** is the same:
1. Add `prisma` schema from `docs/database-schema.md` to the repo.
2. Connect Neon (pooled + direct URLs).
3. Stand up Redis.
4. Implement `/auth/login` + `/auth/me` + session middleware.
5. Wire `/articles` list + detail + create against Prisma.
6. Replace the mock imports in the UI with the real fetchers.

Everything in this audit assumes that foundation lands first.
