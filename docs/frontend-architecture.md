# Frontend Architecture — Next.js App Router

> Production frontend for the KB.
> **Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query v5 · Zustand.**
>
> **Next.js 16 specifics that drive this design:**
> - `params` and `searchParams` are **Promises** — always `await` them.
> - `cookies()` / `headers()` are **async**.
> - `fetch` is **uncached by default**. Opt in with `use cache` or explicit `cache: 'force-cache'`.
> - Server Components are the default; `"use client"` is opt-in.

---

## 1. Folder Structure

```
src/
├── app/                                  # App Router — routing + RSC
│   ├── layout.tsx                        # root (providers, fonts)
│   ├── globals.css
│   ├── not-found.tsx
│   ├── error.tsx                         # root error boundary (client)
│   │
│   ├── (marketing)/                      # public
│   │   └── page.tsx
│   │
│   ├── (auth)/                           # login, reset
│   │   ├── login/page.tsx
│   │   └── reset/page.tsx
│   │
│   ├── (app)/                            # authenticated shell
│   │   ├── layout.tsx                    # session guard + AppShell
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── articles/
│   │   │   ├── page.tsx                  # LIST (RSC + Query hydration)
│   │   │   ├── loading.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [slug]/
│   │   │       ├── page.tsx
│   │   │       ├── edit/page.tsx
│   │   │       └── versions/page.tsx
│   │   ├── categories/
│   │   ├── search/page.tsx
│   │   └── admin/
│   │       ├── layout.tsx                # requires admin:access
│   │       ├── users/page.tsx
│   │       └── audit/page.tsx
│   │
│   └── api/                              # Route Handlers (BFF only)
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── csrf/route.ts
│       └── proxy/[...path]/route.ts
│
├── components/
│   ├── ui/                               # shadcn primitives
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   ├── command-palette.tsx
│   │   └── breadcrumbs.tsx
│   ├── article/
│   │   ├── article-card.tsx
│   │   ├── article-list.tsx              # client (useInfiniteQuery)
│   │   ├── article-filters.tsx
│   │   ├── article-editor.tsx            # Tiptap
│   │   └── article-viewer.tsx
│   ├── feedback/
│   ├── search/
│   └── common/                           # EmptyState, ErrorState, Skeletons
│
├── features/                             # feature-sliced client logic
│   ├── articles/
│   │   ├── api.ts                        # query fns + keys
│   │   ├── hooks.ts                      # useArticles, useArticle, useCreateArticle
│   │   ├── types.ts                      # DTOs (from packages/contracts)
│   │   └── schemas.ts                    # form schemas (Zod)
│   ├── auth/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   └── store.ts                      # current user snapshot
│   ├── search/
│   └── ui-state/
│       └── store.ts                      # sidebar, theme, command palette
│
├── lib/
│   ├── api-client.ts                     # client-side typed fetch
│   ├── query-client.ts                   # QueryClient factory
│   ├── problem-details.ts                # RFC 7807 → typed ApiError
│   ├── cn.ts                             # clsx + tailwind-merge
│   ├── format.ts
│   └── env.ts                            # Zod-parsed NEXT_PUBLIC_*
│
├── server/                               # server-only helpers
│   ├── api.ts                            # server fetcher (forwards cookies)
│   ├── session.ts                        # getSession() for RSC
│   ├── dehydrate.ts                      # prefetch + dehydrate utility
│   └── guards.ts                         # requireSession, requirePermission
│
├── providers/
│   ├── app-providers.tsx                 # QueryClientProvider, theme, toaster
│   └── hydration.tsx                     # HydrationBoundary wrapper
│
├── styles/
│   └── tokens.css
│
└── middleware.ts                         # Edge: auth gate, CSP nonce, headers
```

**Import boundaries (ESLint):**
- `app/**` may use `components`, `features`, `lib`, `server` (server imports only in RSC).
- `features/**` never imports `app/**`.
- `server/**` uses `import "server-only"`.
- `components/ui/**` has no data fetching.

---

## 2. Layout System

