"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Cpu, LogOut, RefreshCw } from "lucide-react";
import { getAuth, getStore } from "@/lib/store";
import type { UserSettings, FollowUpAggressiveness, Units } from "@/lib/store/types";
import type { GeminiModel } from "@/lib/gemini/models";
import { useAuth } from "@/lib/useAuth";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { FormSkeleton } from "@/components/skeletons";
import { Card } from "@/components/cards";
import { PrimaryButton } from "@/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      getStore()
        .getSettings()
        .then((s) => {
          setSettings(s);
          setApiKey(s.geminiApiKey ?? "");
        });
    }
  }, [user]);

  async function saveAndLoadModels() {
    setError(null);
    setLoadingModels(true);
    try {
      const key = apiKey.trim();
      const next = await getStore().updateSettings({ geminiApiKey: key || null });
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      if (key) {
        const res = await fetch("/api/gemini/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load models");
        setModels(data.models as GeminiModel[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoadingModels(false);
    }
  }

  async function patch(p: Partial<UserSettings>) {
    setSettings(await getStore().updateSettings(p));
  }

  async function signOut() {
    await getAuth().signOut();
    router.replace("/login");
  }

  if (loading || !user || !settings) {
    return (
      <Screen showTab={false}>
        <FormSkeleton />
      </Screen>
    );
  }

  return (
    <Screen showTab={false}>
      <PageHeader title="Settings" eyebrow="Preferences" />
      <div className="flex flex-col gap-5 px-5 pb-10 pt-2">
        {/* AI / Gemini */}
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <KeyRound size={15} className="text-primary" /> Gemini API key
          </h2>
          <Card>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza…"
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-[14px] text-ink outline-none focus:border-primary"
            />
            <p className="mt-2 text-[11px] text-faint">
              Stored locally on this device. Used to transcribe audio and structure your logs.
            </p>
            <PrimaryButton
              icon={loadingModels ? RefreshCw : Check}
              onClick={saveAndLoadModels}
              disabled={loadingModels}
              className="mt-3"
            >
              {loadingModels ? "Loading models…" : saved ? "Saved" : "Save & load models"}
            </PrimaryButton>
            {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
          </Card>
        </section>

        {/* Model picker */}
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <Cpu size={15} className="text-primary" /> Model
          </h2>
          <Card>
            <select
              value={settings.selectedModel}
              onChange={(e) => patch({ selectedModel: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-[14px] text-ink outline-none focus:border-primary"
            >
              {models.length === 0 && <option value={settings.selectedModel}>{settings.selectedModel}</option>}
              {models.map((m) => (
                <option key={m.name} value={m.baseModelId}>
                  {m.displayName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-faint">
              {models.length > 0
                ? `${models.length} models available with your key.`
                : "Save your key above to load the live model list from Google."}
            </p>
          </Card>
        </section>

        {/* Preferences */}
        <section className="flex flex-col gap-2.5">
          <h2 className="px-1 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            Logging
          </h2>
          <Card>
            <Segmented<Units>
              label="Units"
              value={settings.units}
              options={[
                { value: "metric", label: "Metric" },
                { value: "imperial", label: "Imperial" },
              ]}
              onChange={(v) => patch({ units: v })}
            />
            <div className="my-3 h-px bg-line" />
            <Segmented<FollowUpAggressiveness>
              label="Follow-up questions"
              value={settings.followUpAggressiveness}
              options={[
                { value: "low", label: "Few" },
                { value: "medium", label: "Balanced" },
                { value: "high", label: "Thorough" },
              ]}
              onChange={(v) => patch({ followUpAggressiveness: v })}
            />
          </Card>
        </section>

        <button
          onClick={signOut}
          className="mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-[15px] font-semibold text-danger"
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </Screen>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>
        {label}
      </span>
      <div className="flex gap-1.5 rounded-xl bg-canvas p-1">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={
              "flex-1 rounded-lg py-2 text-[13px] font-semibold transition " +
              (value === o.value ? "bg-primary text-white shadow-sm" : "text-muted")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
