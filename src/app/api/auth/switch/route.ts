import { NextRequest, NextResponse } from "next/server";
import { switchActiveAccount } from "@/lib/server/session";

// Switch to an already-signed-in account (no password): re-point the active
// cookies to its stored token. 401 if that account isn't in the jar (re-login).
// The client reloads on success, so /api/auth/me then reflects the new account.
export async function POST(req: NextRequest) {
  const { uid } = (await req.json().catch(() => ({}))) as { uid?: string };
  if (!uid) return NextResponse.json({ error: "Missing account" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  if (!switchActiveAccount(req, res, uid)) {
    return NextResponse.json({ error: "Not signed in to that account" }, { status: 401 });
  }
  return res;
}
