# AI Writing Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five AI-assisted editing actions (draft, expand, simplify, steps, troubleshoot) to the KB article editor, powered by a local Ollama instance with no data leaving the internal network.

**Architecture:** Five Next.js 16 Route Handlers (one per action) receive a POST with `{ content: string }`, forward a streaming request to Ollama, strip the NDJSON wrapper, and pipe plain text back to the browser. A client hook reads the stream and calls `onChange` on each chunk, replacing editor content incrementally. An AI toolbar section in `MarkdownEditor` triggers the actions with per-button loading indicators and an undo button after completion.

**Tech Stack:** Next.js 16 Route Handlers · Ollama REST API (`/api/generate`) · React hooks · `sonner` (already wired) · `@uiw/react-codemirror` (already in editor) · Lucide React icons · shadcn `Button`, `Input`, `AlertDialog` (all already present)

---

## File Structure

**Create:**
| File | Responsibility |
|---|---|
| `apps/web/src/lib/ollama.ts` | Server-side only: build Ollama streaming request, parse NDJSON, return plain-text `Response` |
| `apps/web/src/app/api/ai/expand/route.ts` | POST handler — expand action |
| `apps/web/src/app/api/ai/simplify/route.ts` | POST handler — simplify action |
| `apps/web/src/app/api/ai/steps/route.ts` | POST handler — steps action |
| `apps/web/src/app/api/ai/troubleshoot/route.ts` | POST handler — troubleshoot action |
| `apps/web/src/app/api/ai/draft/route.ts` | POST handler — draft action |
| `apps/web/src/hooks/use-ai-action.ts` | Client hook: fires fetch, reads stream, calls `onChange`, manages loading + undo state |
| `apps/web/src/components/editor/ai-toolbar.tsx` | AI buttons, draft-topic dialog, undo button |

**Modify:**
| File | Change |
|---|---|
| `apps/web/.env.local` | Add `OLLAMA_BASE_URL` and `OLLAMA_MODEL` |
| `apps/web/src/components/editor/markdown-editor.tsx` | Add `<AiToolbar>` to the existing formatting toolbar |

---

## Task 1: Environment Variables

**Files:**
- Modify: `apps/web/.env.local`

- [ ] **Step 1: Check whether `.env.local` already exists**

```bash
ls apps/web/.env.local 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

- [ ] **Step 2: Add the two env vars (append if file exists, create if not)**

Open `apps/web/.env.local` in your editor and ensure it contains:

```env
OLLAMA_BASE_URL=http://100.105.154.6:11434
OLLAMA_MODEL=llama3.1:8b
```

If the file is new, create it with just those two lines. If it already has content, append to the end.

- [ ] **Step 3: Verify the vars are present**

```bash
grep -E "OLLAMA_(BASE_URL|MODEL)" apps/web/.env.local
```

Expected output:
```
OLLAMA_BASE_URL=http://100.105.154.6:11434
OLLAMA_MODEL=llama3.1:8b
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/.env.local
git commit -m "chore: add Ollama env vars to web .env.local"
```

---

## Task 2: Shared Ollama Streaming Utility

**Files:**
- Create: `apps/web/src/lib/ollama.ts`

This module is server-side only. It accepts a system prompt and user content, calls Ollama's `/api/generate` endpoint with streaming enabled, and returns a `Response` whose body is the extracted plain text (not raw NDJSON).

Ollama's streaming response is newline-delimited JSON. Each line looks like:
```
{"model":"llama3.1:8b","created_at":"...","response":" Hello","done":false}
```
When `done` is `true` the `response` field is empty and the line contains stats — skip it.

- [ ] **Step 1: Create the file**

Create `apps/web/src/lib/ollama.ts`:

```typescript
export function ollamaStream(systemPrompt: string, userContent: string): Response {
  const baseUrl = process.env.OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_MODEL;

  if (!baseUrl || !model) {
    return new Response("OLLAMA_BASE_URL or OLLAMA_MODEL not configured", { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let ollamaRes: globalThis.Response;
      try {
        ollamaRes = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model,
            system: systemPrompt,
            prompt: userContent,
            stream: true,
            think: false,
            options: { temperature: 0.3 },
          }),
        });
      } catch {
        controller.error(new Error("Could not reach Ollama"));
        return;
      }

      if (!ollamaRes.ok) {
        controller.error(new Error(`Ollama returned ${ollamaRes.status}`));
        return;
      }

      const reader = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as { response?: string; done?: boolean };
            if (chunk.response) {
              controller.enqueue(new TextEncoder().encode(chunk.response));
            }
          } catch {
            // malformed line — skip
          }
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If you see `Cannot find module` for env vars, that is expected — Next.js injects them at runtime.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/ollama.ts
git commit -m "feat: add shared Ollama streaming utility"
```

---

## Task 3: Route Handler — `expand` (canonical pattern)

**Files:**
- Create: `apps/web/src/app/api/ai/expand/route.ts`

Build the first route handler end-to-end so you can verify the full Ollama pipeline before creating the remaining four.

- [ ] **Step 1: Create the route handler**

Create `apps/web/src/app/api/ai/expand/route.ts`:

```typescript
import { ollamaStream } from "@/lib/ollama";

