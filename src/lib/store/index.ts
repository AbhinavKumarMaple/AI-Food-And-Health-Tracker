import { LocalAuth, type AuthService } from "./auth";
import type { DataStore } from "./dataStore";
import { getKVBackend } from "./kv";
import { LocalDataStore } from "./localDataStore";

// Single import point for persistence. Today these resolve to the localStorage
// implementation; swapping to a Postgres/API backend later means returning a
// different implementation here — no screen changes required.

let authSingleton: LocalAuth | null = null;
let storeSingleton: LocalDataStore | null = null;

export function getAuth(): AuthService & LocalAuth {
  if (!authSingleton) authSingleton = new LocalAuth(getKVBackend());
  return authSingleton;
}

export function getStore(): DataStore {
  if (!storeSingleton) {
    storeSingleton = new LocalDataStore(getAuth(), getKVBackend());
  }
  return storeSingleton;
}

export type { DataStore } from "./dataStore";
export type { AuthService } from "./auth";
export * from "./types";
export type {
  NewMeal,
  NewSymptom,
  NewMood,
  NewHydration,
  NewFollowUp,
  NewLogSession,
  DateRange,
} from "./dataStore";
