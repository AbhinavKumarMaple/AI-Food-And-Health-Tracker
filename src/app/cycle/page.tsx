"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Droplet,
  Sparkles,
  CalendarDays,
  Activity,
  Plus,
  Check,
  Info,
  ShieldQuestion,
  ChevronDown,
} from "lucide-react";
import { getStore } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import {
  useSettings,
  useCycleLogs,
  useCorrelationDataset,
  useQueryClient,
  qk,
  invalidateEntries,
} from "@/lib/queries";
import { todayISODate, nowIso } from "@/lib/store/util";
import type { CycleLog, FlowLevel } from "@/lib/store/types";
import {
  buildPhaseResolver,
  cycleRedFlags,
  lastDeviation,
  type Cycle,
} from "@/lib/cycle/engine";
import type { CycleLogPatch } from "@/lib/store/dataStore";
import { analyzeSymptomCyclePatterns } from "@/lib/cycle/confounder";
import { PHASE_META, predictionLine, confidenceNote, fmtDate } from "@/lib/cycle/present";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { RefreshButton } from "@/components/RefreshButton";
import { GradientPanel } from "@/components/GradientPanel";
import { Card } from "@/components/cards";
import { IconBadge, Chip, PrimaryButton } from "@/components/ui";
import { FormSkeleton } from "@/components/skeletons";

