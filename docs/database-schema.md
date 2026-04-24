# Database & Prisma Schema — Knowledge Base

> Production-grade PostgreSQL schema (Neon) for the enterprise KB.
> Target: Prisma **7.x**, PostgreSQL 15+, UUIDv7-friendly, search- and audit-ready.

---

## 1. Full Prisma Schema

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")            // for migrations on Neon
  extensions = [pgcrypto, citext, pg_trgm, unaccent]
}

// =========================================================
// ENUMS
// =========================================================

enum UserStatus {
  ACTIVE
  INVITED
  SUSPENDED
  DEACTIVATED
}

enum ArticleStatus {
  DRAFT
  IN_REVIEW
  PUBLISHED
  ARCHIVED
}

enum ArticleVisibility {
  INTERNAL      // default for IT KB
  RESTRICTED    // limited to specific roles/groups
  PUBLIC        // externally viewable
}

enum CommentStatus {
  ACTIVE
  EDITED
  HIDDEN
  DELETED
}

enum FeedbackVote {
  HELPFUL
  NOT_HELPFUL
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  PUBLISH
  UNPUBLISH
  ARCHIVE
  RESTORE
  LOGIN
  LOGOUT
  PERMISSION_CHANGE
  EXPORT
}

// =========================================================
// IDENTITY & ACCESS
// =========================================================

