# AI Food & Health Tracker — Design Spec

**Date:** 2026-06-09
**Status:** Approved (design) — in implementation
**Source design:** `design/ai food and health tracker.pen` (Pencil, 6 screens + 11 components)

## 1. Purpose

A mobile-first web app where a user logs **what they ate, when**, and **how they felt**, primarily by **speaking naturally**. The system (Gemini) transcribes and structures the speech into rich entries, **asks follow-up questions** to capture as much detail as possible, and over time surfaces **patterns linking foods to how the user feels** (e.g. "dairy precedes bloating within ~3h, 7 of 9 times").

The guiding principle: **capture as much structured information as possible**, because richer data → better pattern detection.

## 2. Stack & decisions (locked)

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `src/`), React 19, TypeScript |
| DB | PostgreSQL (local) via Prisma |
| Auth | Auth.js (next-auth v5), Credentials provider, JWT sessions, bcrypt passwords. **Multi-user**, data isolated per `user_id` |
| AI | Gemini via `@google/genai`. Audio + text → structured JSON (`responseSchema`). Insights via Gemini. |
| Model selection | Per-user model picker in Settings; list fetched live from Google `ListModels` REST API using the user's key |
| API key | **Per-user**, entered in Settings, **encrypted at rest** (AES-256-GCM, server secret in `APP_ENCRYPTION_KEY`) |
| Capture | Browser `MediaRecorder` (audio) + Web Speech API (live transcript feel); user can **type before/after**. Audio sent to server → Gemini |
| Follow-ups | AI-generated follow-up questions + per-entry **completeness meter** |
| Patterns | Food→symptom correlation with time-lag, ranked triggers, NL insights |
| Styling | Tailwind v4, mobile-first, **phone-width centered**, tokens from the `.pen` (orange `#FF5C00`, ink `#1A1A1A`, cream `#FFF0E5`, fonts Inter / Funnel Sans / Geist) |

## 3. Data model (the core)

Rich, normalized schema. All user-owned rows carry `user_id` for isolation. Timestamps are `timestamptz`; per-user `timezone` drives time-of-day grouping.

### users
auth + health context: `id, email, password_hash, name, timezone, date_of_birth, sex, height_cm, weight_kg, known_allergies[], intolerances[], chronic_conditions[], medications[], dietary_pattern, health_goals[], created_at, updated_at`

### user_settings
`user_id (unique), gemini_api_key_ciphertext, gemini_api_key_iv, gemini_api_key_tag, selected_model, units(metric|imperial), follow_up_aggressiveness(low|medium|high), created_at, updated_at`

### log_sessions (one capture)
`id, user_id, input_type(voice|text|mixed), audio_path, audio_mime, audio_duration_seconds, transcript, typed_text_before, typed_text_after, gemini_model_used, raw_ai_response(jsonb), parse_status(draft|parsed|confirmed|discarded), entry_count, error, created_at, confirmed_at`

### meals
`id, user_id, log_session_id?, occurred_at, time_confidence(exact|approx|inferred), meal_type(breakfast|lunch|dinner|snack|drink|other), title, description, location, restaurant_name?, social_context, hunger_before(1-5), fullness_after(1-5), preparation(home_cooked|restaurant|packaged|takeout|other), estimated_calories?, macros(jsonb: protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg), portion_size, completeness_score(0-100), ai_confidence(0-1), source(voice|text|manual), notes, created_at, updated_at`

### meal_items (structured foods — key for correlation)
`id, meal_id, name, canonical_name (normalized), quantity?, unit?, food_category, tags[] (Fiber|Protein|Caffeine|Gluten|Dairy|Spicy|Fermented|...), is_potential_allergen, allergen_type?, estimated_calories?, created_at`

### symptoms
`id, user_id, log_session_id?, occurred_at(onset), time_confidence, symptom_type(bloating|headache|nausea|fatigue|cramps|heartburn|skin|mood|other), title, severity(1-5), duration_minutes?, is_ongoing, resolved_at?, body_location?, description, completeness_score, ai_confidence, source, created_at, updated_at`

### symptom_triggers (the "I think it came from X" link)
`id, symptom_id, suspected_meal_id?, suspected_meal_item_id?, suspected_food_text?, relation_note, source(user|ai), user_confidence(1-5)?, created_at`

