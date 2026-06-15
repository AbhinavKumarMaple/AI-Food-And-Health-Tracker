"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, KeyRound, Cpu, LogOut, RefreshCw, Smartphone, Mic, Share } from "lucide-react";
import { getAuth, getStore } from "@/lib/store";
import type { UserSettings, FollowUpAggressiveness, Units } from "@/lib/store/types";
import { useAuth } from "@/lib/useAuth";
import { useSettings, useGeminiModels, useQueryClient, qk, clearAllCache } from "@/lib/queries";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { FormSkeleton } from "@/components/skeletons";
import { Card } from "@/components/cards";
import { PrimaryButton } from "@/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const settingsQ = useSettings(!!user);
  const settings = settingsQ.data ?? null;
  const install = useInstallPrompt();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const seeded = useRef(false);

  // Auto-load (and cache) the live model list for the SAVED key — so the picker
  // is populated whenever Settings opens, not only after pressing the button.
  const modelsQ = useGeminiModels(settings?.geminiApiKey);
  const models = modelsQ.data ?? [];
  const modelsError = modelsQ.error instanceof Error ? modelsQ.error.message : null;

  useEffect(() => {
    if (settingsQ.data && !seeded.current) {
      seeded.current = true;
      setApiKey(settingsQ.data.geminiApiKey ?? "");
    }
  }, [settingsQ.data]);

  async function saveKey() {
    setError(null);
    setSaving(true);
    try {
      const key = apiKey.trim();
      await getStore().updateSettings({ geminiApiKey: key || null });
      queryClient.invalidateQueries({ queryKey: qk.settings });
      // Refetch the catalogue for the new key (the query re-keys off the saved key).
      queryClient.invalidateQueries({ queryKey: ["geminiModels"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function patch(p: Partial<UserSettings>) {
    await getStore().updateSettings(p);
    queryClient.invalidateQueries({ queryKey: qk.settings });
  }

  async function signOut() {
    await getAuth().signOut();
    clearAllCache(queryClient);
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
        {/* Add to home screen */}
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <Smartphone size={15} className="text-primary" /> Home-screen shortcut
          </h2>
          <Card>
            <p className="text-[13px] leading-snug text-muted">
              Add Avni to your phone&apos;s home screen so it opens like an app. Its{" "}
              <span className="font-semibold text-ink">Quick voice log</span> shortcut jumps straight
              into recording — no clicks, just talk.
            </p>
            {install.installed ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-success-tint px-3 py-2.5 text-[13px] font-semibold text-success">
                <Check size={15} /> Installed — long-press the icon for “Quick voice log”.
              </div>
            ) : install.canInstall ? (
              <PrimaryButton icon={Smartphone} onClick={install.promptInstall} className="mt-3">
                Add Avni to home screen
              </PrimaryButton>
            ) : install.isIOS ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-canvas px-3 py-2.5 text-[12.5px] text-muted">
                <Share size={15} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  In Safari, tap the <span className="font-semibold text-ink">Share</span> button, then{" "}
                  <span className="font-semibold text-ink">Add to Home Screen</span>.
                </span>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-faint">
                Open Avni in Chrome or Safari on your phone to add it to your home screen.
              </p>
            )}
            <Link href="/record" className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-primary-press">
              <Mic size={14} /> Try a quick voice log now
            </Link>
          </Card>
        </section>

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
              icon={saving || modelsQ.isFetching ? RefreshCw : Check}
              onClick={saveKey}
              disabled={saving}
              className="mt-3"
            >
              {saving ? "Saving…" : modelsQ.isFetching ? "Loading models…" : saved ? "Saved" : "Save & load models"}
            </PrimaryButton>
            {(error || modelsError) && <p className="mt-2 text-[12px] text-danger">{error || modelsError}</p>}
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
              {/* Always keep the current selection as a valid option. */}
              {!models.some((m) => m.baseModelId === settings.selectedModel) && (
                <option value={settings.selectedModel}>{settings.selectedModel}</option>
              )}
              {models.map((m) => (
                <option key={m.name} value={m.baseModelId}>
                  {m.displayName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-faint">
              {models.length > 0
                ? `${models.length} models available with your key.`
                : modelsQ.isFetching
                  ? "Loading the live model list from Google…"
                  : settings.geminiApiKey
                    ? "Couldn't load the model list — check your key."
                    : "Save your Gemini API key above to load the live model list."}
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
