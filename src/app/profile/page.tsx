"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, LogOut, Check, ChevronRight, HeartPulse, Droplet, CloudSun, Plus, ArrowLeftRight } from "lucide-react";
import { getAuth, getStore, type AccountSummary } from "@/lib/store";
import type { User } from "@/lib/store/types";
import { useAuth } from "@/lib/useAuth";
import { useProfile, useSettings, useQueryClient, qk, clearAllCache } from "@/lib/queries";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { FormSkeleton } from "@/components/skeletons";
import { Card } from "@/components/cards";
import { PrimaryButton } from "@/components/ui";
import { Switch } from "@/components/ui/switch";

function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const profQ = useProfile(!!user);
  const settingsQ = useSettings(!!user);
  const [profile, setProfile] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (user) getAuth().listAccounts().then(setAccounts);
  }, [user]);

  const cycleEnabled = settingsQ.data?.cycleTrackingEnabled ?? false;
  async function toggleCycle(next: boolean) {
    await getStore().updateSettings({ cycleTrackingEnabled: next });
    queryClient.invalidateQueries({ queryKey: qk.settings });
  }

  const envEnabled = settingsQ.data?.envTrackingEnabled ?? false;
  async function toggleEnv(next: boolean) {
    await getStore().updateSettings({ envTrackingEnabled: next });
    queryClient.invalidateQueries({ queryKey: qk.settings });
  }

  useEffect(() => {
    if (profQ.data) setProfile(profQ.data);
  }, [profQ.data]);

  function set<K extends keyof User>(key: K, value: User[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!profile) return;
    await getStore().updateProfile({
      name: profile.name,
      location: profile.location,
      languages: profile.languages,
      dietaryPattern: profile.dietaryPattern,
      knownAllergies: profile.knownAllergies,
      intolerances: profile.intolerances,
      chronicConditions: profile.chronicConditions,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
    });
    queryClient.invalidateQueries({ queryKey: qk.profile });
    queryClient.invalidateQueries({ queryKey: qk.currentUser });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function switchTo(uid: string) {
    if (uid === user?.id || switching) return;
    setSwitching(true);
    try {
      await getAuth().switchAccount(uid);
      window.location.assign("/"); // reload → that account's cookie + cache
    } catch {
      setSwitching(false);
    }
  }

  async function signOutCurrent() {
    const uid = user?.id ?? null;
    await getAuth().signOut(); // server: drop from jar, switch to another if any
    clearAllCache(queryClient, uid); // clear THIS account's cache explicitly
    window.location.assign("/"); // reload → next account, or /login if none left
  }

  async function signOutAll() {
    await getAuth().signOut(true);
    accounts.forEach((a) => window.localStorage.removeItem(`avni-query-cache:${a.uid}`));
    queryClient.clear();
    window.location.assign("/login");
  }

  if (loading || !user || !profile) {
    return (
      <Screen>
        <FormSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="Profile" eyebrow="Account" back={false} />

      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        {/* Identity */}
        <Card>
          <div className="flex items-center gap-3.5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-[22px] font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {(profile.name || profile.email)[0]?.toUpperCase()}
            </span>
            <div className="flex flex-col">
              <span className="text-[18px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                {profile.name || "You"}
              </span>
              <span className="text-[13px] text-muted">{profile.email}</span>
            </div>
          </div>
        </Card>

        {/* Health context */}
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <HeartPulse size={15} className="text-primary" /> Health context
          </h2>
          <p className="px-1 text-[11px] text-faint">
            Helps Avni read regional food names, flag allergens, and tailor follow-up questions to you.
          </p>
          <Card>
            <div className="flex flex-col gap-3">
              <ProfileField label="Display name" value={profile.name ?? ""} onChange={(v) => set("name", v)} />
              <ProfileField
                label="Location / region"
                placeholder="e.g. Pune, Maharashtra, India"
                value={profile.location ?? ""}
                onChange={(v) => set("location", v)}
              />
              <ProfileField
                label="Languages you mix when speaking"
                placeholder="e.g. Marathi, Hindi, English"
                value={profile.languages.join(", ")}
                onChange={(v) => set("languages", splitList(v))}
              />
              <ProfileField label="Dietary pattern" placeholder="e.g. omnivore, vegetarian" value={profile.dietaryPattern ?? ""} onChange={(v) => set("dietaryPattern", v)} />
              <ProfileField label="Allergies (comma separated)" value={profile.knownAllergies.join(", ")} onChange={(v) => set("knownAllergies", splitList(v))} />
              <ProfileField label="Intolerances" placeholder="e.g. lactose, gluten" value={profile.intolerances.join(", ")} onChange={(v) => set("intolerances", splitList(v))} />
              <ProfileField label="Chronic conditions" value={profile.chronicConditions.join(", ")} onChange={(v) => set("chronicConditions", splitList(v))} />
              <div className="flex gap-3">
                <ProfileField className="flex-1" label="Height (cm)" type="number" value={profile.heightCm != null ? String(profile.heightCm) : ""} onChange={(v) => set("heightCm", v ? Number(v) : null)} />
                <ProfileField className="flex-1" label="Weight (kg)" type="number" value={profile.weightKg != null ? String(profile.weightKg) : ""} onChange={(v) => set("weightKg", v ? Number(v) : null)} />
              </div>
            </div>
            <PrimaryButton icon={Check} onClick={save} className="mt-4">
              {saved ? "Saved" : "Save profile"}
            </PrimaryButton>
          </Card>
        </section>

        {/* Cycle tracking (optional, all genders) */}
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <Droplet size={15} className="text-primary" /> Cycle tracking
          </h2>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-ink">Track my menstrual cycle</span>
                <span className="text-[12px] text-muted">Optional. Predicts your period and separates cycle effects from food.</span>
              </div>
              <Switch checked={cycleEnabled} onCheckedChange={toggleCycle} aria-label="Track my menstrual cycle" />
            </div>
            {cycleEnabled && (
              <Link href="/cycle" className="mt-3 flex items-center gap-2 rounded-xl bg-primary-tint px-3 py-2.5 text-[13px] font-semibold text-primary-press">
                <Droplet size={15} /> Open cycle tracker
                <ChevronRight size={15} className="ml-auto" />
              </Link>
            )}
          </Card>
        </section>

        {/* Environment auto-logging (free, coarse) */}
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <CloudSun size={15} className="text-primary" /> Environment
          </h2>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-ink">Auto-log weather &amp; surroundings</span>
                <span className="text-[12px] text-muted">Free, coarse location only — weather, air quality, daylight, moon &amp; season for each day.</span>
              </div>
              <Switch checked={envEnabled} onCheckedChange={toggleEnv} aria-label="Auto-log weather and surroundings" />
            </div>
          </Card>
        </section>

        {/* Links */}
        <Link href="/settings" className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <Settings size={18} className="text-muted" />
          <span className="flex-1 text-[14px] font-semibold text-ink">AI &amp; preferences</span>
          <ChevronRight size={18} className="text-faint" />
        </Link>

        {/* Accounts — save & switch between accounts without logging in each time */}
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <ArrowLeftRight size={15} className="text-primary" /> Accounts
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {accounts.map((a, i) => (
              <button
                key={a.uid}
                onClick={() => switchTo(a.uid)}
                disabled={a.active || switching}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${i > 0 ? "border-t border-line" : ""} ${a.active ? "" : "hover:bg-warm active:scale-[0.99]"}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {(a.name || a.email)[0]?.toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold text-ink">{a.name || "You"}</span>
                  <span className="truncate text-[12px] text-muted">{a.email}</span>
                </div>
                {a.active ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-success" style={{ fontFamily: "var(--font-label)" }}>
                    <Check size={14} /> Active
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-primary-press" style={{ fontFamily: "var(--font-label)" }}>
                    Switch
                  </span>
                )}
              </button>
            ))}
            <Link
              href="/login"
              className={`flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-primary-press ${accounts.length ? "border-t border-line" : ""}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-primary">
                <Plus size={16} />
              </span>
              Add another account
            </Link>
          </div>
        </section>

        <button onClick={signOutCurrent} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-[15px] font-semibold text-danger">
          <LogOut size={18} /> Sign out{accounts.length > 1 ? " of this account" : ""}
        </button>
        {accounts.length > 1 && (
          <button onClick={signOutAll} className="-mt-2 self-center px-3 py-1 text-[13px] font-medium text-faint">
            Sign out of all accounts
          </button>
        )}
      </div>
    </Screen>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[11px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-[14px] text-ink outline-none focus:border-primary"
      />
    </label>
  );
}
