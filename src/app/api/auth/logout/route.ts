import { NextRequest, NextResponse } from "next/server";
import { signOutCurrent, clearAllAuthCookies } from "@/lib/server/session";

// Sign out the CURRENT account: drop it from the account jar and switch to another
// signed-in account if one remains (so multi-account users stay logged in), else
// clear everything. Pass { all: true } to sign out of every account at once.
// The client reloads afterward, so the new cookie state drives where it lands.
export async function POST(req: NextRequest) {
  const all = await req
    .json()
    .then((b) => !!(b as { all?: boolean })?.all)
    .catch(() => false);

  const res = NextResponse.json({ ok: true });
  if (all) clearAllAuthCookies(res);
  else signOutCurrent(req, res);
  return res;
}