const SYSTEM_PROMPT =
  "You are a technical writer for IT documentation. Expand the following text with " +
  "more detail. Keep the tone and Markdown formatting. No preamble — output only " +
  "the expanded text.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const content: unknown = body?.content;

  if (typeof content !== "string" || !content.trim()) {
    return new Response("content is required", { status: 400 });
  }

  return ollamaStream(SYSTEM_PROMPT, content);
}
```

- [ ] **Step 2: Start the dev server**

```bash
cd apps/web && pnpm dev
```

Leave it running in a terminal.

- [ ] **Step 3: Smoke test with curl**

In a separate terminal:

```bash
curl -s -X POST http://localhost:3000/api/ai/expand \
  -H "content-type: application/json" \
  -d '{"content":"Restart the service."}' \
  --no-buffer
```

Expected: streaming text that expands the sentence into more detailed Markdown steps. You will see text appearing character by character (or in chunks). The response ends without a trailing newline.

If you get `500` with "OLLAMA_BASE_URL or OLLAMA_MODEL not configured" — the dev server didn't pick up `.env.local`. Restart it.

If you get `Could not reach Ollama` — confirm the Ollama host is reachable: `curl http://100.105.154.6:11434/api/tags`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/ai/expand/route.ts
git commit -m "feat: add /api/ai/expand route handler"
```

---

## Task 4: Route Handlers — `simplify`, `steps`, `troubleshoot`, `draft`

**Files:**
- Create: `apps/web/src/app/api/ai/simplify/route.ts`
- Create: `apps/web/src/app/api/ai/steps/route.ts`
- Create: `apps/web/src/app/api/ai/troubleshoot/route.ts`
- Create: `apps/web/src/app/api/ai/draft/route.ts`

Each file is identical to `expand/route.ts` — only the system prompt changes. The body contract is the same for all: `{ content: string }`. For `draft`, `content` is the article topic provided by the user.

- [ ] **Step 1: Create `simplify/route.ts`**

Create `apps/web/src/app/api/ai/simplify/route.ts`:

```typescript
import { ollamaStream } from "@/lib/ollama";

const SYSTEM_PROMPT =
  "Rewrite the following IT documentation in plainer language. Shorter sentences, " +
  "less jargon. Keep Markdown formatting. No preamble.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const content: unknown = body?.content;

  if (typeof content !== "string" || !content.trim()) {
    return new Response("content is required", { status: 400 });
  }

  return ollamaStream(SYSTEM_PROMPT, content);
}
```

- [ ] **Step 2: Create `steps/route.ts`**

Create `apps/web/src/app/api/ai/steps/route.ts`:

```typescript
import { ollamaStream } from "@/lib/ollama";

const SYSTEM_PROMPT =
  "Reformat the following as a Markdown numbered list. One action per step. " +
  "No preamble — output only the steps.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const content: unknown = body?.content;

  if (typeof content !== "string" || !content.trim()) {
    return new Response("content is required", { status: 400 });
  }

  return ollamaStream(SYSTEM_PROMPT, content);
}
```

- [ ] **Step 3: Create `troubleshoot/route.ts`**

Create `apps/web/src/app/api/ai/troubleshoot/route.ts`:

```typescript
import { ollamaStream } from "@/lib/ollama";

const SYSTEM_PROMPT =
  'Based on the following content, write a "## Troubleshooting" section in Markdown. ' +
  "3-5 common issues, each as a bold problem + solution. Start with ## Troubleshooting, " +
  "no preamble.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const content: unknown = body?.content;

  if (typeof content !== "string" || !content.trim()) {
    return new Response("content is required", { status: 400 });
  }

  return ollamaStream(SYSTEM_PROMPT, content);
}
```

- [ ] **Step 4: Create `draft/route.ts`**

Create `apps/web/src/app/api/ai/draft/route.ts`:

```typescript
import { ollamaStream } from "@/lib/ollama";

