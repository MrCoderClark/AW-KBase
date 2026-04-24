# Authentication & Authorization Design

> Production auth stack for the KB: Next.js (App Router) frontend, Express API, Prisma/Postgres users, Redis for session state, OIDC-ready for enterprise SSO.

---

## 1. Strategy Recommendation — Hybrid: **Server Sessions in Redis + Short-Lived Signed Access Tokens**

**Primary mechanism: opaque server sessions (HttpOnly cookie).**
**Internal service-to-service: short-lived signed JWTs.**

### Why not pure JWT in the browser
- Cannot be revoked before expiry → a leaked token is a leaked account until TTL.
- Storing JWTs in `localStorage` exposes them to XSS; storing in cookies gives you no advantage over a session cookie and adds complexity.
- Role/permission changes don't propagate until the JWT expires.
- Refresh-token rotation done correctly is essentially a session store — so build the session store.

### Why not pure JWT stateless
- Auditability, forced logout, device management, and permission invalidation are all first-class features in enterprise KBs.

### Why hybrid
| Layer | Mechanism | Rationale |
|-------|-----------|-----------|
| Browser ↔ Next.js ↔ API | Opaque session ID in a `__Host-` HttpOnly Secure SameSite cookie, session row in Redis | Revocable, observable, no token handling in JS |
| Next.js server → Express API | Forward the session cookie **or** mint a short-lived internal JWT signed with a service key | Works in RSC / Route Handlers; trusted transport |
| Worker → API (if needed) | mTLS or HMAC-signed service token | No user identity; service identity only |
| Public API clients | OAuth 2.0 client-credentials or API keys (hashed at rest) | Distinct from end-user sessions |

**Cookie spec:**
- Name: `__Host-kb_session` (the `__Host-` prefix forces `Secure`, `Path=/`, no `Domain`, which locks it to the exact host).
- `HttpOnly; Secure; SameSite=Lax; Path=/`.
- Value: 256-bit random session id (base64url). Never the user id, never a JWT.
- Lifetime: rolling 30 min idle / 12 h absolute (configurable by role; admins get shorter).

**Session record in Redis (`session:<id>`):**
```json
{
  "userId": "…uuid…",
  "roles": ["editor"],
  "permVer": 17,
  "mfa": true,
  "ip": "10.0.0.4",
  "ua": "hash",
  "createdAt": "...",
  "lastSeenAt": "...",
  "absoluteExpiresAt": "..."
}
```
A reverse index `user_sessions:<userId>` (Redis SET) allows "log out everywhere" and admin force-revoke.

**`permVer`** (permission version) is bumped whenever a user's roles/permissions change. The API compares the session's `permVer` with `User.permVer` on each request; a mismatch forces a permission re-resolution (and optionally a session re-issue). This gives us **near-instant RBAC invalidation** without destroying active sessions globally.

---

## 2. Auth Flows

### 2.1 Login (password or SSO)

```
Browser                Next.js Route Handler        Express API                 Postgres / Redis
   │  POST /login (email,pw)   │                         │                            │
   ├──────────────────────────▶│                         │                            │
   │                           │  POST /v1/auth/login    │                            │
   │                           ├────────────────────────▶│                            │
   │                           │                         │  find user by email        │
   │                           │                         ├───────────────────────────▶│
   │                           │                         │◀───────────────────────────┤
   │                           │                         │  argon2.verify(pw, hash)   │
   │                           │                         │  check status, mfa, lock   │
   │                           │                         │  create session in Redis   │
   │                           │                         ├───────────────────────────▶│
   │                           │                         │  write audit_log (LOGIN)   │
   │                           │◀────────────────────────┤  Set-Cookie: __Host-…      │
   │◀──────────────────────────┤  Set-Cookie + 200 JSON  │                            │
```

- **Password hashing:** Argon2id (`memoryCost=64MB, timeCost=3, parallelism=1`), per-user random salt. Upgrade path: recompute on next login if params change.
- **Brute force:** per-email and per-IP sliding window counters in Redis (`login_fail:<email>`), exponential backoff and temporary lockout; generic error message (no user enumeration).
- **MFA (TOTP):** if `user.mfaEnabled`, first response is `202 { challenge: "mfa" }`; second call `POST /auth/mfa` with code; session only created after success.

### 2.2 Session validation (every request)

