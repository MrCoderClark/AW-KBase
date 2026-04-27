import { cookies } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const SESSION_COOKIE_NAMES = ["kb_session", "__Host-kb_session"];

const MIME_TO_EXT = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authenticated = SESSION_COOKIE_NAMES.some((n) => cookieStore.has(n));
  if (!authenticated) {
    return new Response("Unauthorized", { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response("file field is required", { status: 400 });
  }

  const ext = MIME_TO_EXT.get(file.type);
  if (!ext) {
    return new Response(
      "Unsupported file type. Allowed: jpeg, png, gif, webp",
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return new Response("File too large. Maximum size is 5 MB", { status: 400 });
  }

  const filename = `${randomUUID()}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "uploads");

  try {
    await mkdir(uploadsDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadsDir, filename), buffer);
  } catch {
    return new Response("Failed to save file", { status: 500 });
  }

  return Response.json({ filename });
}
