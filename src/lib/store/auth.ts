import {
  getKVBackend,
  KEY_PREFIX,
  readJSON,
  writeJSON,
  type KVBackend,
} from "./kv";
import type { ID, User } from "./types";
import { newId, nowIso } from "./util";

// Local-first auth. Users + the active session live in the KV backend. Passwords
// are salted-SHA-256 hashed via Web Crypto (sufficient for a local-only phase;
// the future server backend uses bcrypt + real sessions via Auth.js).

const USERS_KEY = `${KEY_PREFIX}:users`;
const SESSION_KEY = `${KEY_PREFIX}:session`;

type StoredUser = User & { passwordHash: string; passwordSalt: string };

export interface AuthService {
  signUp(email: string, password: string, name?: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): void;
  currentUserId(): ID | null;
  getCurrentUser(): User | null;
}

function publicUser(u: StoredUser): User {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = u;
  return rest;
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${saltHex}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class LocalAuth implements AuthService {
  constructor(private kv: KVBackend = getKVBackend()) {}

  private readUsers(): StoredUser[] {
    return readJSON<StoredUser[]>(this.kv, USERS_KEY, []);
  }
  private writeUsers(users: StoredUser[]) {
    writeJSON(this.kv, USERS_KEY, users);
  }

  async signUp(email: string, password: string, name?: string): Promise<User> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) throw new Error("Email and password are required");
    const users = this.readUsers();
    if (users.some((u) => u.email === normalized)) {
      throw new Error("An account with this email already exists");
    }
    const salt = randomSaltHex();
    const passwordHash = await hashPassword(password, salt);
    const now = nowIso();
    const user: StoredUser = {
      id: newId(),
      email: normalized,
      name: name?.trim() || null,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      dateOfBirth: null,
      sex: null,
      heightCm: null,
      weightKg: null,
      knownAllergies: [],
      intolerances: [],
      chronicConditions: [],
      medications: [],
      dietaryPattern: null,
      healthGoals: [],
      createdAt: now,
      updatedAt: now,
      passwordHash,
      passwordSalt: salt,
    };
    users.push(user);
    this.writeUsers(users);
    this.kv.setItem(SESSION_KEY, user.id);
    return publicUser(user);
  }

  async signIn(email: string, password: string): Promise<User> {
    const normalized = email.trim().toLowerCase();
    const users = this.readUsers();
    const user = users.find((u) => u.email === normalized);
    if (!user) throw new Error("Invalid email or password");
    const hash = await hashPassword(password, user.passwordSalt);
    if (hash !== user.passwordHash) throw new Error("Invalid email or password");
    this.kv.setItem(SESSION_KEY, user.id);
    return publicUser(user);
  }

  signOut(): void {
    this.kv.removeItem(SESSION_KEY);
  }

  currentUserId(): ID | null {
    return this.kv.getItem(SESSION_KEY);
  }

  getCurrentUser(): User | null {
    const id = this.currentUserId();
    if (!id) return null;
    const user = this.readUsers().find((u) => u.id === id);
    return user ? publicUser(user) : null;
  }

  // Used by the local data store to read/update the profile record.
  getUserRecord(id: ID): User | null {
    const u = this.readUsers().find((x) => x.id === id);
    return u ? publicUser(u) : null;
  }
  updateUserRecord(id: ID, patch: Partial<User>): User {
    const users = this.readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error("User not found");
    users[idx] = { ...users[idx], ...patch, updatedAt: nowIso() };
    this.writeUsers(users);
    return publicUser(users[idx]);
  }
}