Express `authenticate` middleware:
1. Read `__Host-kb_session` cookie.
2. `GET session:<id>` from Redis. Miss → 401.
3. Check absolute expiry, sliding idle window, IP/UA binding (optional strict mode for admins).
4. Compare `session.permVer` vs `user.permVer` (cheap — `permVer` is cached per user in Redis too). Mismatch → reload roles/permissions, update session.
5. Attach `req.user = { id, roles, permissions, sessionId }` and `req.correlationId`.
6. Extend session idle TTL (`EXPIRE session:<id> 1800`).

Next.js validation in RSC / middleware:
- For auth gating: `middleware.ts` checks cookie presence + calls a fast `/v1/auth/me` (or reads a signed, short-lived cache) and injects user into request headers for RSC.
- For data fetching: server-side fetcher forwards the cookie to the API. Never trust Next's own view of the user for authorization — the API is the source of truth.

### 2.3 Logout

- `POST /v1/auth/logout` → `DEL session:<id>`, remove from `user_sessions:<userId>`, audit log, `Set-Cookie` with empty value + `Max-Age=0`.
- `POST /v1/auth/logout-all` → iterate user's session set, delete all; bumps `permVer`.

### 2.4 Refresh / rolling sessions

No separate refresh token. The session is rolling: each authenticated request slides the idle expiry. Absolute expiry forces re-auth (SSO re-prompt or password).

### 2.5 Password reset, email verification, invites

- Single-use tokens stored as hashes in Postgres (`password_resets`, `email_verifications`, `invitations`) with short expiry (15–60 min).
- Never include PII in the URL; only the token.
- Rate-limited per email + IP.

---

## 3. Middleware Design

### 3.1 Express (API)

Middleware chain (order matters):

```
helmet()
  → cors(strictOrigins)
  → cookieParser()
  → requestContext()          // correlationId, start time
  → pino-http logger
  → rateLimit(global)         // per-IP baseline
  → json({ limit: '1mb' })
  → csrf({ ignore: /^\/v1\/webhooks\// })  // double-submit token for cookie auth
  → authenticate()            // populates req.user or leaves anonymous
  → route-specific:
      requireAuth()
      requirePermission('article:publish')
      validate(schema)        // Zod
  → controller
  → errorHandler()            // RFC 7807 output, sanitizes internals
```

Key middlewares:

- **`authenticate()`** — never throws; just populates `req.user` if session is valid.
- **`requireAuth()`** — 401 if not authenticated.
- **`requirePermission(key | key[])`** — 403 if the user lacks permission; logs `PERMISSION_DENIED` audit entry.
- **`requireResourcePolicy(policyFn)`** — for object-level checks (e.g. "editor can edit only articles in spaces they belong to"). The policy receives `(user, resource, action)` and returns boolean.
- **`rateLimit`** — two tiers: global per-IP and per-user per-route for sensitive actions (login, password reset, comment creation).

### 3.2 Next.js

`middleware.ts` (Edge runtime):
- Runs on every request to `/app/*` and `/admin/*`.
- Pure cookie presence + JWT-free — no DB calls.
- Redirects unauthenticated users to `/login?next=...`.
- Sets security headers (CSP, HSTS, Referrer-Policy, Permissions-Policy) and a per-request `x-correlation-id`.

RSC / server utilities (`src/server/session.ts`):
- `getSession()` calls `GET /v1/auth/me` on the API (cached per-request with React `cache()`), returning `{ user, permissions }` or null.
- Server Actions use the same helper; mutations always re-check permissions server-side.

Route Handlers (`/app/api/proxy/[...path]`):
- Thin BFF proxy: forwards the session cookie to the API, streams the response.
- Applies CSRF token validation for state-changing methods when called from the browser.

---

## 4. Role Enforcement Strategy

### 4.1 Model
- **Roles**: `admin`, `editor`, `reviewer`, `viewer` (seeded, `isSystem=true`).
- **Permissions**: fine-grained keys, e.g.:
  ```
  article:read            article:create        article:update
  article:publish         article:archive       article:delete
  comment:create          comment:moderate
  feedback:read
  category:manage         tag:manage
  user:invite             user:deactivate       role:manage
  audit:read              admin:access
  ```
- **Assignment**: User → Role(s) → Permission(s). The API resolves a flat `Set<permissionKey>` per user and caches it.

### 4.2 Resolution & caching
- On login (or `permVer` mismatch), compute permissions with one query:
  ```sql
  SELECT DISTINCT p.key
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = $1;
  ```
- Cache in Redis `perms:<userId>` with `permVer` tag; invalidate on role changes by bumping `User.permVer` and deleting the cache key.

### 4.3 Three-layer enforcement

