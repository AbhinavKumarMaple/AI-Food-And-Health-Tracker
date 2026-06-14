import { ApiAuth, type AuthService } from "./apiAuth";
import { ApiDataStore } from "./apiDataStore";
import type { DataStore } from "./dataStore";

// Single import point for persistence + auth. These now resolve to the
// Supabase-backed implementations (server Prisma via the /api routes). The
// localStorage implementation remains in the repo for offline/testing use.

let authSingleton: ApiAuth | null = null;
let storeSingleton: ApiDataStore | null = null;

export function getAuth(): AuthService {
  if (!authSingleton) authSingleton = new ApiAuth();
  return authSingleton;
}

export function getStore(): DataStore {
  if (!storeSingleton) storeSingleton = new ApiDataStore();
  return storeSingleton;
}

export type { DataStore } from "./dataStore";
export type { AuthService } from "./apiAuth";
export * from "./types";
export type {
  NewMeal,
  NewSymptom,
  NewMood,
  NewHydration,
  NewFollowUp,
  NewLogSession,
  CycleLogPatch,
  DateRange,
} from "./dataStore";
