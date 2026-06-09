// Minimal key/value backend so the local store works in the browser
// (window.localStorage) and degrades to an in-memory map during SSR/tests.

export interface KVBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryKV implements KVBackend {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const memory = new MemoryKV();

export function getKVBackend(): KVBackend {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memory;
}

export function readJSON<T>(kv: KVBackend, key: string, fallback: T): T {
  const raw = kv.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(kv: KVBackend, key: string, value: unknown): void {
  kv.setItem(key, JSON.stringify(value));
}

export const KEY_PREFIX = "avni";
