export async function ollamaStream(systemPrompt: string, userContent: string): Promise<Response> {
  const baseUrl = process.env.OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_MODEL;

  if (!baseUrl || !model) {
    return new Response("OLLAMA_BASE_URL or OLLAMA_MODEL not configured", { status: 500 });
  }

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
    return new Response("Could not reach Ollama", { status: 502 });
  }

  if (!ollamaRes.ok) {
    return new Response(`Ollama returned ${ollamaRes.status}`, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
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
              controller.enqueue(encoder.encode(chunk.response));
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
