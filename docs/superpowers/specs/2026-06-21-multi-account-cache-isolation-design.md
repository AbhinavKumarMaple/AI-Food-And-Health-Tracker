# Multi-account & per-account cache isolation — design (2026-06-21)

## Problem
1. **Cache bleed (security audit HIGH-2 / CWE-525).** The persisted React-Query cache uses one global key `avni-query-cache` and is hydrated regardless of who is logged in. Login/signup don't clear it before seeding, and if logout JS never runs (tab closed) or the session expires server-side, a different user on the same device sees the previous user's cached data — including the decrypted Gemini key.
2. **No multi-account.** No way to stay signed into multiple accounts and switch without re-entering a password.

## Insight
Both reduce to: **namespace the persisted cache by user id.** A readable `avni_uid` cookie names the active account so the client picks the right cache before paint; session tokens stay httpOnly. Per-account cache isolation is the fix AND the foundation for switching.

## Chosen approach: httpOnly account jar + per-account cache + reload-on-switch
Keep the existing stateless httpOnly HMAC session. (Rejected: tokens in localStorage — XSS-exposable. Deferred: DB session table — heavier, but adds real revocation.)

**Cookies**
- `avni_session` (existing, httpOnly, path `/`) — the ACTIVE account's token.
- `avni_uid` (NEW, readable, path `/`) — active account's user id; a non-secret identifier so the client can pick the cache synchronously, pre-paint.
- `avni_accounts` (NEW, httpOnly, path `/api/auth`) — JSON `[{uid, token}]` jar of all signed-in accounts; path-scoped so it's not sent on data requests.

**Cache**
- Persist key per account → `avni-query-cache:${uid}`. Providers reads `avni_uid`, hydrates only that key; no uid → no hydrate. `clearAllCache` clears the active key.

**Auth changes**
- login/signup: set active (`avni_session` + `avni_uid`) AND upsert the account into the jar.
- `POST /api/auth/switch {uid}`: if the jar holds a valid token for `uid`, set it active; client reloads.
- `GET /api/auth/accounts`: return `[{uid, name, email, active}]` for valid tokens only.
- `POST /api/auth/logout {all?}`: remove current account from the jar → switch to a remaining one if any, else clear all three cookies. `all:true` clears everything. Client clears that account's cache.

**Client navigation**: login / switch do a **full page reload** so Providers re-inits with the correct account's cache and no in-memory residue.

## Components
- `src/lib/server/session.ts` — cookie names/options + jar parse/validate/upsert/remove helpers.
- `src/app/api/auth/{login,signup,logout}/route.ts` + NEW `switch`, `accounts` — cookie + jar management.
- `src/lib/store/apiAuth.ts` (`ApiAuth` + `AuthService`) — `listAccounts`, `switchAccount`, `signOut(all?)`.
- `src/lib/queries.ts` — `persistKeyFor(uid)`, `readActiveUid()`, `clearAllCache(uid?)`.
- `src/components/Providers.tsx` — uid-scoped hydrate/persist.
- `src/app/login/page.tsx` + `signup/page.tsx` — full reload after auth.
- `src/app/profile/page.tsx` — Accounts section (switch / add / per-account sign-out / sign-out-all).

## Security
- Tokens stay httpOnly (no XSS read) — same posture as today; `avni_uid` is a non-secret id.
- Per-account namespacing closes HIGH-2 cross-account bleed (data + cached Gemini key).
- Jar is path-scoped to `/api/auth` (not sent to `/api/data` etc.).
- Unchanged caveat: 30-day tokens have no server-side revocation; "sign out" removes the account from this device's jar but the token remains valid until expiry (same as today's logout). A DB session table (future) adds real revocation.
- Cookie size: a few ~200B tokens fit the 4KB limit; acceptable for realistic use.

## Edge cases
- Expired/invalid token in jar → filtered by validation; not shown; switch to it → 401, prompt re-login.
- Logging into an already-saved account → jar token refreshed, switched active.
- Logged-out load (no `avni_uid`) → no hydrate; legacy global `avni-query-cache` key removed on first run.
- Offline → search/display from cached account data; switch/login need network.

## Out of scope (defer)
- DB-backed sessions + true revocation.
- Account avatars/photos (use initials).
- Cross-device account list sync.
