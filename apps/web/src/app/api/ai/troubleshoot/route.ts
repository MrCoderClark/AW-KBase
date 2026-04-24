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
