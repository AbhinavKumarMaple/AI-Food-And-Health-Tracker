import type { User } from "./types";

// Client auth that talks to the server session API. Mirrors the old local
// AuthService surface, but methods that hit the network are async.
export interface AuthService {
  signUp(email: string, password: string, name?: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
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

  async signOut(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
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
}
