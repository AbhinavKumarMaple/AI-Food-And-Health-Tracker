import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";
import { setActiveAccount } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    const normalized = (email ?? "").trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const profile = await new PrismaDataStore(user.id).getProfile();
    const res = NextResponse.json({ user: profile });
    setActiveAccount(req, res, user.id); // active session + readable uid + add to account jar
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sign in failed" },
      { status: 500 },
    );
  }
}
