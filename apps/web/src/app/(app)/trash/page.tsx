"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Undo2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useArticles,
  usePurgeArticle,
  useRestoreArticle,
} from "@/lib/articles";

export default function TrashPage() {
  const router = useRouter();
  const { hasPermission, isLoading: authLoading } = useAuth();
  const { data, isLoading } = useArticles({ trashed: true, limit: 50 });
  const restore = useRestoreArticle();
  const purge = usePurgeArticle();

  if (!authLoading && !hasPermission("article:delete")) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <div className="flex items-center gap-3 border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <div>
            <div className="font-medium">Forbidden</div>
            <div className="text-[12px] text-destructive/80">
              You don&apos;t have permission to view trashed articles.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rows = data?.data ?? [];

  return (
    <div className="mx-auto max-w-[960px] px-6 py-10 md:px-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid size-8 place-items-center border border-border bg-muted/40">
          <Trash2 className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Trash
          </h1>
          <p className="text-xs text-muted-foreground">
            Soft-deleted articles. Restore them, or purge permanently.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Trash is empty.
        </div>
      ) : (
        <ul className="flex flex-col border border-border">
          {rows.map((a, i) => (
            <li
              key={a.id}
              className={
                i > 0 ? "border-t border-border" : undefined
              }
            >
              <div className="flex items-start gap-3 px-3 py-3">
                <div className="mt-0.5 grid size-7 shrink-0 place-items-center border border-border bg-muted/40">
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {a.title}
                  </span>
                  {a.summary && (
                    <span className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed text-muted-foreground">
                      {a.summary}
                    </span>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/80">
                    <span>
                      Updated {new Date(a.updatedAt).toLocaleDateString()}
                    </span>
                    {a.category && (
                      <>
                        <span>·</span>
                        <span>{a.category.name}</span>
                      </>
                    )}
                    {a.author?.name && (
                      <>
                        <span>·</span>
                        <span>by {a.author.name}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={restore.isPending}
                    onClick={async () => {
                      try {
                        const updated = await restore.mutateAsync(a.id);
                        toast.success("Article restored", {
                          description: updated.title,
                          action: {
                            label: "Open",
                            onClick: () =>
                              router.push(`/articles/${updated.slug}`),
                          },
                        });
                      } catch (err) {
                        toast.error("Couldn't restore", {
                          description:
                            err instanceof ApiError
                              ? err.problem.detail || err.problem.title
                              : "Unexpected error.",
                        });
                      }
                    }}
                  >
                    <Undo2 className="size-3.5" />
                    Restore
                  </Button>

                  <ConfirmDialog
                    title="Purge permanently?"
                    description={
                      <>
                        <span className="font-medium text-foreground">
                          {a.title}
                        </span>{" "}
                        and its entire version history, tags, and feedback will
                        be deleted forever. This cannot be undone.
                      </>
                    }
                    confirmLabel="Purge forever"
                    destructive
                    onConfirm={async () => {
                      try {
                        await purge.mutateAsync(a.id);
                        toast.success("Article purged", {
                          description: a.title,
                        });
                      } catch (err) {
                        toast.error("Couldn't purge", {
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
                        size="sm"
                        disabled={purge.isPending}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                        Purge
                      </Button>
                    }
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
