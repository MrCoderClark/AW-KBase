-- Postgres extensions required by the schema.
-- gen_random_uuid() comes from pgcrypto.
-- Citext is used for case-insensitive email uniqueness.
-- pg_trgm + unaccent support fuzzy and accent-insensitive search.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