```
RootLayout
└─ AppProviders (QueryClient, Theme, Toaster)
   └─ (app)/layout.tsx
      └─ AppShell
         ├─ Sidebar   (collapsible, persisted in Zustand)
         ├─ Topbar    (breadcrumbs, search, user menu, notifications)
         └─ <main>
            └─ <Suspense fallback={loading.tsx}>
               └─ page.tsx
```

**`(app)/layout.tsx` responsibilities**
- `await getSession()` → if null, `redirect('/login?next=...')`.
- Prefetch boot queries (current user, nav counts) and ship as dehydrated cache.
- Render `AppShell` with children.

**Sidebar**
- Nav tree server-rendered; collapse/active-state in a small client island.
- `⌘K` opens `command-palette.tsx` (cmdk + shadcn).
- Collapsed state persisted via Zustand `persist` (localStorage).
- `<nav aria-label="Primary">`, skip-to-content link.

**Topbar**
- Breadcrumbs from matched segments, global search input, notifications bell, theme toggle, user menu.
- Sticky, `backdrop-blur`.

**Responsive**
- `lg:` breakpoint — below it, sidebar becomes a Sheet.
- Topbar collapses to icon-only on `md:`.
- Content `max-w-screen-xl mx-auto px-6`.

---

## 3. Data Fetching Patterns

Three patterns, picked by context:

### 3.1 Pattern A — RSC direct fetch (default for reads)
For page data that doesn't need client re-interaction (article detail body, category tree).

```tsx
// app/(app)/articles/[slug]/page.tsx
import { serverApi } from '@/server/api';
import { ArticleViewer } from '@/components/article/article-viewer';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;                       // Next 16: async params
  const article = await serverApi.articles.getBySlug(slug);
  return <ArticleViewer article={article} />;
}
```

### 3.2 Pattern B — RSC prefetch + TanStack Query hydration
For lists needing filters, infinite scroll, optimistic updates.

1. RSC prefetches initial page via a per-request `QueryClient`.
2. `dehydrate()` and ship via `<HydrationBoundary>`.
3. Client uses `useInfiniteQuery` with the **same key** → instant hydration, no duplicate fetch.

### 3.3 Pattern C — Client-only
`useMutation` for writes; `useQuery` with refetch interval for notifications. Server Actions reserved for simple forms that don't need full mutation UX.

### 3.4 Defaults

| Aspect | Policy |
|---|---|
| Query keys | Tuple, colocated: `['articles','list',filters]`, `['articles','detail',slug]` |
| Stale time | 30 s lists · 5 min categories · Infinity for current user |
| GC time | 5 min |
| Retries | 1 on network · 0 on 4xx |
| Refetch on focus | On (off for long forms) |
| Mutations | Optimistic update → rollback on error → `invalidateQueries` on settle |
| Pagination | `useInfiniteQuery` with `pageInfo.nextCursor` |
| Suspense | `useSuspenseQuery` in routes wrapped by `<Suspense>` |

### 3.5 Request lifecycle

```
Browser
 → middleware.ts        (auth cookie, CSP nonce, headers)
 → (app)/layout.tsx RSC (getSession, prefetch boot)
 → page.tsx RSC         (prefetch via QueryClient)
 → <HydrationBoundary>  (ships dehydrated cache)
 → Client hydrates      (RQ finds data, no refetch)
 → User scrolls         (useInfiniteQuery fetches next page)
   → apiClient → Express API → services → Prisma → Postgres → JSON
 → onSuccess: cache update · onError: ApiError → toast + ErrorState
```

---

## 4. State Management Strategy

| Kind | Tool | Examples |
|---|---|---|
| Server state | **TanStack Query** | articles list, detail, comments, search |
| UI state (global, persisted) | **Zustand** | sidebar open, theme, recent searches |
| UI state (local) | `useState` / RHF | dialog open, form fields |
| URL state (shareable) | `searchParams` | filters, cursor, sort |
| Auth snapshot | **Zustand** (read-only mirror of `/auth/me`) | userId, roles, permissions |

**Rules**
- Never duplicate server data into Zustand.
- Never put transient form state in Zustand.
- Stores thin and split by concern; selectors prevent over-rendering.
- `persist` only where latency matters.

