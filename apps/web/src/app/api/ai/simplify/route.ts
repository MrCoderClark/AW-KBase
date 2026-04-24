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
