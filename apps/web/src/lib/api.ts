/**
 * Typed fetch client for the @kb/api backend.
 *
 * - Always sends cookies (credentials: "include") so the session cookie round-trips.
 * - Accepts a plain relative path (e.g. "/v1/articles") and joins it to the
 *   configured base URL.
 * - Throws ApiError on non-2xx responses, normalized from the API's RFC-7807
 *   problem+json body.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;
  constructor(problem: ProblemDetails) {
    super(problem.title ?? `HTTP ${problem.status}`);
    this.status = problem.status;
    this.problem = problem;
  }
}

type FetchInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined | null>;
};

function buildUrl(path: string, params?: FetchInit["searchParams"]): string {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  init: FetchInit = {},
): Promise<T> {
  const { body, searchParams, headers, ...rest } = init;
  const res = await fetch(buildUrl(path, searchParams), {
    credentials: "include",
    cache: "no-store",
    ...rest,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      accept: "application/json",
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    const problem =
      payload && typeof payload === "object"
        ? (payload as ProblemDetails)
        : ({
            type: "about:blank",
            title: res.statusText || "Request failed",
            status: res.status,
          } satisfies ProblemDetails);
    throw new ApiError(problem);
  }

  return payload as T;
}

/** Convenience wrappers. */
export const api = {
  get: <T,>(path: string, init?: FetchInit) =>
    apiFetch<T>(path, { ...init, method: "GET" }),
  post: <T,>(path: string, body?: unknown, init?: FetchInit) =>
    apiFetch<T>(path, { ...init, method: "POST", body }),
  patch: <T,>(path: string, body?: unknown, init?: FetchInit) =>
    apiFetch<T>(path, { ...init, method: "PATCH", body }),
  del: <T,>(path: string, init?: FetchInit) =>
    apiFetch<T>(path, { ...init, method: "DELETE" }),
};
