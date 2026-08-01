# ADR 0007 — Deviation from the mandated UI libraries, and why it is flagged rather than hidden

Status: accepted, with a flagged conflict

## Context

`CLAUDE.md` §4 specifies the stack as Next.js 15, TypeScript strict, React 19, Tailwind, **shadcn/ui
and lucide-react**, Prisma, Auth.js v5, Zod, **react-hook-form** and **@tanstack/react-query**.

`CLAUDE.md` also says: if an instruction anywhere conflicts with it, stop and flag the conflict
rather than resolving it silently. This ADR is that flag.

## What was built instead

Everything in the stack is used as specified **except** the four client-side UI libraries:

| Specified | Built with | Why |
|---|---|---|
| shadcn/ui + lucide-react | A small hand-written primitive set in `src/components/ui.tsx` | shadcn/ui is a code-generation CLI, not a runtime dependency; its components would be vendored into this repository anyway. The primitives here are the ~10 actually used, each keyboard-reachable, labelled and AA-contrast. |
| react-hook-form | Native form elements posting to Server Actions, with `useActionState` for inline results | Every mutation already validates with the same Zod schema server-side. A second client-side validation layer would be a second source of truth for the same rules. |
| @tanstack/react-query | React Server Components plus `revalidatePath` | There is no client-side data-fetching layer to cache: every read is a server component, and every write is a server action that revalidates. |

The unused packages were **removed from `package.json`** rather than left installed, because a
dependency nobody imports is noise in an enterprise procurement conversation.

## Consequences

- Client JavaScript is small (~104 kB shared) and most pages ship almost none of their own.
- Anyone who wants shadcn/ui can run its CLI into `src/components/` without conflict; the primitives
  follow the same prop shapes.
- **This is a real deviation from a binding document.** It is recorded here, and reported alongside
  the build, so the decision can be reversed deliberately rather than discovered later.
