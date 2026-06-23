import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

// Minimal stateless session: a signed (HMAC-SHA256) token in an httpOnly cookie.
// Avoids a heavier auth framework while staying server-side and tamper-proof.
//
// Multi-account: the ACTIVE account lives in `avni_session` (httpOnly). A readable
// `avni_uid` cookie names the active user so the client can pick the right cache
// before paint (it's an id, not a secret). All signed-in accounts are kept in an
// httpOnly `avni_accounts` jar (scoped to /api/auth so it isn't sent on data
// requests); switching just re-points `avni_session` to a stored token.

export const SESSION_COOKIE = "avni_session";
export const UID_COOKIE = "avni_uid";
export const ACCOUNTS_COOKIE = "avni_accounts";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof uid !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return uid;
  } catch {
    return null;
  }
}

/**
 * Whether the request arrived over HTTPS. A `secure` cookie is dropped by the
 * browser on plain HTTP, so we must only set it when actually on HTTPS
 * (otherwise the session is lost on every reload over http://localhost).
 */
export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS, // 30 days — long-lived so users stay signed in
  };
}

/** Readable (non-httpOnly) cookie holding the active user id — not a secret, just
 *  an identifier so the client can select the right per-account cache pre-paint. */
export function uidCookieOptions(secure: boolean) {
  return { httpOnly: false, secure, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE_SECONDS };
}

/** httpOnly account jar, scoped to /api/auth so it's never sent on data requests. */
export function accountsCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth", maxAge: MAX_AGE_SECONDS };
}

/** Read + verify the current session userId from the request cookies. */
export async function getSessionUserId(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

// ---- multi-account jar -----------------------------------------------------

export type StoredAccount = { uid: string; token: string };

function parseAccountsCookie(raw: string | undefined): StoredAccount[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((a): a is StoredAccount => !!a && typeof a.uid === "string" && typeof a.token === "string");
  } catch {
    return [];
  }
}

/** Keep only accounts whose token still verifies (signature + not expired), and
 *  whose token actually belongs to its uid; dedupe by uid (last entry wins). */
function validAccounts(list: StoredAccount[]): StoredAccount[] {
  const byUid = new Map<string, StoredAccount>();
  for (const a of list) {
    if (verifySessionToken(a.token) === a.uid) byUid.set(a.uid, a);
  }
  return [...byUid.values()];
}

function readJar(req: NextRequest): StoredAccount[] {
  return validAccounts(parseAccountsCookie(req.cookies.get(ACCOUNTS_COOKIE)?.value));
}

function writeJar(res: NextResponse, jar: StoredAccount[], secure: boolean) {
  res.cookies.set(ACCOUNTS_COOKIE, JSON.stringify(jar), accountsCookieOptions(secure));
}

/** Sign a user in (or refresh their token) and make them the active account. */
export function setActiveAccount(req: NextRequest, res: NextResponse, userId: string) {
  const secure = isSecureRequest(req);
  const token = createSessionToken(userId);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
  res.cookies.set(UID_COOKIE, userId, uidCookieOptions(secure));
  const jar = readJar(req).filter((a) => a.uid !== userId);
  writeJar(res, [...jar, { uid: userId, token }], secure);
}

/** Switch to an already-signed-in account by re-pointing the active cookies to its
 *  stored token. Returns false if that account isn't in the jar (needs re-login). */
export function switchActiveAccount(req: NextRequest, res: NextResponse, userId: string): boolean {
  const secure = isSecureRequest(req);
  const jar = readJar(req);
  const acct = jar.find((a) => a.uid === userId);
  if (!acct) return false;
  res.cookies.set(SESSION_COOKIE, acct.token, sessionCookieOptions(secure));
  res.cookies.set(UID_COOKIE, userId, uidCookieOptions(secure));
  writeJar(res, jar, secure); // re-write pruned-to-valid jar
  return true;
}

/** Sign out the current account: drop it from the jar and switch to another if
 *  one remains, else clear everything. Returns the uid we switched to (or null). */
export function signOutCurrent(req: NextRequest, res: NextResponse): { switchedTo: string | null } {
  const secure = isSecureRequest(req);
  const currentUid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const jar = readJar(req).filter((a) => a.uid !== currentUid);
  if (jar.length > 0) {
    const next = jar[0];
    res.cookies.set(SESSION_COOKIE, next.token, sessionCookieOptions(secure));
    res.cookies.set(UID_COOKIE, next.uid, uidCookieOptions(secure));
    writeJar(res, jar, secure);
    return { switchedTo: next.uid };
  }
  clearAllAuthCookies(res);
  return { switchedTo: null };
}

/** Clear every auth cookie (full sign-out of all accounts). */
export function clearAllAuthCookies(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(UID_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(ACCOUNTS_COOKIE, "", { path: "/api/auth", maxAge: 0 });
}

/** Self-heal a pre-multi-account session: if `avni_session` is valid but the
 *  readable uid cookie or the jar entry is missing (e.g. a session created before
 *  this feature), set them. Returns the active uid or null. */
export function ensureActiveAccount(req: NextRequest, res: NextResponse): string | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const uid = verifySessionToken(token);
  if (!uid || !token) return null;
  const secure = isSecureRequest(req);
  if (req.cookies.get(UID_COOKIE)?.value !== uid) {
    res.cookies.set(UID_COOKIE, uid, uidCookieOptions(secure));
  }
  const jar = readJar(req);
  if (!jar.some((a) => a.uid === uid)) {
    writeJar(res, [...jar, { uid, token }], secure);
  }
  return uid;
}

/** uids of all valid signed-in accounts + which one is active (for the switcher). */
export function listAccountUids(req: NextRequest): { uids: string[]; activeUid: string | null } {
  return {
    uids: readJar(req).map((a) => a.uid),
    activeUid: verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value),
  };
}
