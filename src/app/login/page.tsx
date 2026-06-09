"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getAuth } from "@/lib/store";
import { PrimaryButton } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await getAuth().signIn(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
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
          Welcome back
        </h1>
        <p className="text-sm text-muted">Sign in to your food &amp; health journal</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error && <p className="px-1 text-sm text-danger">{error}</p>}
        <PrimaryButton type="submit" disabled={busy} className="mt-2">
          {busy ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-primary-press">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-1 text-[12px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink outline-none focus:border-primary"
      />
    </label>
  );
}