const SYSTEM_PROMPT =
  "You are a technical writer for IT support documentation. Write a Markdown how-to " +
  "for IT professionals. Use exactly these sections: ## Prerequisites, ## Steps " +
  "(numbered, one action each, commands in code blocks), ## Troubleshooting (3-4 " +
  "common issues), ## Notes. Second person, direct, no marketing language. " +
  "Output only the Markdown — no preamble.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const content: unknown = body?.content;

  if (typeof content !== "string" || !content.trim()) {
    return new Response("content is required", { status: 400 });
  }

  return ollamaStream(SYSTEM_PROMPT, content);
}
```

- [ ] **Step 5: Spot-check `draft` with curl**

```bash
curl -s -X POST http://localhost:3000/api/ai/draft \
  -H "content-type: application/json" \
  -d '{"content":"Installing OpenVPN on Windows 11"}' \
  --no-buffer
```

Expected: streaming Markdown with `## Prerequisites`, `## Steps`, `## Troubleshooting`, `## Notes` sections.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/ai/
git commit -m "feat: add route handlers for all five AI actions"
```

---

## Task 5: Client Streaming Hook

**Files:**
- Create: `apps/web/src/hooks/use-ai-action.ts`

The hook manages: firing the fetch, reading the stream and calling `onChange` each chunk, tracking which action is active, saving content before the run so it can be undone.

- [ ] **Step 1: Create the hook**

Create `apps/web/src/hooks/use-ai-action.ts`:

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export type AiAction = "draft" | "expand" | "simplify" | "steps" | "troubleshoot";

export function useAiAction(onChange: (value: string) => void) {
  const [activeAction, setActiveAction] = useState<AiAction | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const previousContentRef = useRef<string>("");

  const run = useCallback(
    async (action: AiAction, content: string, currentValue: string) => {
      previousContentRef.current = currentValue;
      setActiveAction(action);
      setCanUndo(false);

      try {
        const res = await fetch(`/api/ai/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          onChange(accumulated);
        }

        setCanUndo(true);
      } catch {
        toast.error("AI action failed. Is Ollama running?");
        onChange(previousContentRef.current);
      } finally {
        setActiveAction(null);
      }
    },
    [onChange],
  );

  const undo = useCallback(() => {
    onChange(previousContentRef.current);
    setCanUndo(false);
  }, [onChange]);

  return { run, undo, activeAction, canUndo };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-ai-action.ts
