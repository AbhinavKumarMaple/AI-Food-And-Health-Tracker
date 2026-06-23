import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";
import { setActiveAccount } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, timezone } = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      timezone?: string;
    };
    const normalized = (email ?? "").trim().toLowerCase();
    if (!normalized || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        name: name?.trim() || null,
        timezone: timezone || "UTC",
      },
    });
    const profile = await new PrismaDataStore(user.id).getProfile();
    const res = NextResponse.json({ user: profile });
    setActiveAccount(req, res, user.id); // active session + readable uid + add to account jar
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sign up failed" },
      { status: 500 },
    );
  }
}
