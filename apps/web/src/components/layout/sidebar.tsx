"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  LayoutDashboard,
  FolderTree,
  Search,
  Shield,
  FileText,
  Settings2,
  Trash2,
  Sparkles,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { UserAvatar } from "@/components/common/user-avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/categories";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
};

const primary: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/articles", label: "Articles", icon: FileText, count: 197 },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/search", label: "Search", icon: Search },
];

const admin: Item[] = [
  { href: "/trash", label: "Trash", icon: Trash2 },
  { href: "/admin/audit", label: "Audit log", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: categories = [] } = useCategories();

  return (
    <aside className="relative flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Workspace switcher */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <div className="grid size-7 place-items-center bg-primary text-primary-foreground">
          <BookOpen className="size-3.5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-foreground">
            Acme · IT Knowledge
          </span>
          <span className="truncate text-[10px] text-muted-foreground">
            workspace · production
          </span>
        </div>
        <ChevronRight className="ml-auto size-3 text-muted-foreground" />
      </div>

      {/* Search trigger — dispatches a window event picked up by CommandPalette. */}
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("kb:open-command-palette"))
        }
        className="mx-3 mt-3 flex h-8 items-center gap-2 border border-border bg-background px-2 text-xs text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <LayoutGroup id="sidebar">
        {/* Primary nav */}
        <nav className="mt-5 flex flex-col gap-0.5 px-2">
          <SectionLabel>Navigation</SectionLabel>
          {primary.map((item) => (
            <NavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        {/* Library */}
        <nav className="mt-5 flex flex-col gap-0.5 px-2">
          <SectionLabel>Library</SectionLabel>
          {categories.map((c) => {
            const href = `/categories/${c.slug}`;
            const active = pathname === href;
            return (
              <Link
                key={c.slug}
                href={href}
                className={cn(
                  "group relative flex h-7 items-center gap-2 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="size-1 rounded-full bg-muted-foreground/40 group-hover:bg-muted-foreground" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground/60">
                  {c.articleCount}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Admin */}
        <nav className="mt-5 flex flex-col gap-0.5 px-2">
          <SectionLabel>Admin</SectionLabel>
          {admin.map((item) => (
            <NavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
      </LayoutGroup>

      <div className="mt-auto border-t border-border p-3">
        <div className="flex items-center gap-2 border border-border bg-background px-2 py-2">
          <Sparkles className="size-3.5 text-primary" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[11px] font-medium text-foreground">
              AI assist · beta
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              Ask anything across the KB
            </span>
          </div>
          <Badge variant="accent" className="ml-auto">new</Badge>
        </div>
        <UserMenu />
      </div>
    </aside>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <div className="mt-3 flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
        Not signed in
      </div>
    );
  }

  return (
    <div className="relative mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-1 text-left transition-colors hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserAvatar name={user.name} size="default" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-xs font-medium">{user.name}</span>
          <span className="truncate text-[10px] text-muted-foreground">
            {user.email}
          </span>
        </div>
        <ChevronRight
          className={cn(
            "ml-auto size-3 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14 }}
            role="menu"
            className="absolute bottom-full left-0 right-0 mb-2 border border-border bg-background p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)]"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted/60"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
      {children}
    </div>
  );
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex h-8 items-center gap-2 px-2 text-xs transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-indicator"
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-primary"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <span
        className={cn(
          "absolute inset-0 -z-10 bg-muted/0 transition-colors",
          active && "bg-muted/60",
          "group-hover:bg-muted/40",
        )}
      />
      <Icon className={cn("size-3.5", active ? "text-foreground" : "text-muted-foreground")} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count !== undefined && (
        <span className="text-[10px] tabular-nums text-muted-foreground/60">
          {item.count}
        </span>
      )}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
