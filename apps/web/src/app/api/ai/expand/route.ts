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
