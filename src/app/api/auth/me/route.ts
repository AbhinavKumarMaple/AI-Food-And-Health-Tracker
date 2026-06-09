import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ user: null });
  try {
    const user = await new PrismaDataStore(uid).getProfile();
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
