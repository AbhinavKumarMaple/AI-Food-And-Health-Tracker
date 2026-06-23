import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listAccountUids } from "@/lib/server/session";

// The signed-in accounts on this device (for the account switcher). Returns only
// non-sensitive fields (id/name/email) for accounts with a still-valid token —
// never any tokens.
export async function GET(req: NextRequest) {
  const { uids, activeUid } = listAccountUids(req);
  if (uids.length === 0) return NextResponse.json({ accounts: [], activeUid });

  const users = await prisma.user.findMany({
    where: { id: { in: uids } },
    select: { id: true, name: true, email: true },
  });
  // Preserve jar order, drop any uid whose user row no longer exists.
  const byId = new Map(users.map((u) => [u.id, u]));
  const accounts = uids
    .map((uid) => byId.get(uid))
    .filter((u): u is { id: string; name: string | null; email: string } => !!u)
    .map((u) => ({ uid: u.id, name: u.name, email: u.email, active: u.id === activeUid }));

  return NextResponse.json({ accounts, activeUid });
}