```ts
// features/ui-state/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UIState = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    { name: 'kb.ui' },
  ),
);
```

---

## 5. API Client Setup

**Goals**
- One typed client surface shared by client + server.
- Problem Details aware — throws a typed `ApiError` with `status`, `code`, `correlationId`, field issues.
- Server variant forwards cookies, never caches.
- Client variant includes credentials + CSRF header for mutations.

### 5.1 `lib/api-client.ts`
```ts
import { parseProblemDetails } from './problem-details';
import { env } from './env';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
};

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(path, env.NEXT_PUBLIC_API_BASE_URL);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const headers = new Headers(opts.headers);
  headers.set('Accept', 'application/json');
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json');
  if (opts.idempotencyKey) headers.set('Idempotency-Key', opts.idempotencyKey);

  const csrf = typeof document !== 'undefined'
    ? document.cookie.match(/kb_csrf=([^;]+)/)?.[1]
    : undefined;
  if (csrf && opts.method && opts.method !== 'GET') headers.set('X-CSRF-Token', csrf);

  const res = await fetch(url, {
    ...opts,
    headers,
    credentials: 'include',
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (!res.ok) throw await parseProblemDetails(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get:    <T>(p: string, o?: RequestOptions) => apiFetch<T>(p, { ...o, method: 'GET' }),
  post:   <T>(p: string, body?: unknown, o?: RequestOptions) => apiFetch<T>(p, { ...o, method: 'POST', body }),
  patch:  <T>(p: string, body?: unknown, o?: RequestOptions) => apiFetch<T>(p, { ...o, method: 'PATCH', body }),
  delete: <T>(p: string, o?: RequestOptions) => apiFetch<T>(p, { ...o, method: 'DELETE' }),
};
```

### 5.2 `server/api.ts`
```ts
import 'server-only';
import { cookies, headers } from 'next/headers';
import { parseProblemDetails } from '@/lib/problem-details';
import { env } from '@/lib/env';

async function serverFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();     // Next 16: async
  const h = await headers();
  const res = await fetch(new URL(path, env.API_BASE_URL_INTERNAL), {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      cookie: cookieStore.toString(),
      'x-correlation-id': h.get('x-correlation-id') ?? crypto.randomUUID(),
      accept: 'application/json',
    },
    cache: 'no-store',                     // user data is per-request
  });
  if (!res.ok) throw await parseProblemDetails(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const serverApi = {
  articles: {
    list: (q: ArticlesListQuery) =>
      serverFetch<ArticlesListResponse>(
        `/v1/articles?${new URLSearchParams(q as Record<string, string>)}`,
      ),
    getBySlug: (slug: string) => serverFetch<ArticleDto>(`/v1/articles/${slug}`),
  },
  auth: { me: () => serverFetch<MeResponse>('/v1/auth/me') },
};
```

### 5.3 `lib/query-client.ts`
```ts
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './problem-details';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, err) =>
          err instanceof ApiError && err.status < 500 ? false : count < 1,
      },
      mutations: { retry: 0 },
    },
  });
}
```

### 5.4 `providers/app-providers.tsx`
```tsx
'use client';
import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-client';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';

export function AppProviders({ children }: { children: ReactNode }) {
  const [qc] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

---

## 6. Error + Loading Handling

### 6.1 Loading
- **Route-level**: `loading.tsx` per segment renders skeletons matching final layout (not spinners).
- **Component-level**: `<Suspense fallback={<ListSkeleton />}>` around the RSC data component for granular streaming.
- **Mutation**: button shows inline spinner + disabled state via `mutation.isPending`.

### 6.2 Errors
- **Route error boundary** `error.tsx` (client component) catches render/data errors per segment with a reset button.
- `ApiError` (from `problem-details.ts`) carries:
  ```ts
  class ApiError extends Error {
    status: number;
    code: string;
    correlationId?: string;
    issues?: { path: string; code: string; message: string }[];
  }
  ```
- **403**: render inline "You don't have permission" card; do not redirect.
- **401**: client redirect to `/login?next=<currentPath>`; Zustand auth store cleared.
- **404**: segment `not-found.tsx`.
- **5xx / network**: full-page `ErrorState` with `correlationId` shown + retry button.
- **Form errors**: `issues` mapped to field errors via react-hook-form `setError`.
- **Toasts (sonner)** for transient feedback; never for hard errors that need action.

### 6.3 Empty states
- `EmptyState` component with illustration + primary CTA (e.g. "Create your first article") — not blank screens.

### 6.4 Observability
- `window.onerror` + React error boundary → Sentry with `correlationId` tag.
- All `ApiError`s logged to Sentry at `warn`; 5xx at `error`.

---

## 7. End-to-End Feature — **Articles List**

### 7.1 Overview
User lands on `/articles`. The RSC prefetches page 1 with the current filters, hands the dehydrated cache to the client, which renders the list with `useInfiniteQuery` and loads further pages on scroll.

### 7.2 `features/articles/types.ts`
```ts
export type ArticleStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type ArticleVisibility = 'INTERNAL' | 'RESTRICTED' | 'PUBLIC';

