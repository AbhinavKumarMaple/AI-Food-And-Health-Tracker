import type { User } from "./types";

/** A signed-in account on this device (for the account switcher). No tokens. */
export type AccountSummary = { uid: string; name: string | null; email: string; active: boolean };

// Client auth that talks to the server session API. Mirrors the old local
// AuthService surface, but methods that hit the network are async.
export interface AuthService {
  signUp(email: string, password: string, name?: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  /** Sign out the current account (switches to another if signed in), or all. */
  signOut(all?: boolean): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  /** Accounts signed in on this device. */
  listAccounts(): Promise<AccountSummary[]>;
  /** Switch to an already-signed-in account without a password. */
  switchAccount(uid: string): Promise<void>;
}

export class ApiAuth implements AuthService {
  async signUp(email: string, password: string, name?: string): Promise<User> {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, timezone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sign up failed");
    return data.user as User;
  }

  async signIn(email: string, password: string): Promise<User> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid email or password");
    return data.user as User;
  }

  async signOut(all = false): Promise<void> {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all }),
    });
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      const data = await res.json();
      return (data.user as User) ?? null;
    } catch {
      return null;
    }
  }

  async listAccounts(): Promise<AccountSummary[]> {
    try {
      const res = await fetch("/api/auth/accounts");
      if (!res.ok) return [];
      const data = await res.json();
      return (data.accounts as AccountSummary[]) ?? [];
    } catch {
      return [];
    }
  }

  async switchAccount(uid: string): Promise<void> {
    const res = await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Couldn't switch account");
    }
  }
}