1. **Route layer** — `requirePermission('article:publish')` on the Express route.
2. **Service layer** — business rules that cross permissions (e.g. "publishing an article in a restricted category also requires `space:publish` for that space"). This is the **authoritative** layer; controllers may skip checks but services never do.
3. **Data layer** — for list endpoints, the repository receives the user's scope and adds `WHERE` clauses (ACL pre-filtering). Never rely on post-query filtering.

### 4.4 UI affordances (not security)
Next.js receives the permission set via `/auth/me` and uses it to hide/show buttons. Every action is **re-validated on the server** — UI checks are convenience only.

### 4.5 Admin actions that change permissions
- Role change → bump `User.permVer` → invalidate `perms:<userId>` → optionally revoke existing sessions if the change is a demotion.
- Role deletion is blocked if `isSystem=true`.
- All permission changes produce an `AuditLog` entry with before/after JSON diff.

---

## 5. API Protection Examples

### 5.1 Public read, authenticated write
```
GET    /v1/articles                 authenticate (optional)    // visibility filter applied
GET    /v1/articles/:slug           authenticate (optional)
POST   /v1/articles                 requireAuth, requirePermission('article:create')
PATCH  /v1/articles/:id             requireAuth, requirePermission('article:update'),
                                    requireResourcePolicy(canEditArticle)
POST   /v1/articles/:id/publish     requireAuth, requirePermission('article:publish'),
                                    requireResourcePolicy(canPublishArticle)
DELETE /v1/articles/:id             requireAuth, requirePermission('article:delete')
```

### 5.2 Resource policy example (conceptual)
```
canEditArticle(user, article):
  if user.hasPermission('article:update:any')       -> allow
  if article.authorId === user.id                   -> allow
  if user.hasPermission('article:update') &&
     user.spaces.includes(article.spaceId)          -> allow
  deny
```

### 5.3 Admin-only
```
GET    /v1/admin/metrics            requireAuth, requirePermission('admin:access')
GET    /v1/audit-logs               requireAuth, requirePermission('audit:read')
POST   /v1/users/:id/roles          requireAuth, requirePermission('role:manage')
```

### 5.4 Rate-limited, CSRF-protected
```
POST   /v1/auth/login               rateLimit(5/min/ip, 10/hour/email), csrf
POST   /v1/auth/password-reset      rateLimit(3/hour/email+ip)
POST   /v1/articles/:id/feedback    rateLimit(10/min/user-or-ip)
POST   /v1/comments                 requireAuth, rateLimit(20/min/user)
```

---

## 6. Security Best Practices

### 6.1 Transport & headers
- HTTPS only; HSTS (`max-age=63072000; includeSubDomains; preload`).
- Strict **CSP**: `default-src 'self'; script-src 'self' 'nonce-<per-request>'; style-src 'self' 'nonce-<per-request>'; img-src 'self' data: https:; connect-src 'self' https://api.kb.example.com; frame-ancestors 'none'`. Nonce generated in Next.js middleware and passed to RSC.
- `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` locking down sensors.
- **CORS** allowlist with credentials: only the web origin; no wildcard.

### 6.2 Cookies & CSRF
- `__Host-` prefix + `HttpOnly; Secure; SameSite=Lax`.
- `SameSite=Lax` blocks most CSRF, but we still run **double-submit token** for state-changing requests originating from the browser (BFF-issued CSRF token delivered via a non-HttpOnly cookie + mirrored header). Exempt webhooks (validated by HMAC) and internal service traffic (JWT).
- No cross-site `SameSite=None` unless absolutely required.

### 6.3 XSS
- React escapes by default; forbid `dangerouslySetInnerHTML` except in the rendered article body, which is always produced by **server-side sanitized** HTML (DOMPurify in Node with a strict allowlist — headings, code, tables, images with https-only `src`, no inline JS/CSS).
- Markdown rendered server-side; never render raw HTML from user input.
- Uploaded SVGs are disallowed or served from a sandboxed subdomain.

### 6.4 Injection
- 100% parameterized queries via Prisma; no `$queryRawUnsafe` with user input.
- Zod validation on every request body/query/param before it reaches services.
- Filename/path sanitization for attachments; store by opaque `storageKey`, never by user-provided filename.

### 6.5 Sessions & tokens
- 256-bit CSPRNG session ids.
- Rotate session id on privilege elevation (login, MFA success, role change that grants admin).
- Bind sessions to a UA/IP fingerprint for admin accounts (step-up challenge on change).
- Force logout-all on password change and on `role:admin` grant/revoke.

