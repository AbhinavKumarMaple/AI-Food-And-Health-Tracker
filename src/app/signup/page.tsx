"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getAuth } from "@/lib/store";
import { PrimaryButton } from "@/components/ui";
import { Field } from "../login/page";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await getAuth().signUp(email, password, name);
      window.location.assign("/"); // full reload → this account's cookie + cache
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
          <Sparkles size={26} />
        </span>
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
          Create your journal
        </h1>
        <p className="text-sm text-muted">Track meals, symptoms &amp; mood by voice</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Name" type="text" value={name} onChange={setName} autoComplete="name" />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        {error && <p className="px-1 text-sm text-danger">{error}</p>}
        <PrimaryButton type="submit" disabled={busy} className="mt-2">
          {busy ? "Creating…" : "Create account"}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary-press">
          Sign in
        </Link>
      </p>
    </div>
  );
}
