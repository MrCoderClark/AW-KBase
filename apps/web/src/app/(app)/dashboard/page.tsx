"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowRight, ThumbsUp, Clock, FileText, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useArticles } from "@/lib/articles";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: publishedData } = useArticles({ status: "PUBLISHED", limit: 4 });
  const { data: draftsData } = useArticles({ status: "DRAFT", limit: 3 });
  const { data: reviewData } = useArticles({ status: "IN_REVIEW", limit: 50 });
  const { data: allData } = useArticles({ limit: 100 });

  const top = publishedData?.data ?? [];
  const drafts = [
    ...(draftsData?.data ?? []),
    ...(reviewData?.data ?? []),
  ].slice(0, 3);

  const all = allData?.data ?? [];
  const totalArticles = all.length;
  const activeArticles = all.filter((a) => a.status === "PUBLISHED").length;
  const unresolvedReviews = reviewData?.data.length ?? 0;
  const { helpful, notHelpful } = all.reduce(
    (acc, a) => ({
      helpful: acc.helpful + a.helpfulCount,
      notHelpful: acc.notHelpful + a.notHelpfulCount,
    }),
    { helpful: 0, notHelpful: 0 },
  );
  const helpRate =
    helpful + notHelpful > 0
      ? `${Math.round((helpful / (helpful + notHelpful)) * 100)}%`
      : "—";

  const firstName = user?.name.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-10">
      {/* Hero */}
      <section className="flex flex-col gap-8 border-b border-border pb-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="subtle">{today}</Badge>
              <Badge variant="accent">
                <Sparkles className="size-3" />
                {activeArticles} published
              </Badge>
            </div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground md:text-3xl">
              Welcome back, {firstName}.
              <br />
              <span className="text-muted-foreground">
                Here&apos;s what your team is resolving today.
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <FileText className="size-3.5" />
              Open queue
            </Button>
            <Button asChild>
              <Link href="/articles/new">
                <Plus className="size-3.5" />
                New article
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-4">
          <Kpi
            label="Active articles"
            value={String(activeArticles)}
            delta={`of ${totalArticles}`}
            tone="accent"
          />
          <Kpi label="Avg. helpful rate" value={helpRate} delta="lifetime" tone="success" />
          <Kpi
            label="In review"
            value={String(unresolvedReviews)}
            delta={unresolvedReviews > 0 ? "needs attention" : "all clear"}
            tone={unresolvedReviews > 0 ? "warning" : "success"}
          />
          <Kpi
            label="Drafts"
            value={String(draftsData?.data.length ?? 0)}
            delta="yours + team"
            tone="accent"
          />
        </div>
      </section>

      {/* Two column */}
      <section className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.5fr_1fr]">
        {/* Top articles */}
        <div>
          <SectionHeader
            title="Top performing this week"
            href="/articles?sort=views"
            cta="See all articles"
          />
          <div className="mt-4 divide-y divide-border border-y border-border">
            {top.length === 0 && (
              <div className="px-2 py-8 text-xs text-muted-foreground">
                No published articles yet.
              </div>
            )}
            {top.map((a, i) => {
              const rate =
                a.helpfulCount + a.notHelpfulCount > 0
                  ? Math.round(
                    (a.helpfulCount /
                      (a.helpfulCount + a.notHelpfulCount)) *
                    100,
                  )
                  : null;
              return (
                <Link
                  key={a.id}
                  href={`/articles/${a.slug}`}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 px-2 py-4 transition-colors hover:bg-muted/40"
                >
                  <span className="w-6 text-right text-xs tabular-nums text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                      {a.title}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{a.category?.name ?? "Uncategorized"}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="size-3" />
                        {a.helpfulCount}
                      </span>
                      {rate !== null && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="inline-flex items-center gap-1">
                            {rate}% helpful
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="size-3.5 text-muted-foreground/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-8">
          <div>
            <SectionHeader title="In your queue" href="/articles?status=DRAFT" cta="Open queue" />
            <div className="mt-4 space-y-3">
              {drafts.length === 0 && (
                <div className="border border-dashed border-border p-4 text-xs text-muted-foreground">
                  Nothing in the queue.
                </div>
              )}
              {drafts.map((a) => (
                <Link
                  key={a.id}
                  href={`/articles/${a.slug}`}
                  className="group block border border-border bg-sidebar/40 p-3 transition-colors hover:border-ring/40"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={a.status === "IN_REVIEW" ? "warning" : "subtle"}
                    >
                      {a.status.replace("_", " ").toLowerCase()}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      <Clock className="mr-1 inline size-3" />
                      {relative(a.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {a.title}
                  </div>
                  {a.summary && (
                    <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {a.summary}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader title="Recently updated" />
            <ul className="mt-4 space-y-3">
              {all.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="grid size-6 shrink-0 place-items-center border border-border bg-muted/40">
                    <FileText className="size-3 text-muted-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-col leading-snug">
                    <Link
                      href={`/articles/${a.slug}`}
                      className="truncate text-xs font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {a.title}
                    </Link>
                    <span className="text-[10px] text-muted-foreground">
                      {a.author?.name ?? "System"} · {relative(a.updatedAt)}
                    </span>
                  </div>
                </li>
              ))}
              {all.length === 0 && (
                <li className="text-xs text-muted-foreground">No activity yet.</li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  href,
  cta,
}: {
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {href && cta && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {cta}
          <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "accent" | "success" | "warning";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-primary";
  return (
    <div className="relative bg-background px-5 py-5">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span className={`text-[11px] tabular-nums ${toneCls}`}>{delta}</span>
      </div>
      <div className="mt-4 flex h-6 items-end gap-0.5">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className="w-1 bg-foreground/10 transition-colors last:bg-primary/60"
          />
        ))}
      </div>
    </div>
  );
}

const bars = [22, 38, 28, 48, 34, 60, 52, 72, 46, 68, 58, 82];

function relative(iso: string) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.floor((now - t) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / (60 * 24))}d ago`;
}
