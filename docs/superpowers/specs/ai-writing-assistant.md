# AI Writing Assistant — Spec

> Local Ollama integration for the KB editor. Provides five AI-assisted editing actions without sending data to any external API.

---

## 1. Overview

The AI writing assistant adds a toolbar to the article editor that lets IT writers invoke Ollama actions on the current document content. All inference runs on the local Ollama instance — no data leaves the internal network.

**Actions:** `draft` · `expand` · `simplify` · `steps` · `troubleshoot`

---

## 2. Environment

| Variable | Value | Notes |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://100.105.154.6:11434` | Server-side only, never shipped to browser |
| `OLLAMA_MODEL` | `llama3.1:8b` | Confirmed default. `qwen3:4b` = faster/lower quality; `gemma4:e2b` = richer prose |

Both variables live in `apps/web/.env.local`.

---

## 3. Request Defaults

All actions use these Ollama parameters:

```json
{ "stream": true, "think": false, "temperature": 0.3 }
```

`temperature: 0.3` keeps output consistent and factual — appropriate for IT documentation.

---

## 4. Route Handlers

One Route Handler per action, all under `apps/web/src/app/api/ai/`:

```
apps/web/src/app/api/ai/
├── draft/route.ts
├── expand/route.ts
├── simplify/route.ts
├── steps/route.ts
└── troubleshoot/route.ts
```

Each handler:
1. Reads `OLLAMA_BASE_URL` and `OLLAMA_MODEL` from `process.env`
2. Accepts a POST body with `{ content: string }` (and `{ topic: string }` for `draft`)
3. Forwards a streaming request to Ollama with the action's system prompt
4. Pipes the Ollama stream back to the client as a `text/event-stream` response

> **Timeout note:** llama3.1:8b streams fast enough to stay under Vercel's default 60 s limit. If the model is swapped to a larger one (gemma4:e4b, glm-4.7-flash), add `export const maxDuration = 60` to the Route Handler.

---

## 5. System Prompts

### `draft`
```
You are a technical writer for IT support documentation. Write a Markdown how-to
for IT professionals. Use exactly these sections: ## Prerequisites, ## Steps
(numbered, one action each, commands in code blocks), ## Troubleshooting (3-4
common issues), ## Notes. Second person, direct, no marketing language.
Output only the Markdown — no preamble.
```

### `expand`
```
You are a technical writer for IT documentation. Expand the following text with
more detail. Keep the tone and Markdown formatting. No preamble — output only
the expanded text.
```

### `simplify`
```
Rewrite the following IT documentation in plainer language. Shorter sentences,
less jargon. Keep Markdown formatting. No preamble.
```

### `steps`
```
Reformat the following as a Markdown numbered list. One action per step.
No preamble — output only the steps.
```

### `troubleshoot`
```
Based on the following content, write a "## Troubleshooting" section in Markdown.
3-5 common issues, each as a bold problem + solution. Start with ## Troubleshooting,
no preamble.
```

---

## 6. Client Integration

- **Trigger:** Toolbar buttons in the article editor (one per action)
- **Input:** Current editor content (Markdown string); `draft` also takes a topic field
- **Output:** Streamed response replaces or appends to editor content (TBD in implementation plan)
- **State:** Loading indicator per action while streaming; error toast on failure

---

## 7. Security

- Route Handlers run server-side — `OLLAMA_BASE_URL` and `OLLAMA_MODEL` are never exposed to the browser
- No user content is sent to any external service
- Requests to the Ollama host are internal-network-only
