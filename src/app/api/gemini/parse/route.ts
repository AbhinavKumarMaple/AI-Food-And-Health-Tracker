import { NextRequest, NextResponse } from "next/server";
import { parseLogSession, type UserHealthContext } from "@/lib/gemini/parse";

export const maxDuration = 60;

type Body = {
  apiKey?: string;
  model?: string;
  audioBase64?: string | null;
  audioMime?: string | null;
  typedText?: string | null;
  user?: UserHealthContext;
  cycleTracking?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }
    if (!body.model) {
      return NextResponse.json({ error: "No model selected" }, { status: 400 });
    }
    const result = await parseLogSession({
      apiKey: body.apiKey,
      model: body.model,
      audioBase64: body.audioBase64 ?? null,
      audioMime: body.audioMime ?? null,
      typedText: body.typedText ?? null,
      now: new Date(),
      user: body.user ?? { timezone: "UTC" },
      cycleTracking: body.cycleTracking ?? false,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to parse log" },
      { status: 500 },
    );
  }
}
