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
