"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

const BARS = 28;

// Minimal typings for the Web Speech API (not in lib.dom for all targets).
type SRAlt = { transcript: string };
type SRResult = { isFinal: boolean; 0: SRAlt };
type SREvent = { resultIndex: number; results: { length: number; [i: number]: SRResult } };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.15));
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const blobResolveRef = useRef<((b: Blob) => void) | null>(null);

  const drawLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.floor(data.length / BARS) || 1;
    const next: number[] = [];
    for (let i = 0; i < BARS; i++) {
      const v = data[i * step] / 255;
      next.push(Math.max(0.12, v));
    }
    setLevels(next);
    rafRef.current = requestAnimationFrame(drawLoop);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    finalRef.current = "";
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        blobResolveRef.current?.(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;

      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const srcNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      srcNode.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      rafRef.current = requestAnimationFrame(drawLoop);

      const SR =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = navigator.language || "en-US";
        rec.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalRef.current += r[0].transcript;
            else interim += r[0].transcript;
          }
          setTranscript((finalRef.current + " " + interim).trim());
        };
        rec.onerror = () => {};
        try {
          rec.start();
        } catch {
          /* already started */
        }
        recognitionRef.current = rec;
      }

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
      setState("recording");
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }, [drawLoop]);

  const stop = useCallback(async (): Promise<{ blob: Blob; transcript: string } | null> => {
    if (!mediaRecorderRef.current) return null;
    const blobPromise = new Promise<Blob>((resolve) => {
      blobResolveRef.current = resolve;
    });
    try {
      mediaRecorderRef.current.stop();
    } catch {
      /* noop */
    }
    recognitionRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    setState("stopped");
    const blob = await blobPromise;
    return { blob, transcript: (finalRef.current || transcript).trim() };
  }, [transcript]);

  const togglePause = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (mr.state === "recording") {
      mr.pause();
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setState("paused");
    } else if (mr.state === "paused") {
      mr.resume();
      try {
        recognitionRef.current?.start();
      } catch {
        /* noop */
      }
      const base = Date.now() - elapsedMs;
      startedAtRef.current = base;
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
      setState("recording");
    }
  }, [elapsedMs]);

  return { state, elapsedMs, levels, transcript, error, start, stop, togglePause };
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
