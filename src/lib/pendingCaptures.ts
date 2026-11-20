"use client";

import type { LogSession } from "@/lib/store/types";

/**
 * Captures recorded on this device that the server hasn't accepted yet. The audio
 * is kept in IndexedDB until /api/jobs returns a job id, so closing the app
 * mid-upload never loses a recording; the placeholders are merged into the
 * Inbox list so background refetches can't wipe them.
 */

export type PendingCapture = {
  id: string; // "local-<clientId>"
  clientId: string; // sent to the server, so a re-sent capture maps to the same job
  uid: string; // the account it was recorded under
  blob: Blob | null;
  typedText: string | null;
  transcript: string | null;
  durationSeconds: number;
  createdAt: string;
  /** The server refused it (not a network blip): don't auto-resend on app open. */
  permanentError?: string | null;
};

const LOCAL_PREFIX = "local-";
const DB_NAME = "avni-captures";
const STORE = "pending";

export function isLocalCapture(id: string): boolean {
  return id.startsWith(LOCAL_PREFIX);
}

/** RFC 4122 v4 UUID; randomUUID only exists on HTTPS/localhost, so fall back for LAN testing. */
function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newCaptureIds(): { id: string; clientId: string } {
  const clientId = uuid();
  return { id: `${LOCAL_PREFIX}${clientId}`, clientId };
}

// ---- placeholders shown in the Inbox / Today card --------------------------

const placeholders = new Map<string, LogSession>();

export function setPlaceholder(session: LogSession): void {
  placeholders.set(session.id, session);
}

export function removePlaceholder(id: string): void {
  placeholders.delete(id);
}

/** The server list with this device's not-yet-accepted captures on top. */
export function withPendingCaptures(list: LogSession[]): LogSession[] {
  return [...placeholders.values(), ...list.filter((s) => !placeholders.has(s.id))];
}

// ---- IndexedDB persistence (best-effort: private mode may refuse it) -------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function savePendingCapture(capture: PendingCapture): Promise<void> {
  await run("readwrite", (s) => s.put(capture));
}

export async function deletePendingCapture(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id)).catch(() => {});
}

export async function getPendingCapture(id: string): Promise<PendingCapture | undefined> {
  return run<PendingCapture | undefined>("readonly", (s) => s.get(id)).catch(() => undefined);
}

export async function listPendingCaptures(uid: string): Promise<PendingCapture[]> {
  const all = await run<PendingCapture[]>("readonly", (s) => s.getAll()).catch(() => []);
  return all.filter((c) => c.uid === uid);
}
