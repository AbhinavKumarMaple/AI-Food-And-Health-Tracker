"use client";

import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { getStore } from "@/lib/store";
import { blobToBase64 } from "@/lib/useRecorder";
import { qk, invalidateLogSessions, readActiveUid } from "@/lib/queries";
import type { LogSession } from "@/lib/store/types";
import {
  type PendingCapture,
  newCaptureIds,
  setPlaceholder,
  removePlaceholder,
  withPendingCaptures,
  savePendingCapture,
  deletePendingCapture,
  getPendingCapture,
  listPendingCaptures,
} from "@/lib/pendingCaptures";

export type Capture = Pick<PendingCapture, "blob" | "typedText" | "transcript" | "durationSeconds">;
type OpenReview = (jobId: string) => void;

const POLL_MS = 1500;
const POLL_CAP_MS = 3 * 60_000;

// Captures this tab knows about (IndexedDB may be unavailable) and those uploading now.
const captures = new Map<string, PendingCapture>();
const inFlight = new Set<string>();
let resumed = false;

function placeholderFor(c: PendingCapture, parseStatus: "processing" | "failed", error: string | null = null): LogSession {
  return {
    id: c.id,
    userId: c.uid,
    inputType: c.blob ? (c.typedText ? "mixed" : "voice") : "text",
    audioDurationSeconds: c.durationSeconds,
    transcript: c.transcript,
    typedTextBefore: c.typedText,
    parseStatus,
    entryCount: 0,
    error,
    createdAt: c.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function showPlaceholder(client: QueryClient, session: LogSession) {
  setPlaceholder(session);
  client.setQueryData<LogSession[]>(qk.logSessions, (old) => withPendingCaptures(old ?? []));
}

/**
 * Optimistic capture: the recording is saved on the device, appears as
 * "organizing" immediately, and the user is free to leave. Upload + Gemini parse
 * run in the background; a toast links to review when it's ready. Lives outside
 * React so it survives the recorder screen unmounting.
 */
export async function submitCapture(client: QueryClient, capture: Capture, openReview: OpenReview): Promise<void> {
  const c: PendingCapture = { ...capture, ...newCaptureIds(), uid: readActiveUid() ?? "", createdAt: new Date().toISOString() };
  captures.set(c.id, c);
  await savePendingCapture(c).catch(() => {}); // durable when IndexedDB is available
  void client.cancelQueries({ queryKey: qk.logSessions });
  showPlaceholder(client, placeholderFor(c, "processing"));
  toast.success("Got it — organizing your log", { duration: 2000 });
  void upload(client, c, openReview);
}

/** Re-send a capture whose upload failed (from the toast or the Inbox). */
export async function retryCapture(client: QueryClient, id: string, openReview: OpenReview): Promise<void> {
  const found = captures.get(id) ?? (await getPendingCapture(id));
  if (!found) {
    discardCapture(client, id);
    toast.error("That recording is no longer available on this device.");
    return;
  }
  const c = { ...found, permanentError: null }; // the user asked: try again regardless
  captures.set(id, c);
  showPlaceholder(client, placeholderFor(c, "processing"));
  void upload(client, c, openReview);
}

/** Drop a capture that never reached the server. */
export function discardCapture(client: QueryClient, id: string): void {
  captures.delete(id);
  removePlaceholder(id);
  void deletePendingCapture(id);
  client.setQueryData<LogSession[]>(qk.logSessions, (old) => old?.filter((s) => s.id !== id));
}

/** On app open: upload anything recorded earlier that the server never received. */
export async function resumePendingCaptures(client: QueryClient, openReview: OpenReview): Promise<void> {
  const uid = readActiveUid();
  if (resumed || !uid) return;
  resumed = true;
  for (const c of await listPendingCaptures(uid)) {
    if (inFlight.has(c.id)) continue;
    captures.set(c.id, c);
    if (c.permanentError) {
      // The server refused it before: list it in the Inbox, but only resend on Retry.
      showPlaceholder(client, placeholderFor(c, "failed", c.permanentError));
      continue;
    }
    showPlaceholder(client, placeholderFor(c, "processing"));
    void upload(client, c, openReview);
  }
}

class UploadError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
  }
}

async function upload(client: QueryClient, c: PendingCapture, openReview: OpenReview): Promise<void> {
  if (inFlight.has(c.id)) return;
  if (readActiveUid() !== c.uid) return; // recorded under another account: leave it for that account
  inFlight.add(c.id);
  let jobId: string;
  try {
    const audioBase64 = c.blob ? await blobToBase64(c.blob) : null;
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        audioMime: c.blob?.type ?? null,
        typedText: c.typedText,
        transcript: c.transcript,
        audioDurationSeconds: c.durationSeconds,
        inputType: placeholderFor(c, "processing").inputType,
        clientId: c.clientId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // A 4xx (other than a timeout / rate limit) won't succeed by resending it.
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
      const message =
        res.status === 413 ? "This recording is too long to upload." : data.error || "Could not save your recording";
      throw new UploadError(message, permanent);
    }
    jobId = data.jobId;
  } catch (e) {
    if (!captures.has(c.id)) return; // dismissed while uploading
    // Keep the recording (device + Inbox) so it can be retried — automatically on
    // next open for network/server blips, only on request if the server refused it.
    const message = e instanceof Error ? e.message : "Could not save your recording";
    const failed = { ...c, permanentError: e instanceof UploadError && e.permanent ? message : null };
    captures.set(c.id, failed);
    void savePendingCapture(failed).catch(() => {});
    showPlaceholder(client, placeholderFor(failed, "failed", message));
    toast.error(message, {
      duration: 10_000,
      action: { label: "Retry", onClick: () => void retryCapture(client, c.id, openReview) },
    });
    return;
  } finally {
    inFlight.delete(c.id);
  }

  if (!captures.has(c.id)) {
    // Dismissed while uploading, but the server got it: discard that job too.
    void getStore().updateLogSession(jobId, { parseStatus: "discarded" }).catch(() => {});
    return;
  }

  // The server has it: forget the local copy; its list (holding the job) replaces the placeholder.
  captures.delete(c.id);
  removePlaceholder(c.id);
  await deletePendingCapture(c.id);
  invalidateLogSessions(client);

  const started = Date.now();
  while (Date.now() - started < POLL_CAP_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const s = await getStore().getLogSession(jobId).catch(() => null);
    if (s?.parseStatus === "parsed") {
      invalidateLogSessions(client);
      toast.success("Your log is ready to review", {
        duration: 10_000,
        action: { label: "Review", onClick: () => openReview(jobId) },
      });
      return;
    }
    if (s?.parseStatus === "failed") {
      invalidateLogSessions(client);
      toast.error(s.error || "We couldn't organize that — it's in your Inbox to retry.");
      return;
    }
  }
}
