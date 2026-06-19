import { NextRequest, NextResponse, after } from "next/server";
import { getSessionUserId } from "@/lib/server/session";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";
import { parseLogSession } from "@/lib/gemini/parse";

// Max compute time for the background parse (within Vercel's function limit).
export const maxDuration = 60;

type Body = {
  audioBase64?: string | null;
  audioMime?: string | null;
  typedText?: string | null;
  transcript?: string | null;
  audioDurationSeconds?: number | null;
  inputType?: "voice" | "text" | "mixed";
};

/**
 * Submit a capture for BACKGROUND processing. Creates a "processing" job and
 * returns its id immediately; the Gemini parse (with model fallback) runs after
 * the response is sent (Next `after()`), flipping the job to "parsed" or "failed".
 * The user never waits — they review it from the Inbox when ready.
 */
export async function POST(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const store = new PrismaDataStore(uid);

  const settings = await store.getSettings();
  if (!settings.geminiApiKey) {
    return NextResponse.json({ error: "Add your Gemini API key in Settings first." }, { status: 400 });
  }
  if (!body.audioBase64 && !body.typedText?.trim()) {
    return NextResponse.json({ error: "Nothing to process." }, { status: 400 });
  }

  const profile = await store.getProfile();

  // Create the job up front so it appears in the Inbox immediately.
  const session = await store.createLogSession({
    inputType: body.inputType ?? (body.audioBase64 ? "voice" : "text"),
    audioDurationSeconds: body.audioDurationSeconds ?? null,
    transcript: body.transcript ?? null,
    typedTextBefore: body.typedText ?? null,
    geminiModelUsed: settings.selectedModel,
    parseStatus: "processing",
  });

  // Process AFTER the response is sent, so the client doesn't block.
  after(async () => {
    try {
      const { result, modelUsed } = await parseLogSession({
        apiKey: settings.geminiApiKey as string,
        model: settings.selectedModel,
        audioBase64: body.audioBase64 ?? null,
        audioMime: body.audioMime ?? null,
        typedText: body.typedText ?? null,
        now: new Date(),
        cycleTracking: settings.cycleTrackingEnabled,
        user: {
          timezone: profile.timezone,
          knownAllergies: profile.knownAllergies,
          intolerances: profile.intolerances,
          chronicConditions: profile.chronicConditions,
          dietaryPattern: profile.dietaryPattern,
          location: profile.location,
          languages: profile.languages,
        },
      });
      await store.updateLogSession(session.id, {
        rawAiResponse: { ...result, modelUsed },
        geminiModelUsed: modelUsed,
        transcript: result.transcript ?? body.transcript ?? null,
        parseStatus: "parsed",
      });
    } catch (e) {
      await store.updateLogSession(session.id, {
        parseStatus: "failed",
        error: e instanceof Error ? e.message : "Processing failed",
      });
    }
  });

  return NextResponse.json({ jobId: session.id });
}
