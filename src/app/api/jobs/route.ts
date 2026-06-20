import { NextRequest, NextResponse, after } from "next/server";
import { getSessionUserId } from "@/lib/server/session";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";
import { parseLogSession, type UserHealthContext } from "@/lib/gemini/parse";

// Max compute time for the background parse (within Vercel's function limit).
export const maxDuration = 60;

type Body = {
  audioBase64?: string | null;
  audioMime?: string | null;
  typedText?: string | null;
  transcript?: string | null;
  audioDurationSeconds?: number | null;
  inputType?: "voice" | "text" | "mixed";
  /** When present, re-process this existing (failed/stuck) job instead of creating one. */
  retryId?: string;
};

type ProcessInput = {
  audioBase64?: string | null;
  audioMime?: string | null;
  typedText?: string | null;
};

/** Run the parse (with model fallback) for a job and flip it to parsed/failed. */
async function processJob(
  store: PrismaDataStore,
  jobId: string,
  opts: {
    apiKey: string;
    model: string;
    cycleTracking: boolean;
    user: UserHealthContext;
    input: ProcessInput;
    fallbackTranscript: string | null;
  },
) {
  try {
    const { result, modelUsed } = await parseLogSession({
      apiKey: opts.apiKey,
      model: opts.model,
      audioBase64: opts.input.audioBase64 ?? null,
      audioMime: opts.input.audioMime ?? null,
      typedText: opts.input.typedText ?? null,
      now: new Date(),
      cycleTracking: opts.cycleTracking,
      user: opts.user,
    });
    await store.updateLogSession(jobId, {
      rawAiResponse: { ...result, modelUsed },
      geminiModelUsed: modelUsed,
      transcript: result.transcript ?? opts.fallbackTranscript ?? null,
      parseStatus: "parsed",
      error: null,
    });
  } catch (e) {
    await store.updateLogSession(jobId, {
      parseStatus: "failed",
      error: e instanceof Error ? e.message : "Processing failed",
    });
  }
}

/**
 * Submit a capture for BACKGROUND processing (or retry a failed/stuck one).
 * Returns a job id immediately; the Gemini parse (with model fallback) runs after
 * the response is sent (Next `after()`), flipping the job to "parsed" or "failed".
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
  const profile = await store.getProfile();
  const user: UserHealthContext = {
    timezone: profile.timezone,
    knownAllergies: profile.knownAllergies,
    intolerances: profile.intolerances,
    chronicConditions: profile.chronicConditions,
    dietaryPattern: profile.dietaryPattern,
    location: profile.location,
    languages: profile.languages,
  };
  const common = {
    apiKey: settings.geminiApiKey,
    model: settings.selectedModel,
    cycleTracking: settings.cycleTrackingEnabled,
    user,
  };

  // ---- Retry an existing job ------------------------------------------------
  if (body.retryId) {
    const existing = await store.getLogSession(body.retryId);
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    // The audio is long gone — retry uses the stored text/transcript.
    const text = (existing.typedTextBefore || existing.transcript || "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Nothing to retry from — please record again." },
        { status: 400 },
      );
    }
    await store.updateLogSession(body.retryId, { parseStatus: "processing", error: null });
    after(() =>
      processJob(store, body.retryId as string, {
        ...common,
        input: { typedText: text },
        fallbackTranscript: existing.transcript ?? null,
      }),
    );
    return NextResponse.json({ jobId: body.retryId });
  }

  // ---- New job --------------------------------------------------------------
  if (!body.audioBase64 && !body.typedText?.trim()) {
    return NextResponse.json({ error: "Nothing to process." }, { status: 400 });
  }

  const session = await store.createLogSession({
    inputType: body.inputType ?? (body.audioBase64 ? "voice" : "text"),
    audioDurationSeconds: body.audioDurationSeconds ?? null,
    transcript: body.transcript ?? null,
    typedTextBefore: body.typedText ?? null,
    geminiModelUsed: settings.selectedModel,
    parseStatus: "processing",
  });

  after(() =>
    processJob(store, session.id, {
      ...common,
      input: { audioBase64: body.audioBase64, audioMime: body.audioMime, typedText: body.typedText },
      fallbackTranscript: body.transcript ?? null,
    }),
  );

  return NextResponse.json({ jobId: session.id });
}
