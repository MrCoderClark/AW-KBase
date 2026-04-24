"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Loader2, CornerDownLeft } from "lucide-react";
import { useSearch } from "@/lib/search";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * Global ⌘K / Ctrl+K command palette. Lives at the app-shell level so it's
 * available from every route. Searches articles via the existing
 * `GET /v1/articles?q=` endpoint (the backend already supports ILIKE on
 * title/summary) and navigates to the selected result.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();

  // Debounce the query so we don't spam the API on every keystroke.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 150);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useSearch({
    q: debounced,
    limit: 8,
  });
  const results = data?.hits ?? [];

  // Global hotkey: ⌘K / Ctrl+K to open; Esc to close. Also listens for a
  // `kb:open-command-palette` custom event so non-keyboard triggers (e.g. the
  // sidebar search button) can open the palette without prop drilling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("kb:open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("kb:open-command-palette", onOpen);
    };
  }, []);

  // Reset when opening/closing.
  useEffect(() => {
    if (!open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  // Clamp the active index when results change.
  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results.length, active]);

  function pick(index: number) {
    const r = results[index];
    if (!r) return;
    router.push(`/articles/${r.slug}`);
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[640px] border border-border bg-background shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search articles by title or summary…"
                className="h-11 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    pick(active);
                  }
                }}
              />
              {isFetching && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
              <Kbd>Esc</Kbd>
            </div>

            <div className="max-h-[50vh] overflow-auto py-1">
              {results.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {debounced
                    ? "No articles match that query."
                    : "Start typing to search."}
                </div>
              )}
              {results.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(i)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                    i === active ? "bg-muted/60" : "hover:bg-muted/40",
                  )}
                >
                  <div className="grid size-7 shrink-0 place-items-center border border-border bg-muted/40">
                    <FileText className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm text-foreground">
                      {a.title}
                    </span>
                    <span
                      className="truncate text-[11px] text-muted-foreground [&_mark]:bg-primary/20 [&_mark]:text-foreground"
                      // Snippet is pre-sanitized server-side; only `<mark>` tags are emitted.
                      dangerouslySetInnerHTML={{
                        __html: [
                          a.category?.name ?? "Uncategorized",
                          a.snippet || a.summary || "",
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      }}
                    />
                  </div>
                  {i === active && (
                    <CornerDownLeft className="ml-auto size-3 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↵</Kbd> open
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
