import { NextRequest, NextResponse } from "next/server";
import { ensureActiveAccount, clearAllAuthCookies, UID_COOKIE } from "@/lib/server/session";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";

export async function GET(req: NextRequest) {
  // Self-heal pre-multi-account sessions (set avni_uid + seed the jar) so existing
  // logins keep cache persistence and appear in the account switcher.
  // 401 means "signed out"; 503 means "couldn't check" — the client keeps its
  // cached identity on 503 instead of bouncing a valid session to /login.
  const res = NextResponse.json({ user: null }, { status: 401 });
  const uid = ensureActiveAccount(req, res);
  if (!uid) {
    // Expired session: drop the readable uid too, so the client stops restoring its cache.
    if (req.cookies.has(UID_COOKIE)) res.cookies.set(UID_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  try {
    const user = await new PrismaDataStore(uid).getProfile();
    return NextResponse.json({ user }, { headers: res.headers });
  } catch (e) {
    if (e instanceof Error && e.message === "Profile not found") {
      // Valid token for an account that no longer exists — sign out fully, so the
      // cookies agree with the 401 the client acts on.
      const gone = NextResponse.json({ user: null }, { status: 401 });
      clearAllAuthCookies(gone);
      return gone;
    }
    return NextResponse.json({ error: "Session check failed" }, { status: 503, headers: res.headers });
  }
}
