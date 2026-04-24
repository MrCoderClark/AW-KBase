import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 proxy (formerly `middleware`).
 *
 * Auth guard: if the user doesn't have a session cookie, redirect protected
 * routes to /login. We deliberately do NOT validate the cookie here —
 * validation happens on the API. This check is a UX/redirect convenience only.
 *
 * Runs on the Node.js runtime (edge is not supported in proxy).
 */

const SESSION_COOKIE_NAMES = ["kb_session", "__Host-kb_session"];

// Routes that require authentication (check these first).
const PROTECTED_PREFIXES = ["/dashboard", "/articles", "/settings", "/admin"];

// Routes that should redirect away from /login when already authenticated.
const PUBLIC_ONLY = ["/login"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = SESSION_COOKIE_NAMES.some((n) => req.cookies.has(n));

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const isPublicOnly = PUBLIC_ONLY.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPublicOnly && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next internals and static files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
