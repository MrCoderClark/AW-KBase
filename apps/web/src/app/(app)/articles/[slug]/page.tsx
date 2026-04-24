"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  ThumbsUp,
  Share2,
  Bookmark,
  Edit3,
  MoreHorizontal,
  Loader2,
  Send,
  Archive,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { FeedbackBar } from "@/components/article/feedback-bar";
import { TableOfContents } from "@/components/article/toc";
import {
  useArchiveArticle,
  useArticle,
  useDeleteArticle,
  usePublishArticle,
} from "@/lib/articles";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { HistoryDrawer } from "@/components/article/history-drawer";

export default function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Next.js 16: params is a Promise, unwrap with React's `use`.
  const { slug } = use(params);
  const { data: article, isLoading, error } = useArticle(slug);
  const { hasPermission } = useAuth();
  const router = useRouter();
  const publish = usePublishArticle();
  const archive = useArchiveArticle();
  const remove = useDeleteArticle();
  const [historyOpen, setHistoryOpen] = useState(false);

  if (error instanceof ApiError && error.status === 404) notFound();

  if (isLoading || !article) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-10">
        <div className="h-5 w-24 bg-muted animate-pulse" />
        <div className="mt-8 h-8 w-[60%] bg-muted animate-pulse" />
        <div className="mt-3 h-4 w-[80%] bg-muted animate-pulse" />
        <div className="mt-10 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 w-full bg-muted/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const helpRate =
    article.helpfulCount + article.notHelpfulCount > 0
      ? Math.round(
        (article.helpfulCount /
          (article.helpfulCount + article.notHelpfulCount)) *
        100,
      )
      : null;

  return (
    <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-6 py-10 md:px-10 xl:grid-cols-[1fr_220px]">
      <article className="min-w-0">
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          All articles
        </Link>

        {/* Header */}
        <header className="mt-6 border-b border-border pb-8">
          <div className="flex flex-wrap items-center gap-2">
            {article.category && (
              <Badge variant="subtle">{article.category.name}</Badge>
            )}
            <Badge
              variant={article.status === "PUBLISHED" ? "success" : "warning"}
            >
              {article.status.replace("_", " ").toLowerCase()}
            </Badge>
            <Badge variant="outline">{article.visibility.toLowerCase()}</Badge>
          </div>
          <h1 className="mt-4 text-3xl leading-[1.2] font-semibold tracking-tight text-foreground md:text-[34px]">
            {article.title}
          </h1>
          {article.summary && (
            <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
              {article.summary}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {article.author && (
                <>
                  <UserAvatar name={article.author.name} size="lg" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs font-medium text-foreground">
                      {article.author.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Last updated {formatDate(article.updatedAt)}
                    </span>
                  </div>
                </>
              )}
              <span className="mx-2 h-4 w-px bg-border" />
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  v{article.currentVersion?.versionNo ?? 1}
                </span>
                {helpRate !== null && (
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="size-3" />
                    {helpRate}% helpful
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Bookmark">
                <Bookmark />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Share">
                <Share2 />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontal />
              </Button>
              <span className="mx-1 h-5 w-px bg-border" />
              <Button variant="outline" asChild>
                <Link href={`/articles/${article.slug}/edit`}>
                  <Edit3 className="size-3.5" />
                  Edit
                </Link>
              </Button>
              {hasPermission("article:delete") && (
                <ConfirmDialog
                  title="Move to trash?"
                  description={
                    <>
                      <span className="font-medium text-foreground">
                        {article.title}
                      </span>{" "}
                      will be moved to the trash and hidden from all listings.
                      You can restore it from{" "}
                      <span className="font-mono">/trash</span> for as long as
                      it hasn&apos;t been purged.
                    </>
                  }
                  confirmLabel="Move to trash"
                  destructive
                  onConfirm={async () => {
                    try {
                      await remove.mutateAsync(article.id);
                      toast.success("Article moved to trash", {
                        description: article.title,
                      });
                      router.push("/articles");
                    } catch (err) {
                      toast.error("Couldn't move to trash", {
                        description:
                          err instanceof ApiError
                            ? err.problem.detail || err.problem.title
                            : "Unexpected error.",
                      });
                      throw err;
                    }
                  }}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete"
                      disabled={remove.isPending}
                    >
                      {remove.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  }
                />
              )}
              {article.status !== "ARCHIVED" &&
                hasPermission("article:archive") && (
                  <ConfirmDialog
                    title="Archive this article?"
                    description="It will be hidden from the default article list but remains accessible by direct link and can be unarchived later."
                    confirmLabel="Archive"
                    onConfirm={async () => {
                      try {
                        await archive.mutateAsync(article.id);
                        toast.success("Article archived", {
                          description: article.title,
                        });
                      } catch (err) {
                        toast.error("Couldn't archive article", {
                          description:
                            err instanceof ApiError
                              ? err.problem.detail || err.problem.title
                              : "Unexpected error.",
                        });
                        throw err;
                      }
                    }}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Archive"
                        disabled={archive.isPending}
                      >
                        {archive.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Archive />
                        )}
                      </Button>
                    }
                  />
                )}
              {article.status !== "PUBLISHED" &&
                hasPermission("article:publish") && (
                  <Button
                    size="default"
                    disabled={publish.isPending}
                    onClick={async () => {
                      try {
                        await publish.mutateAsync(article.id);
                        toast.success("Article published", {
                          description: article.title,
                        });
                      } catch (err) {
                        toast.error("Couldn't publish", {
                          description:
                            err instanceof ApiError
                              ? err.problem.detail || err.problem.title
                              : "Unexpected error.",
                        });
                      }
                    }}
                  >
                    {publish.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Publish
                  </Button>
                )}
            </div>
          </div>
        </header>

        {/* Body — server-sanitized HTML rendered as-is. */}
        {article.currentVersion?.contentHtml ? (
          <div
            className="markdown-body mt-8 max-w-none"
            dangerouslySetInnerHTML={{ __html: article.currentVersion.contentHtml }}
          />
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            This article doesn&apos;t have any content yet.
          </p>
        )}

        {/* Feedback */}
        <FeedbackBar
          articleId={article.id}
          slug={article.slug}
          helpful={article.helpfulCount}
          notHelpful={article.notHelpfulCount}
        />
      </article>

      {/* Right rail TOC */}
      <aside className="hidden xl:block">
        <TableOfContents />
      </aside>

      <HistoryDrawer
        articleId={article.id}
        currentVersionNo={article.currentVersion?.versionNo ?? null}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