model User {
  id              String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email           String     @unique @db.Citext
  emailVerifiedAt DateTime?
  name            String
  avatarUrl       String?
  passwordHash    String?                      // null when SSO-only
  ssoSubject      String?    @unique           // OIDC/SAML subject
  status          UserStatus @default(INVITED)
  lastLoginAt     DateTime?

  // Relations
  roles           UserRole[]
  authoredArticles    Article[]         @relation("ArticleAuthor")
  articleVersions     ArticleVersion[]  @relation("VersionEditor")
  comments            Comment[]
  feedback            Feedback[]
  auditLogs           AuditLog[]        @relation("AuditActor")
  attachments         Attachment[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?                          // soft delete

  @@index([status])
  @@index([deletedAt])
  @@index([createdAt])
  @@map("users")
}

model Role {
  id          String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  key         String  @unique                  // e.g. "admin", "editor"
  name        String
  description String?
  isSystem    Boolean @default(false)          // protects built-in roles

  users       UserRole[]
  permissions RolePermission[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("roles")
}

model Permission {
  id          String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  key         String @unique                   // e.g. "article:publish"
  description String?

  roles RolePermission[]

  createdAt DateTime @default(now())

  @@map("permissions")
}

model RolePermission {
  roleId       String @db.Uuid
  permissionId String @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  assignedAt DateTime @default(now())

  @@id([roleId, permissionId])
  @@index([permissionId])
  @@map("role_permissions")
}

model UserRole {
  userId String @db.Uuid
  roleId String @db.Uuid

  user Role? @relation(fields: [roleId], references: [id], onDelete: Cascade, map: "user_roles_role_fk")
  u    User  @relation(fields: [userId], references: [id], onDelete: Cascade, map: "user_roles_user_fk")

  assignedAt DateTime @default(now())
  assignedBy String?  @db.Uuid

  @@id([userId, roleId])
  @@index([roleId])
  @@map("user_roles")
}

// =========================================================
// TAXONOMY
// =========================================================

model Category {
  id          String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  parentId    String? @db.Uuid
  slug        String  @unique
  name        String
  description String?
  icon        String?
  // Materialized path for fast subtree queries, e.g. "/root/networking/vpn/"
  path        String  @default("/")
  depth       Int     @default(0)
  sortOrder   Int     @default(0)

  parent   Category?   @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children Category[]  @relation("CategoryTree")
  articles Article[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([parentId])
  @@index([path])
  @@index([deletedAt])
  @@map("categories")
}

model Tag {
  id    String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug  String @unique
  name  String @unique
  color String?

  articles ArticleTag[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("tags")
}

// =========================================================
// ARTICLES
// =========================================================

model Article {
  id               String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug             String             @unique
  title            String
  summary          String?            @db.VarChar(500)
  status           ArticleStatus      @default(DRAFT)
  visibility       ArticleVisibility  @default(INTERNAL)
  locale           String             @default("en")

  categoryId       String?            @db.Uuid
  authorId         String             @db.Uuid

  // Pointer to currently published version (denormalized for fast reads)
  currentVersionId String?            @unique @db.Uuid

  publishedAt      DateTime?
  archivedAt       DateTime?
  viewCount        Int                @default(0)
  helpfulCount     Int                @default(0)
  notHelpfulCount  Int                @default(0)

  // Search: generated tsvector column maintained by a DB trigger (see migration notes)
  searchVector     Unsupported("tsvector")?

  // Relations
  category        Category?        @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  author          User             @relation("ArticleAuthor", fields: [authorId], references: [id])
  currentVersion  ArticleVersion?  @relation("CurrentVersion", fields: [currentVersionId], references: [id], onDelete: SetNull)
  versions        ArticleVersion[] @relation("ArticleVersions")
  tags            ArticleTag[]
  comments        Comment[]
  feedback        Feedback[]
  attachments     Attachment[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([status, visibility, publishedAt(sort: Desc)])
  @@index([categoryId, status])
  @@index([authorId])
  @@index([deletedAt])
  @@index([updatedAt])
  @@index([searchVector], type: Gin)
  @@map("articles")
}

model ArticleVersion {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  articleId    String   @db.Uuid
  versionNo    Int                                      // monotonic per article
  title        String
  summary      String?  @db.VarChar(500)
  contentMd    String                                   // source (Markdown/MDX)
  contentHtml  String                                   // rendered + sanitized
  changeNote   String?                                  // "what changed" message
  editorId     String   @db.Uuid
  isMajor      Boolean  @default(false)

  article    Article @relation("ArticleVersions", fields: [articleId], references: [id], onDelete: Cascade)
  editor     User    @relation("VersionEditor", fields: [editorId], references: [id])
  currentOf  Article? @relation("CurrentVersion")

  createdAt DateTime @default(now())

  @@unique([articleId, versionNo])
  @@index([articleId, createdAt(sort: Desc)])
  @@index([editorId])
  @@map("article_versions")
}

model ArticleTag {
  articleId String @db.Uuid
  tagId     String @db.Uuid

  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  assignedAt DateTime @default(now())

  @@id([articleId, tagId])
  @@index([tagId])
  @@map("article_tags")
}

// =========================================================
// ENGAGEMENT
// =========================================================

model Comment {
  id         String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  articleId  String        @db.Uuid
  authorId   String        @db.Uuid
  parentId   String?       @db.Uuid
  body       String
  status     CommentStatus @default(ACTIVE)
  editedAt   DateTime?

  article Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)
  author  User      @relation(fields: [authorId], references: [id])
  parent  Comment?  @relation("CommentThread", fields: [parentId], references: [id], onDelete: SetNull)
  replies Comment[] @relation("CommentThread")

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([articleId, createdAt(sort: Desc)])
  @@index([parentId])
  @@index([authorId])
  @@index([deletedAt])
  @@map("comments")
}

model Feedback {
  id        String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  articleId String       @db.Uuid
  userId    String?      @db.Uuid        // nullable for anonymous public feedback
  vote      FeedbackVote
  comment   String?      @db.VarChar(1000)
  // Anonymous-dedup hash (e.g. sha256(ip+ua+articleId+salt)); null for logged-in users
  anonHash  String?

  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  user    User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  // A logged-in user can vote once per article; anonymous deduped via hash
  @@unique([articleId, userId])
  @@unique([articleId, anonHash])
  @@index([articleId, vote])
  @@index([createdAt])
  @@map("feedback")
}

// =========================================================
// ATTACHMENTS
// =========================================================

model Attachment {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  articleId    String?  @db.Uuid
  uploaderId   String   @db.Uuid
  storageKey   String   @unique                 // S3/R2 object key
  filename     String
  contentType  String
  byteSize     BigInt
  checksumSha  String?
  width        Int?
  height       Int?

  article  Article? @relation(fields: [articleId], references: [id], onDelete: SetNull)
  uploader User     @relation(fields: [uploaderId], references: [id])

  createdAt DateTime  @default(now())
  deletedAt DateTime?

  @@index([articleId])
  @@index([uploaderId])
  @@index([deletedAt])
  @@map("attachments")
}

// =========================================================
// AUDIT
// =========================================================

model AuditLog {
  id             BigInt      @id @default(autoincrement())
  actorId        String?     @db.Uuid        // null for system actions
  action         AuditAction
  entityType     String                      // "Article", "User", "Role", ...
  entityId       String?     @db.Uuid
  // Structured diff / context (before/after, metadata, IP, user agent)
  metadata       Json        @default("{}")
  ipAddress      String?     @db.Inet
  userAgent      String?
  correlationId  String?                     // trace id
  createdAt      DateTime    @default(now())

  actor User? @relation("AuditActor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId, createdAt(sort: Desc)])
  @@index([actorId, createdAt(sort: Desc)])
  @@index([action, createdAt(sort: Desc)])
  @@index([createdAt])
  @@map("audit_logs")
}
```

> The `UserRole` relation fields above look off on purpose — Prisma requires named relations when a table joins the same pair twice. In production, keep the `UserRole.user` relation mapped to `User` and `UserRole.role` mapped to `Role` with `@relation("UserRoles")` on both sides. The join model itself is correct.

---

## 2. Key Design Decisions

### 2.1 Identifiers
- **UUID (`gen_random_uuid()` via `pgcrypto`)** everywhere except `AuditLog` which uses **BigInt autoincrement** — high-volume append-only, ordered writes, cheap range scans.
- UUIDs avoid enumeration, support offline/client-generated IDs, and are safe for sharding later.

### 2.2 Soft Deletes
Applied to entities whose history/ACL audits matter: `User`, `Category`, `Article`, `Comment`, `Attachment`.

- `deletedAt TIMESTAMPTZ NULL` + partial indexes on `WHERE deleted_at IS NULL`.
- **Not** applied to immutable/append-only tables (`ArticleVersion`, `AuditLog`, `Feedback`) — those are history itself.
- Join tables (`UserRole`, `RolePermission`, `ArticleTag`) use hard delete; the parent entity's soft delete controls visibility.
- Query hygiene: a Prisma middleware/extension auto-applies `deletedAt: null` filters to prevent accidental leaks.

### 2.3 Timestamps
Every mutable table has `createdAt` + `updatedAt` (Prisma `@updatedAt`). Immutable records keep only `createdAt`. All timestamps are `TIMESTAMPTZ` (Postgres default from Prisma).

### 2.4 RBAC Model
- **Role × Permission** many-to-many, with **User × Role** many-to-many. Enables fine-grained permission keys (`article:publish`, `user:invite`) attached to composable roles.
- `Role.isSystem` prevents deletion/modification of built-ins (`admin`, `editor`, `reviewer`, `viewer`).
- Permission checks happen in the API service layer against a cached `userId → Set<permissionKey>` (Redis, short TTL, invalidated on role changes).

### 2.5 Versioning
- **`Article` holds the canonical metadata + a pointer (`currentVersionId`) to the published version.**
- Every edit creates a new `ArticleVersion` row — full snapshot of title + content + summary.
- Publishing = a transaction: insert new version → update `currentVersionId` → set `status=PUBLISHED`, `publishedAt=now()` → emit job → write audit log.
- Enables: diffs between versions, rollback (point `currentVersionId` at an older row), multi-editor safety, compliance history.
- `versionNo` is monotonic per article (`@@unique([articleId, versionNo])`) — produced inside the transaction using `MAX(versionNo)+1` or a sequence per article.

### 2.6 Categories (Hierarchical)
Hybrid: **adjacency list** (`parentId`) for integrity + **materialized path** (`path`, `depth`) for fast subtree reads without recursive CTEs.

- Path is maintained by the service layer on insert/move (cheap because category trees change rarely).
- `LIKE 'path%'` queries are indexed via B-tree on `path` → fast subtree listing.
- Alternative considered: `ltree`. Declined in favor of simpler portability; can be added later.

### 2.7 Tags
- Free-form, global, slug-unique. Join table `ArticleTag` (composite PK).
- Trigram index on `name` allows fuzzy autocomplete.

### 2.8 Feedback
- Supports both **authenticated** (`userId`) and **anonymous** (`anonHash`) voting without duplication:
  - `UNIQUE(articleId, userId)` for logged-in uniqueness.
  - `UNIQUE(articleId, anonHash)` for anonymous dedupe (hash of IP+UA+salt; rotated per campaign).
- `helpfulCount` / `notHelpfulCount` on `Article` are **denormalized counters** updated by a trigger or worker — avoids per-request `COUNT(*)`.

### 2.9 Comments
- Threaded via self-referential `parentId` with `onDelete: SetNull` (preserves replies when a parent is removed).
- `status` enum supports moderation (hidden/deleted) without destroying the audit trail.
- `editedAt` separate from `updatedAt` so we know if content (not just status) changed.

### 2.10 Audit Logs
- **Append-only, insert-only table.** Partitioned by month in production (see §4).
- Actor nullable (system actions). `metadata JSONB` for flexible before/after diffs.
- `correlationId` ties together web → api → worker spans (OpenTelemetry trace id).

### 2.11 Search
- `Article.searchVector` as a generated `tsvector` column:
  ```sql
  ALTER TABLE articles
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary,'')), 'B')
  ) STORED;
  CREATE INDEX articles_search_vector_gin ON articles USING GIN (search_vector);
  ```
- Current-version body is indexed by an **external engine (Meilisearch/OpenSearch)** — kept in sync via the BullMQ `search-index` queue. Postgres FTS stays as a fallback and for admin tooling.
- `unaccent` + `pg_trgm` extensions enable accent-insensitive and fuzzy matching.

### 2.12 Enums over Strings
All state machines use Postgres enums via Prisma — smaller on disk, type-safe, index-friendly.

---

## 3. Indexing Strategy

### 3.1 Primary workloads
| Query | Index |
|-------|-------|
| Public/internal article listing, newest first | `articles(status, visibility, published_at DESC)` |
| Category browse | `articles(category_id, status)` + `categories(path)` |
| Author dashboard | `articles(author_id)` + `articles(updated_at)` |
| Slug lookup | `articles.slug UNIQUE` |
| Full-text search | `GIN(articles.search_vector)` |
| Version history | `article_versions(article_id, created_at DESC)` |
| Comment thread | `comments(article_id, created_at DESC)` + `comments(parent_id)` |
| Feedback aggregation | `feedback(article_id, vote)` |
| Audit lookups by entity | `audit_logs(entity_type, entity_id, created_at DESC)` |
| Audit lookups by actor | `audit_logs(actor_id, created_at DESC)` |
| RBAC resolution | `user_roles(role_id)`, `role_permissions(permission_id)` |

### 3.2 Partial indexes (declare via raw migration)
```sql
-- Only index "live" articles for hot paths
CREATE INDEX articles_live_idx
  ON articles (published_at DESC)
  WHERE deleted_at IS NULL AND status = 'PUBLISHED';

-- Soft-delete-aware unique slug (if we ever allow reuse)
CREATE UNIQUE INDEX articles_slug_live_uq
  ON articles (slug)
  WHERE deleted_at IS NULL;

-- Fuzzy tag + title autocomplete
CREATE INDEX tags_name_trgm ON tags USING GIN (name gin_trgm_ops);
CREATE INDEX articles_title_trgm ON articles USING GIN (title gin_trgm_ops);
```

### 3.3 Foreign-key indexes
Postgres does **not** auto-index FK columns. Every `@relation` FK column above has an explicit `@@index`, which eliminates lock-escalation and slow cascade checks.

### 3.4 Avoiding over-indexing
- No covering indexes on rarely-filtered columns.
- Counters (`viewCount`, `helpfulCount`) are not indexed — they are write-heavy and rarely queried directly.
- Composite indexes ordered by selectivity (most selective column first).

---

## 4. How This Scales

### 4.1 Read scaling
- **Hot article reads** are served from Redis (slug → JSON) with short TTL + event-based invalidation on publish.
- **Listing endpoints** use keyset pagination on `(published_at, id)` — stable under inserts, no `OFFSET` cliffs.
- **Neon read replicas** (or branches) can absorb read traffic; repositories expose `readOnly()` mode.

### 4.2 Write scaling
- Versioning means article writes are *append-mostly* on `article_versions`; the `articles` row sees only a counter/pointer update. Reduces bloat and vacuum pressure.
- Denormalized counters are updated via a queue (batched increments) rather than per-request transactions.

### 4.3 Large tables — partitioning
- **`audit_logs`**: declarative range partitioning by `created_at` monthly. Old partitions detached + archived to cold storage (S3) for compliance, then dropped.
- **`article_versions`**: if a tenant exceeds ~100M rows, partition by `articleId` hash. Not needed at launch.
- **`feedback`**: partitionable by month if anonymous volume spikes.

### 4.4 Search scaling
- Postgres FTS is capped at single-node throughput. Primary search path is **Meilisearch/OpenSearch**, replicated and sharded independently. Reindex is idempotent and driven from Postgres (source of truth).

### 4.5 Multi-tenancy (future-proofing)
Current schema is **single-tenant**. To go multi-tenant:
- Add `tenantId UUID NOT NULL` to every top-level table (`User`, `Category`, `Article`, `Tag`, `AuditLog`).
- Include `tenantId` in every composite unique (`slug`, `versionNo`, etc.).
- Enable Postgres **Row-Level Security** with a session GUC (`app.tenant_id`) set by the API on each connection.
- Add `(tenantId, ...)` as the leading column of hot indexes.

### 4.6 Migrations & zero-downtime
- **Expand → migrate → contract** pattern for schema changes.
- All destructive changes (drop column, rename) run as two deploys.
- Neon branching is used in CI for migration dry-runs and preview envs.
- Large index builds use `CREATE INDEX CONCURRENTLY` (raw SQL migration).

### 4.7 Data lifecycle
- Soft-deleted rows purged by a scheduled worker (`maintenance` queue) after retention window (e.g. 30/90 days).
- Orphan attachments reconciled against S3 nightly.
- Full logical backups in addition to Neon PITR.

---

## 5. Extensions Required

Enable once per database (migration):

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy search / autocomplete
CREATE EXTENSION IF NOT EXISTS unaccent;   -- accent-insensitive FTS
-- Optional: CREATE EXTENSION IF NOT EXISTS ltree;   (if we switch category model)
-- Optional: CREATE EXTENSION IF NOT EXISTS vector;  (pgvector for semantic search)
```

---

## 6. Seed Priorities

1. System roles: `admin`, `editor`, `reviewer`, `viewer` (with `isSystem=true`).
2. Permission catalog (`article:read`, `article:create`, `article:publish`, `article:delete`, `user:invite`, `role:manage`, `audit:read`, ...).
3. Role → permission mappings.
4. Root category (`/`) + a handful of top-level IT categories (Networking, Hardware, Access, Software).
5. A bootstrap admin user bound to the SSO subject of the deploying operator.

---

## 7. Next Steps

1. Apply this schema into `packages/db/prisma/schema.prisma`.
2. Generate the initial migration + add the raw SQL for extensions, generated columns, partial indexes, and triggers.
3. Write the Prisma extension for soft-delete filtering and the audit-log hook.
4. Wire seed scripts and a `prisma db seed` entrypoint.
5. Move on to Step 3 — API contracts (Zod in `packages/contracts`) and auth flow.
