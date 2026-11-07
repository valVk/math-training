# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Math practice app for a 3rd grade pupil at a Bulgarian school. Claude generates problems in Bulgarian with Russian translations; parents view statistics and set topic priority. Self-hosted on a Raspberry Pi (see README for deployment).

## Commands

```bash
npm run dev          # dev server, reads .env
npm run build        # production build to .output/ (build on the Pi: better-sqlite3 is native)
npm start            # run the build with .env
npm run lint         # ESLint (@nuxt/eslint, stylistic: no trailing commas, 1tbs)
npm run typecheck    # vue-tsc via nuxt typecheck
npm test             # vitest, tests/*.test.ts
npx vitest run tests/weights.test.ts   # single test file
docker compose up -d --build                  # production container on :3000 (Dockerfile target prod)
docker compose --profile dev up --build dev   # dev container with hot reload on :3001 (target dev)
```

The Dockerfile is multi-stage on `node:24-alpine`: `deps` (npm ci, native better-sqlite3) feeds both `dev` and `build`; `prod` copies only `.output`. Secrets come from the environment at runtime and must never be copied into an image; keep `.dockerignore` excluding `.env*`/`.envrc`.

TypeScript is pinned to 5.9: TypeScript 7 breaks vue-tsc and typescript-eslint.

## Architecture

Nuxt 4 layout: `app/` (client), `server/` (Nitro API, the only place secrets exist), `shared/` (code and types imported by both; `shared/utils` and `shared/types` are auto-imported, otherwise import via `#shared/...`).

**Data lives on the server** in SQLite (`server/utils/db.ts`). Schema changes are appended to the `MIGRATIONS` array, tracked with `PRAGMA user_version`; never edit an existing migration. `type_settings` rows are seeded from `PROBLEM_TYPES` at startup, so adding a topic means adding an entry to `shared/utils/problemTypes.ts` only.

**Problem lifecycle:**
1. `GET /api/problems/next` (`server/utils/practice.ts`) resumes the child's open attempt if one exists, otherwise picks a topic with `pickWeightedType` (linear weights by admin order, `shared/utils/weights.ts`) and an unseen problem of that topic.
2. When the pool runs low, `refillPool` calls `generateProblems` (`server/utils/generator.ts`), deduplicated per topic with an in-memory promise map. If the pool is empty the request waits for generation.
3. Every generated answer carries an `expression`; `findProblemDefect` re-evaluates it with the safe parser in `shared/utils/expression.ts` and discards mismatching or non-whole-number problems. Keep this check when changing the generator: it is what stops wrong "correct" answers.
   Problems are stamped with `GENERATOR_VERSION` (`server/utils/generator.ts`) and only the current version is served: bump it whenever the prompt changes what a problem looks like, and the old pool is ignored and regenerated (kept in the DB for stats).
4. The browser never receives solutions (`PublicProblem`). Each answer is checked server-side via `POST /api/attempts/:id/check`; reveal, hint/translation events and skip have their own endpoints.

**Metrics:** active time is measured client-side by `useActiveTimer` (visible tab and recent input only) and sent as `activeMs` with every attempt call; the server keeps the max. Per-answer progress (tries, wrong values, solve time, revealed) is a JSON column on `attempts`. Aggregation is the pure function `computeTypeStats` in `server/utils/stats.ts`, shared by the stats and analysis endpoints.

**Claude calls** go through `askClaudeStructured` in `server/utils/claude.ts`: official SDK, `beta.messages.parse` with a Zod schema, model from `NUXT_ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), server-side refusal fallback enabled. Effort is `medium` for generation and `high` for the parent analysis.

**Access:** the child never signs in; all attempts belong to one learner, the `LEARNER` constant in `server/utils/practice.ts` (the `attempts.user_email` column is kept so per-child tracking can be added without a migration). Parents sign in with email/password from `NUXT_PARENTS` (`server/utils/parents.ts`: parsing, constant-time compare, `requireParent`) via `POST /api/parent/login`, which creates a nuxt-auth-utils sealed-cookie session lasting a year (`runtimeConfig.session` in `nuxt.config.ts`; cookie `secure: false` on purpose for plain-http LAN). `requireParent` guards all `/api/admin/*` endpoints and skip; `app/middleware/parent.global.ts` guards `/admin` pages.

**Skipped problems return:** an attempt has `is_return`; `nextProblemFor` first serves the oldest problem whose latest attempt is skipped/abandoned once 3 newer attempts exist (`pickReturningProblem`), so a problem keeps returning until solved.

## Conventions

- Problem content is always shown in Bulgarian; Russian is an opt-in translation per problem, and opening it is a tracked metric. UI language is fixed by audience, not user-selectable: child-facing UI uses `useLocale(CHILD_LOCALE)` (Bulgarian), everything parents see (stats, topics, login, the skip dialog, parent header items) uses `useLocale(PARENT_LOCALE)` (Russian). Strings live in both dictionaries in `app/composables/useLocale.ts`.
- Visual style is calm vintage/loft: warm paper background, squared-notebook `.notebook` surface, serif fonts (Lora, Playfair Display), custom palettes `clay`, `brass`, `moss`, `brick`, `ink` in `app/assets/css/main.css`, mapped to Nuxt UI color roles in `app/app.config.ts`. Use those tokens rather than default Tailwind colors. The child never sees a timer or score pressure.
- Every problem is a word problem (a 2-5 sentence story that never names the operation), because reading comprehension is a goal. Bare computations like "Пресметни: 345 + 232" are wrong output; `findProblemDefect` also rejects texts under 12 words.
- The practice screen is sized for a tablet: story text `text-2xl md:text-[2rem]`, controls `xl`. Keep new practice UI at that scale.
- Generation prompts are in English for precision but ask for Bulgarian output that follows Bulgarian textbook notation (`.` for multiplication, `:` for division) and uses euro for money.