### 6.6 Password & account policy
- Argon2id hashing (params above).
- NIST-aligned policy: min 12 chars, check against HaveIBeenPwned k-anonymity API, no forced rotation, encourage passphrases.
- Optional TOTP/WebAuthn MFA; WebAuthn preferred for admins.
- Account lockout: progressive delays + captcha at threshold, never permanent (to avoid DoS vector).

### 6.7 Secrets & keys
- All secrets in a managed vault; never in `.env` in prod.
- Signing keys (JWT for internal hops, CSRF, email tokens) rotated quarterly; support two active keys to allow rollover.
- Database credentials short-lived via IAM/Neon integration where possible.

### 6.8 Audit & detection
- Every auth event (`LOGIN`, `LOGOUT`, `PERMISSION_CHANGE`, `PERMISSION_DENIED`, failed MFA, password change) → `AuditLog`.
- Anomaly alerts: impossible travel, bursty permission denials, session cloning (same session id from divergent IP/UA).
- Ship audit logs to an immutable SIEM sink (e.g. S3 object-lock or Datadog).

### 6.9 Uploads
- Direct-to-S3 via **presigned PUT URLs** scoped to a single `storageKey`, `Content-Type`, and size limit.
- Server verifies content-type, size, and checksum on the returned metadata before linking the attachment to an article.
- Serve via signed GET URLs (short TTL) from a separate cookie-less domain to neutralize XSS-via-upload.

### 6.10 Dependency & supply chain
- `npm audit --production` + Snyk/Dependabot in CI, fail build on high severity.
- Lockfile committed; `npm ci` in CI; package-integrity pinning.
- SBOM generated per release.

---

## 7. Enterprise SSO Integration (Phase 2)

### 7.1 Protocols
- **OIDC** (preferred) for Okta, Azure AD, Google Workspace, Auth0.
- **SAML 2.0** for legacy enterprise IdPs.

### 7.2 Architecture
- Dedicated routes: `/v1/auth/sso/:provider/start` and `/v1/auth/sso/:provider/callback`.
- Use `openid-client` (OIDC) and `@node-saml/node-saml` (SAML). No hand-rolled crypto.
- **Just-In-Time provisioning**: on first successful callback, create the `User` row with `ssoSubject = id_token.sub`, map IdP groups → KB roles via a configurable mapping table (`sso_group_role_map`).
- **SCIM 2.0** endpoint for IdPs that push user lifecycle events (invite, deactivate, role change) — auto-updates `User.status` and roles.

### 7.3 Session continuity
- SSO login produces the same opaque session cookie as password login — the rest of the stack doesn't care how you authenticated.
- Store `idpSessionIndex` in the session for **Single Logout** (SAML SLO / OIDC back-channel logout).
- Honor `max_age` / `acr_values` for step-up to MFA.

### 7.4 Multi-tenant SSO (future)
- Per-tenant IdP config keyed by email domain (`email.split('@')[1]`) or explicit tenant subdomain.
- Enforce tenant isolation at the session level (`session.tenantId` is immutable after login).

### 7.5 Migration
- Dual-mode during rollout: users can log in with password *or* SSO. Flip a per-tenant flag to "SSO only" once adoption is verified.
- Break-glass local admin account retained, MFA-required, monitored with high-severity alerting on use.

---

## 8. Threat Model — Quick Reference

| Threat | Mitigation |
|--------|------------|
| Credential stuffing | Argon2id, HIBP check, per-email+IP throttling, MFA for privileged roles |
| Session theft via XSS | HttpOnly cookies, strict CSP with nonces, sanitized article HTML |
| CSRF | `SameSite=Lax` + double-submit token + `__Host-` cookie |
| Token replay | Opaque server sessions, rotate on privilege change, IP/UA binding for admins |
| Privilege escalation | Three-layer enforcement, service-layer authority, policy tests, audit trail |
| Insider abuse | Immutable audit log with object-lock, anomaly alerts, least-privilege roles |
| SSRF via attachment URLs | Validated allowlist of schemes and domains for any server-side fetch |
| Log injection / PII leakage | Structured logging, field-level redaction, no secrets or tokens logged |
| Dependency compromise | SBOM, Dependabot, pinned lockfile, signed release artifacts |

---

## 9. Next Steps

1. Implement `packages/contracts/auth.ts` (Zod schemas, DTOs).
2. Build Express `modules/auth` (login, logout, me, password reset) + `middleware/auth`, `middleware/rbac`, `middleware/csrf`.
3. Seed roles, permissions, and the initial admin.
4. Wire Next.js `middleware.ts`, `server/session.ts`, and a typed API client that forwards cookies.
5. Add end-to-end auth tests (login → publish → logout → revoked session) before layering SSO.