const FLOW_OPTIONS: { value: FlowLevel; label: string }[] = [
  { value: "spotting", label: "Spotting" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
  { value: "flooding", label: "Flooding" },
];

const SYMPTOM_OPTIONS: { type: string; label: string }[] = [
  { type: "cramps", label: "Cramps" },
  { type: "bloating", label: "Bloating" },
  { type: "headache", label: "Headache" },
  { type: "breast_tenderness", label: "Breast tenderness" },
  { type: "fatigue", label: "Fatigue" },
  { type: "nausea", label: "Nausea" },
  { type: "back_pain", label: "Back pain" },
  { type: "acne", label: "Acne" },
  { type: "mood", label: "Low mood" },
  { type: "irritability", label: "Irritability" },
  { type: "anxiety", label: "Anxiety" },
  { type: "cravings", label: "Cravings" },
];

/** Merge a patch into the cached cycle-day row (or create it) for optimistic UI. */
function applyCyclePatch(logs: CycleLog[], date: string, patch: CycleLogPatch): CycleLog[] {
  const now = nowIso();
  const idx = logs.findIndex((l) => l.date === date);
  if (idx === -1) {
    const created: CycleLog = {
      id: `temp-${date}`,
      userId: "",
      date,
      isPeriodStart: false,
      flow: null,
      clots: false,
      flooding: false,
      bbtCelsius: null,
      cervicalMucus: null,
      ovulationTest: null,
      intercourse: null,
      notes: null,
      source: "manual",
      createdAt: now,
      updatedAt: now,
      ...patch,
    };
    return [...logs, created].sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  return logs.map((l, i) => (i === idx ? { ...l, ...patch, updatedAt: now } : l));
}

export default function CyclePage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const settingsQ = useSettings(!!user);
  const logsQ = useCycleLogs(!!user);
  const corrQ = useCorrelationDataset(!!user);

  const settings = settingsQ.data;
  const logs = logsQ.data;
  const today = todayISODate();
  const [advanced, setAdvanced] = useState(false);
  const [addedSymptom, setAddedSymptom] = useState<string | null>(null);

  const analysis = useMemo(() => {
    if (!logs) return null;
    return buildPhaseResolver(logs, {
      today,
      avgPrior: settings?.cycleAvgLengthDays ?? 28,
    });
  }, [logs, today, settings?.cycleAvgLengthDays]);

  const todayLog = useMemo(() => logs?.find((l) => l.date === today) ?? null, [logs, today]);

  const flags = useMemo(
    () => (analysis && logs ? cycleRedFlags(analysis.cycles, analysis.stats, logs, today) : []),
    [analysis, logs, today],
  );

  const deviation = useMemo(
    () => (analysis ? lastDeviation(analysis.cycles, analysis.stats) : null),
    [analysis],
  );

  const cyclePatterns = useMemo(() => {
    if (!corrQ.data) return [];
    const res = analyzeSymptomCyclePatterns(corrQ.data, {
      today,
      avgPrior: settings?.cycleAvgLengthDays ?? 28,
    });
    if (!res) return [];
    return [...res.patterns.values()].filter((p) => p.cycleLinked);
  }, [corrQ.data, today, settings?.cycleAvgLengthDays]);

  async function patchToday(patch: CycleLogPatch) {
    // Optimistic: write to the cache immediately so the UI (flow chips, phase,
    // prediction, Today card) updates with no wait, then sync to the API.
    await queryClient.cancelQueries({ queryKey: qk.cycleLogs });
    const prev = queryClient.getQueryData<CycleLog[]>(qk.cycleLogs);
    queryClient.setQueryData<CycleLog[]>(qk.cycleLogs, (old) =>
      applyCyclePatch(old ?? [], today, patch),
    );
    try {
      await getStore().upsertCycleLog(today, patch);
      queryClient.invalidateQueries({ queryKey: qk.cycleLogs });
    } catch {
      // Roll back to the pre-mutation snapshot on failure.
      queryClient.setQueryData(qk.cycleLogs, prev);
    }
  }

  function startPeriod() {
    patchToday({ isPeriodStart: true, flow: todayLog?.flow ?? "medium" });
  }

  async function logSymptom(type: string, label: string) {
    setAddedSymptom(type);
    await getStore().addSymptom({
      logSessionId: null,
      occurredAt: nowIso(),
      timeConfidence: "exact",
      symptomType: type,
      title: label,
      severity: 3,
      durationMinutes: null,
      isOngoing: false,
      resolvedAt: null,
      bodyLocation: null,
      description: null,
      completenessScore: 40,
      aiConfidence: null,
      source: "manual",
      triggers: [],
    });
    invalidateEntries(queryClient);
    setTimeout(() => setAddedSymptom(null), 1200);
  }

  // ---- gates ----------------------------------------------------------------

  if (loading || !user || !settings || !logs) {
    return (
      <Screen>
        <FormSkeleton />
      </Screen>
    );
  }

  if (!settings.cycleTrackingEnabled) {
    return (
      <Screen>
        <PageHeader title="Cycle" eyebrow="Optional" />
        <div className="flex flex-col gap-4 px-5 pb-10 pt-2">
          <Card>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <IconBadge icon={Droplet} tone="danger" size={48} />
              <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                Track your menstrual cycle
              </h2>
              <p className="text-[13px] leading-snug text-muted">
                Optional, and entirely yours. Log your period, flow and cycle symptoms — Avni
                predicts your next period, learns your personal pattern, and tells when a symptom is
                cycle-driven vs. food-driven. Turn it on in Profile whenever you like.
              </p>
              <Link
                href="/profile"
                className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-white"
              >
                Enable in Profile
              </Link>
            </div>
          </Card>
        </div>
      </Screen>
    );
  }

  const phase = analysis?.phaseOf(today);
  const prediction = analysis?.prediction ?? null;
  const stats = analysis?.stats;
  const phaseMeta = PHASE_META[phase?.phase ?? "unknown"];
  const recentCycles = (analysis?.cycles ?? []).filter((c) => c.lengthDays != null).slice(-6).reverse();

  return (
    <Screen>
      <PageHeader
        title="Cycle"
        eyebrow="Your rhythm"
        right={<RefreshButton onRefresh={() => Promise.all([logsQ.refetch(), corrQ.refetch()])} />}
      />

      <div className="flex flex-col gap-5 px-5 pb-10 pt-1">
        {/* Status hero */}
        <GradientPanel variant="orange" className="p-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/80" style={{ fontFamily: "var(--font-label)" }}>
            {phase && phase.phase !== "unknown" ? phaseMeta.label.toUpperCase() + " PHASE" : "GETTING STARTED"}
          </span>
          <h1 className="mt-1 text-[24px] font-extrabold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
            {predictionLine(prediction)}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-white/85">
            {prediction
              ? `${confidenceNote(prediction.confidence)} ${prediction.confidence !== "low" ? `Window ${fmtDate(prediction.windowStart)}–${fmtDate(prediction.windowEnd)}.` : ""}`
              : phaseMeta.tip}
          </p>
          {phase?.cycleDay != null && phase.phase !== "unknown" && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[12px] font-semibold text-white">
              <CalendarDays size={13} /> Cycle day {phase.cycleDay}
            </div>
          )}
        </GradientPanel>

        {/* Log today */}
        <section className="flex flex-col gap-2.5">
          <h2 className="px-1 text-[15px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            Today
          </h2>
          <Card>
            {!todayLog?.isPeriodStart ? (
              <PrimaryButton icon={Droplet} onClick={startPeriod} className="mb-3">
                My period started today
              </PrimaryButton>
            ) : (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary-tint px-3 py-2 text-[13px] font-semibold text-primary-press">
                <Check size={15} /> Period start logged for today
              </div>
            )}

            <span className="text-[11px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>
              Flow today
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {FLOW_OPTIONS.map((f) => {
                const active = todayLog?.flow === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => patchToday({ flow: active ? "none" : f.value })}
                    className={
                      "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition " +
                      (active ? "bg-primary text-white" : "bg-canvas text-muted border border-line")
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {todayLog?.flow && todayLog.flow !== "none" && (
              <div className="mt-3 flex gap-2">
                <ToggleChip label="Clots" active={!!todayLog?.clots} onClick={() => patchToday({ clots: !todayLog?.clots })} />
                <ToggleChip label="Flooding" active={!!todayLog?.flooding} onClick={() => patchToday({ flooding: !todayLog?.flooding })} />
              </div>
            )}
          </Card>
        </section>

        {/* How you feel — logs real symptoms the engine uses */}
        <section className="flex flex-col gap-2.5">
          <h2 className="px-1 text-[15px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            How do you feel?
          </h2>
          <Card>
            <p className="mb-2.5 text-[11px] text-faint">Tap to log — these are tracked as symptoms and matched against your cycle and your food.</p>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map((s) => (
                <button
                  key={s.type}
                  onClick={() => logSymptom(s.type, s.label)}
                  className={
                    "flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition " +
                    (addedSymptom === s.type
                      ? "bg-success-tint text-success"
                      : "bg-canvas text-muted border border-line")
                  }
                >
                  {addedSymptom === s.type ? <Check size={13} /> : <Plus size={13} />} {s.label}
                </button>
              ))}
            </div>
          </Card>
        </section>

        {/* Advanced biomarkers */}
        <section className="flex flex-col gap-2.5">
          <button
            onClick={() => setAdvanced((a) => !a)}
            className="flex items-center justify-between px-1 text-[15px] font-bold text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Fertility signs (optional)
            <ChevronDown size={18} className={"text-faint transition " + (advanced ? "rotate-180" : "")} />
          </button>
          {advanced && (
            <Card>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>Basal body temperature (°C)</span>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={todayLog?.bbtCelsius ?? ""}
                    onBlur={(e) => patchToday({ bbtCelsius: e.target.value ? Number(e.target.value) : null })}
                    placeholder="e.g. 36.55"
                    className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-[14px] text-ink outline-none focus:border-primary"
                  />
                </label>
                <SelectField
                  label="Cervical fluid"
                  value={todayLog?.cervicalMucus ?? ""}
                  options={[["", "—"], ["dry", "Dry"], ["sticky", "Sticky"], ["creamy", "Creamy"], ["watery", "Watery"], ["eggwhite", "Egg-white"]]}
                  onChange={(v) => patchToday({ cervicalMucus: (v || null) as CycleLog["cervicalMucus"] })}
                />
                <SelectField
                  label="Ovulation test"
                  value={todayLog?.ovulationTest ?? ""}
                  options={[["", "—"], ["negative", "Negative"], ["positive", "Positive"]]}
                  onChange={(v) => patchToday({ ovulationTest: (v || null) as CycleLog["ovulationTest"] })}
                />
                <p className="text-[11px] leading-snug text-faint">
                  These sharpen your phase estimate. They are not a form of contraception or fertility advice.
                </p>
              </div>
            </Card>
          )}
        </section>

        {/* Cycle-driven patterns */}
        {cyclePatterns.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="flex items-center gap-2 px-1 text-[15px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              <Sparkles size={16} className="text-primary" /> Patterns in your cycle
            </h2>
            {cyclePatterns.map((p) => (
              <Card key={p.symptomType}>
                <p className="text-[13px] leading-snug text-muted">
                  Your <span className="font-semibold capitalize text-ink">{p.symptomType.replace(/_/g, " ")}</span>{" "}
                  shows up mostly in your luteal/period window ({Math.round(p.fraction * 100)}% of the time) — so it
                  looks more cycle-driven than food-driven. Avni accounts for this in your food patterns.
                </p>
              </Card>
            ))}
          </section>
        )}

        {/* History */}
        {recentCycles.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="px-1 text-[15px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Recent cycles
            </h2>
            <Card>
              {stats?.medianLength != null && (
                <p className="mb-3 text-[12.5px] text-muted">
                  Your cycle is typically <span className="font-semibold text-ink">{Math.round(stats.medianLength)} days</span>
                  {stats.regularity !== "insufficient" && ` · ${stats.regularity}`}
                  {deviation && deviation.classification !== "on_time" && (
                    <>. Your last period came <span className="font-semibold text-ink">{Math.abs(deviation.deviationDays)} days {deviation.classification}</span> vs your usual.</>
                  )}
                </p>
              )}
              <div className="flex flex-col gap-2">
                {recentCycles.map((c) => (
                  <CycleRow key={c.startDate} cycle={c} />
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* Red flags */}
        {flags.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="flex items-center gap-2 px-1 text-[15px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              <Activity size={16} className="text-primary" /> Worth a check-in
            </h2>
            {flags.map((f) => (
              <div key={f.id} className="rounded-2xl border border-line bg-warm/50 px-4 py-3">
                <p className="text-[13px] font-semibold text-ink">{f.title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-muted">{f.detail}</p>
              </div>
            ))}
          </section>
        )}

        {/* Safety / privacy */}
        <div className="flex items-start gap-2.5 rounded-2xl bg-canvas px-4 py-3">
          <ShieldQuestion size={16} className="mt-0.5 shrink-0 text-faint" />
          <p className="text-[11px] leading-snug text-faint">
            Cycle tracking is informational and inclusive — not a diagnosis, not medical or fertility
            advice, and not a contraceptive. Anything flagged is just a prompt to talk to a clinician.
            You can turn this off anytime in Profile.
          </p>
        </div>

        <Link href="/profile" className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-muted">
          <Info size={14} className="text-primary" /> Manage cycle tracking
        </Link>
      </div>
    </Screen>
  );
}

function CycleRow({ cycle }: { cycle: Cycle }) {
  const len = cycle.lengthDays!;
  const periodLen = cycle.periodLengthDays;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5">
      <IconBadge icon={Droplet} tone="danger" size={34} />
      <div className="flex flex-1 flex-col">
        <span className="text-[13px] font-semibold text-ink">{fmtDate(cycle.startDate)} → {cycle.nextStartDate ? fmtDate(cycle.nextStartDate) : "—"}</span>
        <span className="text-[11.5px] text-muted">
          {len} day cycle{periodLen ? ` · ${periodLen} day period` : ""}
        </span>
      </div>
    </div>
  );
}

function ToggleChip({ label, active, disabled, onClick }: { label: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={
        "rounded-full px-3 py-1.5 text-[12px] font-semibold transition " +
        (active ? "bg-danger-tint text-danger" : "bg-canvas text-muted border border-line")
      }
    >
      {label}
    </button>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-[14px] text-ink outline-none focus:border-primary"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
