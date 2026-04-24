"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/user-avatar";
import { cn } from "@/lib/utils";

export function Topbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    setDark(el.classList.contains("dark"));
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const el = document.documentElement;
    const next = !el.classList.contains("dark");
    el.classList.toggle("dark", next);
    setDark(next);
  };

  const crumbs = buildCrumbs(pathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[52px] items-center gap-4 border-b border-border px-6 backdrop-blur-md transition-colors",
        scrolled ? "bg-background/85" : "bg-background/60",
      )}
    >
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
        {crumbs.map((c, i) => (
          <span key={`${i}-${c.href}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/40">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="truncate text-foreground">{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Global search */}
      <button
        type="button"
        className="ml-auto hidden h-8 w-[380px] items-center gap-2 border border-border bg-muted/40 px-2.5 text-xs text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground lg:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search articles, people, categories…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 lg:ml-0">
        <Button variant="ghost" size="icon-sm" aria-label="Search" className="lg:hidden">
          <Search />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={toggleTheme}>
          {dark ? <Sun /> : <Moon />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
          <Bell />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
        </Button>
        <button
          type="button"
          className="ml-2 flex items-center gap-2 border border-border bg-background px-1.5 py-1 text-xs transition-colors hover:border-ring/40"
        >
          <UserAvatar name="Jane Doe" size="sm" />
          <span className="hidden text-muted-foreground md:inline">Jane</span>
        </button>
      </div>
    </header>
  );
}

function buildCrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: "Acme IT", href: "/dashboard" }];
  let acc = "";
  for (const p of parts) {
    acc += "/" + p;
    crumbs.push({ label: humanize(p), href: acc });
  }
  return crumbs;
}

function humanize(s: string) {
  if (s === "articles") return "Articles";
  if (s === "dashboard") return "Dashboard";
  if (s === "new") return "New";
  if (s === "categories") return "Categories";
  if (s === "search") return "Search";
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
