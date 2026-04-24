"use client";

import { useEffect, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";

type Heading = { id: string; text: string; level: 2 | 3 };

export function TableOfContents() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLHeadingElement>(".prose-canvas h2, .prose-canvas h3"),
    );
    setHeadings(
      nodes.map((n) => ({
        id: n.id,
        text: n.textContent ?? "",
        level: n.tagName === "H2" ? 2 : 3,
      })),
    );
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 1] },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="sticky top-[72px]">
      <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        On this page
      </div>
      <LayoutGroup id="toc">
        <ul className="flex flex-col gap-0.5">
          {headings.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={cn(
                  "relative block py-1 pl-3 text-[11.5px] leading-snug transition-colors",
                  h.level === 3 && "pl-6",
                  active === h.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active === h.id && (
                  <motion.span
                    layoutId="toc-indicator"
                    className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </LayoutGroup>
    </nav>
  );
}
