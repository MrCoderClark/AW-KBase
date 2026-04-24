"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag as TagIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTags } from "@/lib/tags";

/**
 * Simple multi-select tag combobox. Works on tag **slugs** since that's what
 * the articles API accepts (see CreateArticleBody.tagSlugs). Unknown slugs
 * typed by the user are allowed — the server will upsert them on save.
 */
export function TagPicker({
  value,
  onChange,
  max = 20,
  placeholder = "Add a tag…",
}: {
  value: string[];
  onChange: (slugs: string[]) => void;
  max?: number;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allTags = [] } = useTags(input || undefined);

  // Close the suggestions list when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const suggestions = useMemo(() => {
    const selected = new Set(value);
    return allTags.filter((t) => !selected.has(t.slug)).slice(0, 8);
  }, [allTags, value]);

  const typedSlug = toSlug(input);
  const canAddTyped =
    typedSlug.length > 0 &&
    !value.includes(typedSlug) &&
    !allTags.some((t) => t.slug === typedSlug);

  function add(slug: string) {
    const s = toSlug(slug);
    if (!s || value.includes(s) || value.length >= max) return;
    onChange([...value, s]);
    setInput("");
  }

  function remove(slug: string) {
    onChange(value.filter((s) => s !== slug));
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex min-h-8 flex-wrap items-center gap-1.5 border border-border bg-background px-1.5 py-1 text-xs transition-colors",
          open && "border-ring/50",
        )}
        onClick={() => setOpen(true)}
      >
        <TagIcon className="ml-1 size-3 text-muted-foreground/70" />
        {value.map((slug) => (
          <span
            key={slug}
            className="inline-flex items-center gap-1 border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] text-foreground"
          >
            {slug}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(slug);
              }}
              className="text-muted-foreground transition-colors hover:text-destructive"
              aria-label={`Remove ${slug}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (suggestions[0]) add(suggestions[0].slug);
              else if (canAddTyped) add(typedSlug);
            }
            if (e.key === "Backspace" && input === "" && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[80px] flex-1 bg-transparent py-0.5 text-[11px] placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>

      <AnimatePresence>
        {open && (suggestions.length > 0 || canAddTyped) && (
          <motion.ul
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-auto border border-border bg-background p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)]"
          >
            {suggestions.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => add(t.slug)}
                  className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-muted/60"
                >
                  <span className="text-foreground">{t.name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {t.articleCount}
                  </span>
                </button>
              </li>
            ))}
            {canAddTyped && (
              <li>
                <button
                  type="button"
                  onClick={() => add(typedSlug)}
                  className="flex w-full items-center gap-2 border-t border-border px-2 py-1.5 text-left text-[11px] text-primary transition-colors hover:bg-muted/60"
                >
                  <Plus className="size-3" />
                  Create tag{" "}
                  <span className="font-medium text-foreground">
                    {typedSlug}
                  </span>
                </button>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** URL-safe slug: lowercase, hyphenated, alphanumerics only. */
function toSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
