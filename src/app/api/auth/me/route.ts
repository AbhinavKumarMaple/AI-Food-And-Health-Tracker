import { NextRequest, NextResponse } from "next/server";
import { ensureActiveAccount } from "@/lib/server/session";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";

export async function GET(req: NextRequest) {
  // Self-heal pre-multi-account sessions (set avni_uid + seed the jar) so existing
  // logins keep cache persistence and appear in the account switcher.
  const res = NextResponse.json({ user: null });
  const uid = ensureActiveAccount(req, res);
  if (!uid) return res;
  try {
    const user = await new PrismaDataStore(uid).getProfile();
    return NextResponse.json({ user }, { headers: res.headers });
  } catch {
    return NextResponse.json({ user: null }, { headers: res.headers });
  }
}