export type ArticleListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: ArticleStatus;
  visibility: ArticleVisibility;
  author: { id: string; name: string };
  category: { id: string; name: string; slug: string } | null;
  tags: { slug: string; name: string }[];
  updatedAt: string;
  publishedAt: string | null;
  helpfulCount: number;
  notHelpfulCount: number;
};

export type ArticlesListQuery = {
  q?: string;
  category?: string;
  status?: ArticleStatus;
  cursor?: string;
  limit?: number;
};

export type ArticlesListResponse = {
  data: ArticleListItem[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
};
```

### 7.3 `features/articles/api.ts`
```ts
import { apiClient } from '@/lib/api-client';
import type { ArticlesListQuery, ArticlesListResponse } from './types';

export const articleKeys = {
  all: ['articles'] as const,
  lists: () => [...articleKeys.all, 'list'] as const,
  list: (filters: Omit<ArticlesListQuery, 'cursor'>) =>
    [...articleKeys.lists(), filters] as const,
  detail: (slug: string) => [...articleKeys.all, 'detail', slug] as const,
};

export function fetchArticles(q: ArticlesListQuery) {
  return apiClient.get<ArticlesListResponse>('/v1/articles', { query: q });
}
```

### 7.4 `features/articles/hooks.ts`
```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchArticles, articleKeys } from './api';
import type { ArticlesListQuery } from './types';

export function useArticlesInfinite(filters: Omit<ArticlesListQuery, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: articleKeys.list(filters),
    queryFn: ({ pageParam }) => fetchArticles({ ...filters, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
```

### 7.5 `server/dehydrate.ts`
```ts
import 'server-only';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import { serverApi } from './api';
import { articleKeys } from '@/features/articles/api';
import type { ArticlesListQuery } from '@/features/articles/types';

export async function prefetchArticlesList(filters: Omit<ArticlesListQuery, 'cursor'>) {
  const qc = new QueryClient();
  await qc.prefetchInfiniteQuery({
    queryKey: articleKeys.list(filters),
    queryFn: () => serverApi.articles.list({ ...filters, limit: 20 }),
    initialPageParam: undefined,
  });
  return dehydrate(qc);
}
```

### 7.6 `app/(app)/articles/page.tsx` (RSC)
```tsx
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchArticlesList } from '@/server/dehydrate';
import { ArticleList } from '@/components/article/article-list';
import { ArticleFilters } from '@/components/article/article-filters';
import { ArticleListSkeleton } from '@/components/article/article-list-skeleton';
import type { ArticleStatus } from '@/features/articles/types';

type SP = { q?: string; category?: string; status?: ArticleStatus };

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;                 // Next 16: async
  const filters = { q: sp.q, category: sp.category, status: sp.status };
  const dehydratedState = await prefetchArticlesList(filters);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Articles</h1>
        <ArticleFilters />
      </header>
      <HydrationBoundary state={dehydratedState}>
        <Suspense fallback={<ArticleListSkeleton />}>
          <ArticleList filters={filters} />
        </Suspense>
      </HydrationBoundary>
    </section>
  );
}
```

### 7.7 `app/(app)/articles/loading.tsx`
```tsx
import { ArticleListSkeleton } from '@/components/article/article-list-skeleton';
export default function Loading() {
  return <ArticleListSkeleton />;
}
```

### 7.8 `components/article/article-list.tsx` (client)
```tsx
'use client';
import { useEffect, useRef } from 'react';
import { useArticlesInfinite } from '@/features/articles/hooks';
import { ArticleCard } from './article-card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import type { ArticlesListQuery } from '@/features/articles/types';

