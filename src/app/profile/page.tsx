"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, LogOut, Check, ChevronRight, HeartPulse } from "lucide-react";
import { getAuth, getStore } from "@/lib/store";
import type { User } from "@/lib/store/types";
import { useAuth } from "@/lib/useAuth";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { FormSkeleton } from "@/components/skeletons";
import { Card } from "@/components/cards";
import { PrimaryButton } from "@/components/ui";

function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) getStore().getProfile().then(setProfile);
  }, [user]);

  function set<K extends keyof User>(key: K, value: User[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!profile) return;
    await getStore().updateProfile({
      name: profile.name,
      dietaryPattern: profile.dietaryPattern,
      knownAllergies: profile.knownAllergies,
      intolerances: profile.intolerances,
      chronicConditions: profile.chronicConditions,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function signOut() {
    await getAuth().signOut();
    router.replace("/login");
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
            Helps Avni flag allergens and tailor follow-up questions to you.
          </p>
          <Card>
            <div className="flex flex-col gap-3">
              <ProfileField label="Display name" value={profile.name ?? ""} onChange={(v) => set("name", v)} />
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

        {/* Links */}
        <Link href="/settings" className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <Settings size={18} className="text-muted" />
          <span className="flex-1 text-[14px] font-semibold text-ink">AI &amp; preferences</span>
          <ChevronRight size={18} className="text-faint" />
        </Link>

        <button onClick={signOut} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-[15px] font-semibold text-danger">
          <LogOut size={18} /> Sign out
        </button>
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
