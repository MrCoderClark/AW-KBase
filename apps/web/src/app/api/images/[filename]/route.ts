import { cookies } from "next/headers";
import { readFile } from "fs/promises";
import path from "path";

const SESSION_COOKIE_NAMES = ["kb_session", "__Host-kb_session"];
const SAFE_FILENAME = /^[a-f0-9-]+\.(jpg|jpeg|png|gif|webp)$/i;
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const cookieStore = await cookies();
  const authenticated = SESSION_COOKIE_NAMES.some((n) => cookieStore.has(n));
  if (!authenticated) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { filename } = await params;

  if (!SAFE_FILENAME.test(filename)) {
    return new Response("Bad request", { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadsDir, filename);

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ext = (filename.split(".").at(-1) ?? "").toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