type Props = { filters: Omit<ArticlesListQuery, 'cursor'> };

export function ArticleList({ filters }: Props) {
  const { data, error, isPending, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useArticlesInfinite(filters);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending) return null;                       // Suspense covers first load

  const items = data.pages.flatMap((p) => p.data);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No articles yet"
        description="Create your first article to get started."
        action={<Button asChild><a href="/articles/new">New article</a></Button>}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((a) => (
        <ArticleCard key={a.id} article={a} />
      ))}
      <div ref={sentinelRef} className="h-10" />
      {isFetchingNextPage && <div className="text-sm text-muted-foreground">Loading more…</div>}
    </div>
  );
}
```

### 7.9 `components/article/article-card.tsx`
```tsx
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelative } from '@/lib/format';
import type { ArticleListItem } from '@/features/articles/types';

export function ArticleCard({ article }: { article: ArticleListItem }) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">
            <Link href={`/articles/${article.slug}`} className="hover:underline">
              {article.title}
            </Link>
          </CardTitle>
          {article.summary && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
          )}
        </div>
        <Badge variant={article.status === 'PUBLISHED' ? 'default' : 'secondary'}>
          {article.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex gap-2">
          {article.category && <span>{article.category.name}</span>}
          {article.tags.slice(0, 3).map((t) => (
            <Badge key={t.slug} variant="outline" className="text-xs">{t.name}</Badge>
          ))}
        </div>
        <span>Updated {formatRelative(article.updatedAt)}</span>
      </CardContent>
    </Card>
  );
}
```

### 7.10 End-to-end recap (Articles List)

1. User navigates to `/articles?category=networking`.
2. `middleware.ts` validates the session cookie, sets CSP nonce and `x-correlation-id`.
3. `(app)/layout.tsx` RSC → `getSession()` hits `/v1/auth/me`; if null, redirect to login.
4. `articles/page.tsx` RSC awaits `searchParams` → builds filters → calls `prefetchArticlesList(filters)`.
5. `prefetchArticlesList` creates a per-request `QueryClient`, calls `serverApi.articles.list` (cookies forwarded, no cache), returns `dehydrate(qc)`.
6. Page renders `<HydrationBoundary>` with `<Suspense>` → initial HTML includes the skeleton then the streamed list.
7. On the client, `AppProviders` already owns a `QueryClient`; the hydrated cache lands under the same `articleKeys.list(filters)` key.
8. `ArticleList` mounts, `useArticlesInfinite(filters)` finds the hydrated page → **no extra fetch**; renders cards.
9. User scrolls → IntersectionObserver triggers `fetchNextPage` → `apiClient.get('/v1/articles', { query: { cursor, ... } })` → browser request to Express → JSON appended to cache.
10. Filter change → URL `searchParams` update (via `router.replace`) → new `filters` object → new query key → RQ fetches fresh page; cache for the old filter stays warm (GC after 5 min).
11. Any error → `ApiError` thrown in the query → `ErrorState` rendered with `correlationId` + retry; 401 → login redirect; 403 → inline permission notice.

---

## 8. Next Steps

1. Scaffold `providers/app-providers.tsx`, `lib/api-client.ts`, `lib/problem-details.ts`, `server/api.ts`.
2. Generate shadcn components we need (card, badge, button, sheet, command, sonner, skeleton, input, select).
3. Implement `features/articles/*` and the list page exactly as above against the Express API from Step 4.
4. Add Playwright tests: list renders, filter changes URL + results, infinite scroll, 401 redirect, error retry.
5. Move to Step 6 — forms, mutations, and the rich-text editor (Tiptap) for create/edit.
