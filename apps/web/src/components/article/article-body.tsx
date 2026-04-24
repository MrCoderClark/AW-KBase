import { cn } from "@/lib/utils";

type Props = { markdown: string };

/**
 * Minimal markdown-to-JSX renderer for the demo. In production this becomes
 * server-rendered sanitized HTML from the API (see docs/ui-system.md §7.4).
 */
export function ArticleBody({ markdown }: Props) {
  const blocks = parseMarkdown(markdown);
  return (
    <div className="prose-canvas mt-8 max-w-[72ch]">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h2":
            return (
              <h2
                key={i}
                id={slugify(b.text)}
                className="mt-10 scroll-mt-24 text-xl font-semibold tracking-tight text-foreground"
              >
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={i}
                id={slugify(b.text)}
                className="mt-8 scroll-mt-24 text-base font-semibold text-foreground"
              >
                {b.text}
              </h3>
            );
          case "p":
            return (
              <p
                key={i}
                className="mt-4 text-[15px] leading-[1.75] text-foreground/80"
                dangerouslySetInnerHTML={{ __html: inline(b.text) }}
              />
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="mt-6 border-l-2 border-primary bg-muted/40 px-4 py-3 text-[14px] leading-relaxed text-foreground"
                dangerouslySetInnerHTML={{ __html: inline(b.text) }}
              />
            );
          case "ol":
            return (
              <ol key={i} className="mt-4 ml-5 list-decimal space-y-1.5 text-[15px] leading-relaxed text-foreground/80 marker:text-muted-foreground marker:tabular-nums">
                {b.items.map((it, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: inline(it) }} />
                ))}
              </ol>
            );
          case "ul":
            return (
              <ul key={i} className="mt-4 ml-5 list-disc space-y-1.5 text-[15px] leading-relaxed text-foreground/80 marker:text-muted-foreground">
                {b.items.map((it, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: inline(it) }} />
                ))}
              </ul>
            );
          case "code":
            return (
              <div
                key={i}
                className="group relative mt-5 overflow-hidden border border-border bg-muted/40"
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>{b.lang ?? "bash"}</span>
                  <button className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100">
                    copy
                  </button>
                </div>
                <pre className="overflow-x-auto px-4 py-3 text-[12.5px] leading-[1.7] text-foreground/90">
                  <code>{b.text}</code>
                </pre>
              </div>
            );
        }
      })}
    </div>
  );
}

type Block =
  | { kind: "h2" | "h3" | "p" | "quote"; text: string }
  | { kind: "ol" | "ul"; items: string[] }
  | { kind: "code"; text: string; lang?: string };

function parseMarkdown(md: string): Block[] {
  const lines = md.split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || undefined;
      const start = ++i;
      while (i < lines.length && !lines[i].startsWith("```")) i++;
      out.push({ kind: "code", lang, text: lines.slice(start, i).join("\n") });
      i++;
      continue;
    }
    if (line.startsWith("## ")) { out.push({ kind: "h2", text: line.slice(3) }); i++; continue; }
    if (line.startsWith("### ")) { out.push({ kind: "h3", text: line.slice(4) }); i++; continue; }
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { buf.push(lines[i].slice(2)); i++; }
      out.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      out.push({ kind: "ol", items });
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push({ kind: "ul", items });
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push({ kind: "p", text: buf.join(" ") });
  }
  return out;
}

function isBlockStart(l: string) {
  return /^(#{1,6} |> |- |\d+\.\s|```)/.test(l);
}

function inline(s: string) {
  return s
    .replace(/`([^`]+)`/g, '<code class="bg-muted/70 border border-border px-1 py-0.5 text-[12.5px]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary">$1</a>');
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ensure `cn` import isn't removed by optimizers
void cn;
