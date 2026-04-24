"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, History, Star, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useArticleVersions,
  useArticleVersion,
  type ArticleVersionSummary,
} from "@/lib/articles";

/**
 * Right-side slide-out that lists every revision of an article and renders the
 * selected version's sanitized HTML inline on the right pane. Does not load
 * version content until a row is clicked, so the initial open is cheap even
 * for articles with many revisions.
 */
export function HistoryDrawer({
  articleId,
  currentVersionNo,
  open,
  onOpenChange,
}: {
  articleId: string;
  currentVersionNo: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: versions = [], isLoading } = useArticleVersions(
    open ? articleId : undefined,
  );
  const [selected, setSelected] = useState<number | null>(null);
  const selectedVersionNo = selected ?? versions[0]?.versionNo ?? null;
  const { data: versionDetail, isFetching: versionLoading } = useArticleVersion(
    open ? articleId : undefined,
    selectedVersionNo ?? undefined,
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[960px] flex-col border-l border-border bg-background shadow-[0_0_60px_rgba(0,0,0,0.35)]"
            role="dialog"
            aria-label="Version history"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Version history
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {versions.length} revision{versions.length === 1 ? "" : "s"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </header>

            <div className="flex min-h-0 flex-1">
              <div className="w-[300px] shrink-0 overflow-y-auto border-r border-border">
                {isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse bg-muted/50"
                      />
                    ))}
                  </div>
                ) : versions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No revisions yet.
                  </div>
                ) : (
                  <ul>
                    {versions.map((v) => (
                      <VersionRow
                        key={v.id}
                        version={v}
                        active={v.versionNo === selectedVersionNo}
                        isCurrent={v.versionNo === currentVersionNo}
                        onClick={() => setSelected(v.versionNo)}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
                {selectedVersionNo === null ? (
                  <div className="m-auto text-xs text-muted-foreground">
                    Select a revision to preview.
                  </div>
                ) : versionLoading || !versionDetail ? (
                  <div className="m-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading v{selectedVersionNo}…
                  </div>
                ) : (
                  <VersionPreview
                    detail={versionDetail}
                    isCurrent={selectedVersionNo === currentVersionNo}
                  />
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function VersionRow({
  version,
  active,
  isCurrent,
  onClick,
}: {
  version: ArticleVersionSummary;
  active: boolean;
  isCurrent: boolean;
  onClick: () => void;
}) {
  const when = new Date(version.createdAt);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
          active && "bg-muted/60 hover:bg-muted/60",
        )}
      >
        <div className="flex w-full items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            v{version.versionNo}
          </span>
          {version.isMajor && (
            <Badge variant="accent" className="text-[9px]">
              <Star className="size-2" />
              major
            </Badge>
          )}
          {isCurrent && (
            <Badge variant="success" className="text-[9px]">
              current
            </Badge>
          )}
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/80">
            {when.toLocaleDateString()}
          </span>
        </div>
        <span className="line-clamp-1 text-[12px] text-foreground">
          {version.title}
        </span>
        {version.editor && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="size-2.5" />
            {version.editor.name}
            <span>·</span>
            <span>
              {when.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </span>
        )}
      </button>
    </li>
  );
}

function VersionPreview({
  detail,
  isCurrent,
}: {
  detail: {
    versionNo: number;
    title: string;
    summary: string | null;
    contentHtml: string;
    createdAt: string;
    editor: { name: string } | null;
  };
  isCurrent: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-3 border-b border-border px-6 py-3 text-xs backdrop-blur",
          isCurrent ? "bg-background" : "bg-amber-500/10",
        )}
      >
        <span className="font-mono text-muted-foreground">
          v{detail.versionNo}
        </span>
        <span className="text-muted-foreground">
          {new Date(detail.createdAt).toLocaleString()}
        </span>
        {detail.editor && (
          <span className="text-muted-foreground">· {detail.editor.name}</span>
        )}
        {!isCurrent && (
          <span className="ml-auto text-[11px] text-amber-700 dark:text-amber-400">
            Viewing historical revision
          </span>
        )}
      </div>

      <article className="px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {detail.title}
        </h1>
        {detail.summary && (
          <p className="mt-2 text-sm text-muted-foreground">{detail.summary}</p>
        )}
        <div
          className="prose prose-sm mt-6 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:text-xs prose-code:text-xs dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: detail.contentHtml }}
        />
      </article>
    </div>
  );
}