git commit -m "feat: add useAiAction streaming hook"
```

---

## Task 6: AI Toolbar Component

**Files:**
- Create: `apps/web/src/components/editor/ai-toolbar.tsx`

The toolbar renders five action buttons and an undo button. The `draft` action opens an AlertDialog to collect a topic before firing. All other actions fire immediately using the current editor value. While an action is active, the active button shows a spinner and all buttons are disabled.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/editor/ai-toolbar.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Wand2, AlignLeft, Minimize2, ListOrdered, Wrench, Undo2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAiAction, type AiAction } from "@/hooks/use-ai-action";

const ACTIONS: { id: AiAction; label: string; icon: React.ElementType }[] = [
  { id: "draft", label: "Draft", icon: Wand2 },
  { id: "expand", label: "Expand", icon: AlignLeft },
  { id: "simplify", label: "Simplify", icon: Minimize2 },
  { id: "steps", label: "Steps", icon: ListOrdered },
  { id: "troubleshoot", label: "Troubleshoot", icon: Wrench },
];

export function AiToolbar({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { run, undo, activeAction, canUndo } = useAiAction(onChange);
  const [draftOpen, setDraftOpen] = useState(false);
  const [topic, setTopic] = useState("");

  function handleAction(action: AiAction) {
    if (action === "draft") {
      setTopic("");
      setDraftOpen(true);
      return;
    }
    run(action, value, value);
  }

  function handleDraftSubmit() {
    if (!topic.trim()) return;
    setDraftOpen(false);
    run("draft", topic.trim(), value);
  }

  const isStreaming = activeAction !== null;

  return (
    <>
      <div className="flex items-center gap-0.5">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="xs"
            disabled={isStreaming}
            aria-busy={activeAction === id}
            title={label}
            onClick={() => handleAction(id)}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            {activeAction === id ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Icon className="size-3" />
            )}
            <span className="hidden text-[10px] uppercase tracking-[0.1em] sm:inline">
              {label}
            </span>
          </Button>
        ))}

        {canUndo && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={undo}
            title="Undo AI change"
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="size-3" />
            <span className="hidden text-[10px] uppercase tracking-[0.1em] sm:inline">
              Undo
            </span>
          </Button>
        )}
      </div>

      <AlertDialog open={draftOpen} onOpenChange={setDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Draft a new article</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            autoFocus
            placeholder="e.g. Installing OpenVPN on Windows 11"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDraftSubmit();
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!topic.trim()} onClick={handleDraftSubmit}>
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If you see "AlertDialog" not found — check the import path matches `apps/web/src/components/ui/alert-dialog.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/editor/ai-toolbar.tsx
git commit -m "feat: add AiToolbar component with draft dialog and undo"
```

---

## Task 7: Wire `AiToolbar` into `MarkdownEditor`

**Files:**
- Modify: `apps/web/src/components/editor/markdown-editor.tsx`

Add `<AiToolbar>` into the existing formatting toolbar, separated from the formatting buttons by a `<Divider>`, before the mode switcher that is pushed right with `ml-auto`.

- [ ] **Step 1: Add the import**

In `apps/web/src/components/editor/markdown-editor.tsx`, add this import at the top with the other component imports (after line 33, before the `cn` import):

```typescript
import { AiToolbar } from "@/components/editor/ai-toolbar";
```

- [ ] **Step 2: Add `<AiToolbar>` into the toolbar JSX**

In the toolbar `<div>` (the one with `className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5"`), locate the `{/* Mode switcher pushed to the right */}` comment (around line 217). Insert the following **immediately before** that comment:

```tsx
        <Divider />
        <AiToolbar value={value} onChange={onChange} />
```

The surrounding context should look like:

```tsx
        <ToolbarButton
          label="Image"
          onClick={() =>
            action((v) => replaceSelection(v, "![alt text](https://)"))
          }
        >
          <ImageIcon className="size-3.5" />
        </ToolbarButton>

        <Divider />
        <AiToolbar value={value} onChange={onChange} />

        {/* Mode switcher pushed to the right */}
        <div className="ml-auto flex items-center gap-0.5 border border-border p-0.5">
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test in browser**

With the dev server running at `http://localhost:3000`:

1. Navigate to an article edit page.
2. Confirm the five AI buttons (Draft, Expand, Simplify, Steps, Troubleshoot) appear in the toolbar, separated from the formatting buttons by a divider.
3. Type a sentence in the editor, then click **Expand**. Confirm the spinner appears on the button and the editor content streams in, replacing your sentence.
4. After streaming completes, confirm the **Undo** button appears. Click it. Confirm your original sentence is restored.
5. Click **Draft**. Confirm the dialog opens with a text field. Type a topic and press Enter. Confirm the editor streams in a full article draft.
6. Test with an empty editor: click **Simplify** with no content. The route handler should return 400, and you should see the "AI action failed" error toast.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/markdown-editor.tsx
git commit -m "feat: wire AiToolbar into MarkdownEditor"
```

---

## Self-Review

**Spec coverage:**
- [x] All five actions (draft, expand, simplify, steps, troubleshoot) — Tasks 3 & 4
- [x] OLLAMA_BASE_URL and OLLAMA_MODEL env vars, server-side only — Tasks 1 & 2
- [x] `{ stream: true, think: false, temperature: 0.3 }` defaults — `ollama.ts`
- [x] All five system prompts verbatim — Tasks 3 & 4
- [x] Toolbar buttons with loading indicator — Task 6
- [x] Error toast on failure — `useAiAction`
- [x] Replace behavior with undo — `useAiAction` + `AiToolbar`
- [x] Draft requires topic input — `AiToolbar` AlertDialog
- [x] Env vars never sent to browser — all env reads are in Route Handlers (`process.env`, not `NEXT_PUBLIC_`)

**No placeholders:** All steps contain complete code. No TBDs.

**Type consistency:**
- `AiAction` defined in `use-ai-action.ts`, imported in `ai-toolbar.tsx` ✓
- `run(action, content, currentValue)` — same signature in hook and call sites ✓
- `ollamaStream(systemPrompt, userContent)` — same signature in utility and all five route handlers ✓
