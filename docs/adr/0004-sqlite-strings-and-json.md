# ADR 0004 — SQLite by default, string enumerations, JSON payload columns

Status: accepted

## Context

The application must run offline on a laptop with `pnpm install && pnpm db:seed && pnpm dev`, with
Postgres available for anyone who wants it. Prisma does not support native enums on SQLite.

## Decision

- SQLite is the default datasource; the schema avoids anything Postgres-only.
- Enumerated columns are `String`, with the permitted values defined once in
  `src/lib/domain/enums.ts` and validated by Zod at every boundary.
- Structured payloads (artifact content, agent output, readiness, scores) are stored as JSON text in
  `*Json` columns and parsed at the boundary against a Zod schema. Nothing reads a raw JSON column
  in the UI.
- Artifact content is canonicalised (recursively key-sorted) before hashing so two structurally
  identical payloads always hash identically.

## Consequences

- Zero-config local run, and one schema for both engines.
- Enum drift is caught by Zod at runtime and by TypeScript at compile time, not by the database.
- Query-by-JSON-field is not available. No feature needs it: everything queried is a real column.
