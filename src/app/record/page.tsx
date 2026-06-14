"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pause, Play, Check, Square, Info, Loader2 } from "lucide-react";
import { getStore } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import { useRecorder, formatElapsed, blobToBase64 } from "@/lib/useRecorder";
import { SayGuideSheet } from "@/components/SayGuideSheet";
import type { User } from "@/lib/store/types";

// Map a spoken language to a BCP-47 locale for the browser's live transcript.
const SPEECH_LANG: Record<string, string> = {
  hindi: "hi-IN",
  marathi: "mr-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  bengali: "bn-IN",
  gujarati: "gu-IN",
  kannada: "kn-IN",
  malayalam: "ml-IN",
  punjabi: "pa-IN",
  urdu: "ur-IN",
  odia: "or-IN",
  english: "en-IN",
};

/** Indian-English by default; a regional language if the user lists one first. */
function speechLangFor(languages?: string[]): string {
  for (const l of languages ?? []) {
    const code = SPEECH_LANG[l.trim().toLowerCase()];
    if (code && code !== "en-IN") return code;
  }
  return "en-IN";
}

export default function RecordPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const rec = useRecorder();
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const started = useRef(false);
  const profileRef = useRef<User | null>(null);

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    (async () => {
      let lang = "en-IN";
      try {
        const p = await getStore().getProfile();
        profileRef.current = p;
        lang = speechLangFor(p.languages);
      } catch {
        // fall back to Indian English
      }
      rec.start(lang);
    })();
  }, [user, rec]);

  async function finish() {
    setProcessing(true);
    setError(null);
    const result = await rec.stop();
    const store = getStore();
    const settings = await store.getSettings();
    const profile = profileRef.current ?? (await store.getProfile());

    if (!settings.geminiApiKey) {
      setError("Add your Gemini API key in Settings to process recordings.");
      setProcessing(false);
      return;
    }
    if (!result && !note.trim()) {
      setError("Nothing captured. Say something or type a note.");
      setProcessing(false);
      return;
    }

    try {
      const audioBase64 = result ? await blobToBase64(result.blob) : null;
      const res = await fetch("/api/gemini/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.geminiApiKey,
          model: settings.selectedModel,
          audioBase64,
          audioMime: result?.blob.type ?? null,
          typedText: note.trim() || null,
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not process recording");

      const session = await store.createLogSession({
        inputType: audioBase64 ? (note.trim() ? "mixed" : "voice") : "text",
        audioDurationSeconds: Math.round(rec.elapsedMs / 1000),
        transcript: data.transcript ?? result?.transcript ?? null,
        typedTextBefore: note.trim() || null,
        geminiModelUsed: settings.selectedModel,
        rawAiResponse: data,
        parseStatus: "parsed",
      });
      router.replace(`/review/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setProcessing(false);
    }
  }

  if (loading || !user) return null;

  const wordCount = rec.transcript ? rec.transcript.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="relative flex h-dvh flex-col bg-[#1a1a1a] text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
        >
          <X size={18} />
        </button>
        <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-wide">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          {rec.state === "paused" ? "PAUSED" : "RECORDING"}
        </span>
        <button
          onClick={() => setShowGuide(true)}
          aria-label="What can I say?"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
        >
          <Info size={18} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="text-[56px] font-bold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
          {formatElapsed(rec.elapsedMs)}
        </div>
        <p className="mb-8 text-[13px] text-white/60">
          {rec.error ? rec.error : rec.state === "paused" ? "Paused" : "Listening…"}
        </p>

        {/* Waveform */}
        <div className="flex h-24 w-full items-center justify-center gap-[3px]">
          {rec.levels.map((lvl, i) => (
            <span
              key={i}
              className="w-[5px] rounded-full bg-gradient-to-t from-primary to-[#ff8533]"
              style={{ height: `${Math.max(8, lvl * 100)}%` }}
            />
          ))}
        </div>

        {/* Live transcript */}
        <div className="mt-8 w-full rounded-2xl bg-white p-4 text-ink">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-primary" style={{ fontFamily: "var(--font-label)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> LIVE TRANSCRIPT
            </span>
            <span className="text-[10px] text-faint">{wordCount} words</span>
          </div>
          <p className="min-h-[48px] text-[14px] leading-relaxed text-muted">
            {rec.transcript || (
              <span className="text-faint">Speak naturally — e.g. “At 8:30 I had oatmeal with blueberries…”</span>
            )}
            {rec.state === "recording" && <span className="ml-0.5 animate-pulse text-primary">|</span>}
          </p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="…or type to add / correct details"
            className="mt-3 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>

        {error && <p className="mt-4 text-center text-[13px] text-[#ff8a8a]">{error}</p>}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-10 px-6 pb-10 pt-4">
        <button
          onClick={rec.togglePause}
          disabled={processing || rec.state === "stopped"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"
        >
          {rec.state === "paused" ? <Play size={22} /> : <Pause size={22} />}
        </button>
        <button
          onClick={finish}
          disabled={processing}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg disabled:opacity-60"
        >
          {processing ? <Loader2 size={30} className="animate-spin" /> : <Square size={28} fill="white" />}
        </button>
        <button
          onClick={finish}
          disabled={processing}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"
        >
          <Check size={22} />
        </button>
      </div>

      {processing && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#1a1a1a]/80 backdrop-blur">
          <Loader2 size={34} className="animate-spin text-primary" />
          <p className="text-[14px] text-white/80">Organising what you said…</p>
        </div>
      )}

      <SayGuideSheet open={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
