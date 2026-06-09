# Avni — AI Food & Health Tracker

Speak (or type) your meals, symptoms and mood. Gemini transcribes and structures
the entry, asks follow-up questions to capture more detail, and over time Avni
surfaces **which foods are linked to how you feel** (e.g. *dairy → bloating*).

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4**.
Mobile-first, phone-width UI matching `design/ai food and health tracker.pen`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

1. Create an account (local, multi-user).
2. **Settings → Gemini API key**: paste a Google Gemini key, then *Save & load models*
   to fetch the live model list and pick one.
3. **Tap to talk** on Today → speak your meals/symptoms/mood → review → save.
4. Or press **Load sample data** on Today to populate ~7 days and see the
   pattern engine in action (Stats → *Patterns detected*).

## Architecture

### Storage abstraction (the key seam)
Every screen talks to a backend-agnostic **`DataStore`** interface
(`src/lib/store/dataStore.ts`). Today it resolves to a **browser-localStorage
implementation** (`localDataStore.ts`) via the factory in `src/lib/store/index.ts`
— zero database setup. Swapping to **Postgres later** means writing one new
implementation (e.g. an API-backed store calling Prisma) and returning it from
`getStore()`; **no screen changes required**.

The future Postgres backend is already scaffolded and kept in the repo:
- `prisma/schema.prisma` — the full normalized data model (13 tables)
- `src/lib/db.ts`, `src/lib/crypto.ts` — Prisma client + AES-256-GCM key encryption

### AI (Gemini)
- `src/lib/gemini/` — client, live `ListModels`, zod parse schemas, `parseLogSession()`.
- Server routes `src/app/api/gemini/{models,parse}` proxy Gemini so the audio
  pipeline is robust and the key isn't embedded in the client bundle.
- Audio is recorded in-browser (`useRecorder.ts`, MediaRecorder + live Web Speech
  transcript), sent to Gemini, which transcribes **and** structures it in one call.

### Pattern engine
`src/lib/patterns/` — pure, time-lag correlation of food/ingredient/tag → symptom
(`correlate.ts`) plus aggregate stats (`stats.ts`). User-flagged suspected triggers
boost a correlation's strength.

## Screens
`/login` · `/signup` · `/` Today · `/record` · `/review/[id]` · `/history` ·
`/day/[date]` · `/stats` · `/settings` · `/profile`

## Scripts
- `npm run dev` — dev server
- `npm run build` — production build (TypeScript + ESLint)
- `npm run lint` — lint

## Switching to Postgres later
1. Provide a `DATABASE_URL` in `.env` (native PostgreSQL or Docker).
2. `npx prisma migrate dev` to create the tables.
3. Implement an API/Prisma-backed `DataStore` and return it from `getStore()`.

The design spec lives in `docs/superpowers/specs/`.