### moods
`id, user_id, log_session_id?, occurred_at, rating(1-5), label, energy_level(1-5)?, stress_level(1-5)?, notes, source, created_at, updated_at`

### hydration_logs
`id, user_id, log_session_id?, occurred_at, amount_ml, beverage_type(water|coffee|tea|juice|soda|alcohol|other), notes, source, created_at`

### day_summaries (one per user+date)
`id, user_id, date, overall_rating(1-5)?, rating_label, rating_captured_at?, is_closed, reflection?, ai_summary?, meal_count, symptom_count, mood_avg, total_water_ml, created_at, updated_at` — unique(user_id, date)

### follow_up_questions (ask-more)
`id, user_id, log_session_id?, target_type(meal|symptom|mood|hydration|day|general), target_id?, question_text, field_hint?, status(pending|answered|dismissed), answer_text?, generated_by, created_at, answered_at`

### insights (pattern output)
`id, user_id, insight_type(food_symptom_correlation|trend|streak|trigger|general), subject_kind(food|ingredient|tag|meal_type|beverage), subject_value, object_kind(symptom_type|mood), object_value, title, description, strength(0-1), support_count, exposure_count, confidence(0-1), avg_lag_minutes?, period_start, period_end, status(active|dismissed|confirmed), evidence(jsonb), created_at, updated_at`

## 4. Capture → Parse → Review → Save

1. **Today** → mic → **Recording**: `MediaRecorder` captures audio; waveform via Web Audio analyser; live interim transcript via Web Speech; user may type before/after.
2. Stop → `POST /api/log-sessions` (audio + text) → server calls Gemini with audio + strict `responseSchema` → `{ meals[], symptoms[], moods[], hydration[], follow_ups[], per-entry completeness }`. Persisted as a **draft** session with draft entries.
3. **Review** (`/review/[id]`) → editable cards matching the design; completeness meters; follow-up questions; user can **link a symptom → suspected meal**.
4. **Save** → entries marked `confirmed`, `day_summaries` recomputed.

## 5. Ask-more + completeness

Gemini scores each entry's completeness and emits targeted questions for missing fields (portion, exact time, symptom severity/duration/body-location, suspected trigger). Each card shows a completeness ring; answering (voice/text) enriches the entry (answers re-parsed into fields by Gemini).

## 6. Pattern engine

On Stats load + nightly: for each food/ingredient/tag × symptom_type, compute co-occurrence where symptom onset falls within a lag window (default 0–6h) after consumption, across days → `support_count / exposure_count`, confidence/lift, `avg_lag_minutes`; rank triggers. Explicit `symptom_triggers` are strong signals. Top correlations summarized by Gemini → `insights`, rendered on Stats + the "Pattern detected" card.

## 7. Screens & routes

`/login`, `/signup`, `/` (Today), `/record`, `/review/[id]`, `/history`, `/day/[date]`, `/stats`, `/settings` (model picker + key + profile), `/profile`. Each maps to a Pencil screen; Settings/Profile fill the gaps the TabBar implies.

## 8. Project structure

```
src/
  app/            # routes (App Router) + route handlers under app/api
  components/     # shared UI replicated from .pen (TabBar, MealCard, ...)
  lib/
    db.ts         # Prisma client
    auth.ts       # Auth.js config
    crypto.ts     # AES-GCM encrypt/decrypt for API key
    gemini/       # Gemini client, schemas, parsing, models list
    patterns/     # correlation engine (pure, unit-tested)
  styles/         # tokens / globals
prisma/schema.prisma
```

## 9. Testing

TDD: pure correlation engine (unit), zod validation, mocked Gemini parsing, crypto round-trip; integration tests for API routes against a test database; key UI components.

## 10. Build phases

0. Scaffold (done) · 1. Prisma model + migrate · 2. Auth · 3. Design tokens + components · 4. Capture/parse/review/save · 5. Today/History/Day · 6. Stats/patterns · 7. Settings/profile.

## 11. Open operational item

Local Postgres: native PG17 runs on port **5433** (scram auth, password required) — using a `DATABASE_URL` in `.env`. If the native password is unavailable, fall back to a Docker Postgres container. This is a one-line `.env` switch and does not affect application code.
