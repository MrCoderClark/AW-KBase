# Acme Knowledge Base

Enterprise IT Knowledge Base — monorepo.

## Stack

- **Web** — Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui · TanStack Query · Framer Motion
- **API** — Express · TypeScript · Zod · pino
- **DB** — PostgreSQL (Neon) · Prisma 7
- **Cache / sessions / queue** — Redis (ioredis) · BullMQ
- **Worker** — Node process consuming BullMQ queues

## Layout

```
aw-kbase/
├── apps/
│   ├── web/         # Next.js frontend (@kb/web)
│   ├── api/         # Express API (@kb/api)
│   └── worker/      # BullMQ worker (@kb/worker)
├── packages/
│   ├── db/          # Prisma schema + client singleton (@kb/db)
│   └── contracts/   # Zod DTOs shared FE/BE (@kb/contracts)
├── docs/            # Architecture, schema, auth, UI system, hardening
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

See the full architecture in [`docs/`](./docs). Start with `docs/architecture.md`.

## Prerequisites

- Node.js ≥ 20.10
- pnpm 10 (`corepack enable && corepack prepare pnpm@10.27.0 --activate`)
- A PostgreSQL database (Neon recommended) with two connection strings (pooled + direct)
- A Redis instance (Upstash, Docker, or local)

## One-time setup

```powershell
# 1. Env vars
Copy-Item .env.example .env
# Edit .env with real DATABASE_URL / DIRECT_URL / REDIS_URL / COOKIE_SECRET

# 2. Install workspace deps
pnpm install

# 3. Generate the Prisma client
pnpm db:generate

# 4. Run migrations against the database
pnpm db:migrate

# 5. Seed roles, permissions, and categories
pnpm db:seed
```

## Local development

Two terminals:

```powershell
# Web (Next.js on :3000)
pnpm dev:web

# API (Express on :4000)
pnpm dev:api
```

Or both in parallel via Turborepo:

```powershell
pnpm dev
```

Optional worker:

```powershell
pnpm --filter @kb/worker dev
```

## Common scripts

| Command | What it does |
|---|---|
| `pnpm typecheck` | Typechecks every workspace |
| `pnpm build` | Builds web, api, worker |
| `pnpm lint` | ESLint across workspaces |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate` | Create + apply a new dev migration |
| `pnpm db:seed` | Seed baseline roles/permissions/categories |
| `pnpm db:studio` | Launch Prisma Studio |

## Health checks

- `GET http://localhost:4000/healthz/live` — liveness (returns 200 immediately)
- `GET http://localhost:4000/healthz/ready` — readiness (pings Postgres + Redis)

## Env vars

See `.env.example`. Required at minimum:

- `DATABASE_URL` and `DIRECT_URL` — Neon pooled + direct
- `REDIS_URL`
- `COOKIE_SECRET` — ≥ 32 characters
- `WEB_ORIGIN` — for API CORS
- `NEXT_PUBLIC_API_BASE_URL` — for the browser
- `API_BASE_URL_INTERNAL` — for RSC server-side fetches

## Documentation

| Doc | Contents |
|---|---|
| [`architecture.md`](./docs/architecture.md) | High-level architecture, request lifecycle, dev vs prod |
| [`database-schema.md`](./docs/database-schema.md) | Prisma schema, indexing, scaling |
| [`auth-rbac.md`](./docs/auth-rbac.md) | Auth flow, session strategy, RBAC enforcement |
| [`backend-api.md`](./docs/backend-api.md) | Express folder structure, example endpoints, sample Create Article |
| [`frontend-architecture.md`](./docs/frontend-architecture.md) | Next.js App Router, data fetching, Query hydration |
| [`ui-system.md`](./docs/ui-system.md) | Design tokens, typography, motion, core components |
| [`production-hardening.md`](./docs/production-hardening.md) | Audit, gaps, 30/60/90 day plan |

---

### Legacy Next.js starter notes

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
