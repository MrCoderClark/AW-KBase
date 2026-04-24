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
