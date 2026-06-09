import { NextRequest, NextResponse } from "next/server";
import { listGeminiModels } from "@/lib/gemini/models";

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = (await req.json()) as { apiKey?: string };
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }
    const models = await listGeminiModels(apiKey);
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list models" },
      { status: 500 },
    );
  }
}
