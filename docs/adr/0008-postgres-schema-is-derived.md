# ADR 0008 — The Postgres schema is derived from the SQLite schema, never maintained beside it

Status: accepted

## Context

CLAUDE.md §4 requires SQLite by default for a zero-config local run, and Postgres via
`docker-compose.yml` for anyone who wants it. Prisma binds a generated client to exactly one
datasource provider, so the two stores cannot share a single `schema.prisma` at generate time.

The obvious approach — commit two schema files — is the one that fails quietly. A model added for
the default store is a model the second store silently lacks, and nobody finds out until someone
runs the Postgres path months later.

## Decision

There is one schema in the repository: `prisma/schema.prisma`, SQLite.
`scripts/prepare-postgres.ts` generates `prisma/schema.postgres.prisma` from it, replacing only the
datasource block. The generated file is git-ignored and carries a "do not edit" banner. The script
refuses to run if the source datasource is no longer SQLite, so a future migration away from SQLite
surfaces as an error rather than a wrong translation.

This is only safe because of ADR 0004: enumerations are String columns validated by Zod, and
structured payloads are JSON text. Every column type in the schema — String, Int, Float, Boolean,
DateTime — is portable as written, so there is nothing per-store to translate beyond the provider.

## Consequences

- The two stores cannot drift. Adding a model is one edit.
- ADR 0004 is now load-bearing for portability as well as for SQLite. Introducing a
  provider-specific type or a native enum would break the derivation, and the script would need to
  become a real translator — at which point the honest move is to reconsider ADR 0004 instead.
- **The Postgres path has not been executed.** The derivation is exercised, but no Docker daemon was
  available in the environment this was built in, so `docker compose up` and a seed against a live
  Postgres instance remain unrun. This is stated in the README limitations and in
  docs/DEPLOYMENT.md §4 rather than left for someone to discover.
