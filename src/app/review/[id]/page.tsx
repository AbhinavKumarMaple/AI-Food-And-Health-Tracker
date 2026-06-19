"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sparkles, Trash2, Check, Pencil, ChevronLeft, MessageCircleQuestion, Droplet, Loader2, AlertTriangle } from "lucide-react";
import { getStore } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import { useQueryClient } from "@/lib/queries";
import { saveLogOptimistic, discardSessionOptimistic } from "@/lib/mutations";
import { parseResultSchema } from "@/lib/gemini/schema";
import { draftsFromParseResult, type Drafts } from "@/lib/draft";
import { nowIso, toISODate } from "@/lib/store/util";
import { mealIcon, symptomIcon, beverageIcon } from "@/lib/icons";
import { formatTime } from "@/lib/format";
import { Screen } from "@/components/Screen";
import { ReviewSkeleton } from "@/components/skeletons";
import { GradientPanel } from "@/components/GradientPanel";
import { Card } from "@/components/cards";
import { Chip, CompletenessRing, IconBadge, Stars, PrimaryButton } from "@/components/ui";

function isoToLocal(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function localToIso(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? nowIso() : d.toISOString();
}

export default function ReviewPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "processing" | "ready" | "failed" | "notfound">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const session = await getStore().getLogSession(id);
      if (!active) return;
      if (!session) {
        setStatus("notfound");
        return;
      }
      if (session.parseStatus === "processing") {
        setStatus("processing");
        timer = setTimeout(load, 2000); // keep waiting; this job is still organizing
        return;
      }
      if (session.parseStatus === "failed") {
        setErrorMsg(session.error || "We couldn't organize this log.");
        setStatus("failed");
        return;
      }
      const parsed = session.rawAiResponse
        ? parseResultSchema.safeParse(session.rawAiResponse)
        : null;
      if (!parsed?.success) {
        setStatus("notfound");
        return;
      }
      setDrafts(draftsFromParseResult(parsed.data, id));
      setStatus("ready");
    };
    load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [user, id]);

  const counts = useMemo(() => {
    if (!drafts) return { meals: 0, symptoms: 0, moods: 0, hydration: 0 };
    return {
      meals: drafts.meals.length,
      symptoms: drafts.symptoms.length,
      moods: drafts.moods.length,
      hydration: drafts.hydration.length,
    };
  }, [drafts]);

  function setMeal(i: number, patch: Partial<Drafts["meals"][number]>) {
    setDrafts((d) => (d ? { ...d, meals: d.meals.map((m, j) => (j === i ? { ...m, ...patch } : m)) } : d));
  }
  function setSymptom(i: number, patch: Partial<Drafts["symptoms"][number]>) {
    setDrafts((d) => (d ? { ...d, symptoms: d.symptoms.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : d));
  }
  function setMood(i: number, patch: Partial<Drafts["moods"][number]>) {
    setDrafts((d) => (d ? { ...d, moods: d.moods.map((m, j) => (j === i ? { ...m, ...patch } : m)) } : d));
  }
  function removeFrom<K extends keyof Drafts>(key: K, i: number) {
    setDrafts((d) => (d ? { ...d, [key]: (d[key] as unknown[]).filter((_, j) => j !== i) } : d));
  }
  function answerFollowUp(i: number, val: string) {
    setDrafts((d) =>
      d ? { ...d, followUps: d.followUps.map((f, j) => (j === i ? { ...f, answerText: val } : f)) } : d,
    );
  }

  function discard() {
    // Optimistic: drop from the Inbox + leave immediately; persist in background.
    discardSessionOptimistic(queryClient, id);
    router.replace("/");
  }

  function save() {
    if (!drafts) return;
    const firstIso =
      drafts.meals[0]?.occurredAt ??
      drafts.symptoms[0]?.occurredAt ??
      drafts.moods[0]?.occurredAt ??
      nowIso();
    const date = toISODate(firstIso);
    // Paint the entries into the day + persist in the background (with retries).
    // The user goes straight to their day — no waiting on the network.
    saveLogOptimistic({ queryClient, drafts, sessionId: id, date });
    router.replace(`/day/${date}`);
  }

  if (loading || !user) return null;
  if (status === "notfound")
    return (
      <Screen showTab={false}>
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted">This review could not be found.</p>
          <button onClick={() => router.replace("/")} className="font-semibold text-primary-press">
            Back to Today
          </button>
        </div>
      </Screen>
    );
  if (status === "processing")
    return (
      <Screen showTab={false}>
        <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
          <Loader2 size={34} className="animate-spin text-primary" />
          <p className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            Organizing your log…
          </p>
          <p className="max-w-[16rem] text-[13px] text-muted">
            This opens automatically when it&apos;s ready. You can leave — it&apos;ll wait in your Inbox.
          </p>
          <button onClick={() => router.replace("/inbox")} className="mt-1 font-semibold text-primary-press">
            Go to Inbox
          </button>
        </div>
      </Screen>
    );
  if (status === "failed")
    return (
      <Screen showTab={false}>
        <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
          <AlertTriangle size={30} className="text-danger" />
          <p className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            Couldn&apos;t organize this log
          </p>
          <p className="max-w-[18rem] text-[12.5px] leading-snug text-muted">{errorMsg}</p>
          <button onClick={() => router.replace("/record")} className="mt-1 font-semibold text-primary-press">
            Record again
          </button>
        </div>
      </Screen>
    );
  if (!drafts)
    return (
      <Screen showTab={false}>
        <ReviewSkeleton />
      </Screen>
    );

  return (
    <Screen showTab={false}>
      <div className="flex items-center justify-between px-5 pb-1 pt-3">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface">
          <ChevronLeft size={20} />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary" style={{ fontFamily: "var(--font-label)" }}>
          Review &amp; confirm
        </span>
        <span className="h-9 w-9" />
      </div>

      <div className="flex flex-col gap-5 px-5 pb-32 pt-1">
        <GradientPanel variant="dark" className="p-5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-white/70" style={{ fontFamily: "var(--font-label)" }}>
            <Sparkles size={12} /> AI ORGANIZED
          </span>
          <h1 className="mt-2 text-[26px] font-extrabold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
            Here&apos;s what we heard
          </h1>
          <p className="mt-1 text-[13px] text-white/75">
            {drafts.recap || "Review the entries below. Edit anything, then save."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {counts.meals > 0 && <DarkChip>{counts.meals} meals</DarkChip>}
            {counts.symptoms > 0 && <DarkChip>{counts.symptoms} symptom{counts.symptoms === 1 ? "" : "s"}</DarkChip>}
            {counts.moods > 0 && <DarkChip>{counts.moods} mood</DarkChip>}
            {counts.hydration > 0 && <DarkChip>{counts.hydration} drink{counts.hydration === 1 ? "" : "s"}</DarkChip>}
            {drafts.cycle.length > 0 && <DarkChip>{drafts.cycle.length} cycle</DarkChip>}
          </div>
        </GradientPanel>

        {/* Meals */}
        {drafts.meals.length > 0 && (
          <Section title="Meals">
            {drafts.meals.map((m, i) => {
              const key = `meal-${i}`;
              return (
                <Card key={key}>
                  <div className="flex gap-3.5">
                    <IconBadge icon={mealIcon(m.mealType)} tone="orange" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                          {m.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted" style={{ fontFamily: "var(--font-label)" }}>{formatTime(m.occurredAt)}</span>
                          <CompletenessRing value={m.completenessScore} />
                          <EditBtn onClick={() => setEditing(editing === key ? null : key)} />
                          <DelBtn onClick={() => removeFrom("meals", i)} />
                        </div>
                      </div>
                      <p className="text-[13px] leading-snug text-muted">
                        {m.description || m.items.map((it) => it.name).join(" · ")}
                      </p>
                      {m.items.some((it) => it.tags.length) && (
                        <div className="mt-0.5 flex flex-wrap gap-1.5">
                          {Array.from(new Set(m.items.flatMap((it) => it.tags))).slice(0, 6).map((t) => (
                            <Chip key={t} tone={t.toLowerCase() === "caffeine" ? "orange" : "warm"}>{t}</Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {editing === key && (
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3">
                      <Field label="Title"><Input value={m.title} onChange={(v) => setMeal(i, { title: v })} /></Field>
                      <Field label="Type">
                        <Select
                          value={m.mealType}
                          options={["breakfast", "lunch", "dinner", "snack", "drink", "other"]}
                          onChange={(v) => setMeal(i, { mealType: v })}
                        />
                      </Field>
                      <Field label="Time">
                        <Input type="datetime-local" value={isoToLocal(m.occurredAt)} onChange={(v) => setMeal(i, { occurredAt: localToIso(v) })} />
                      </Field>
                      <Field label="Description"><Input value={m.description ?? ""} onChange={(v) => setMeal(i, { description: v })} /></Field>
                      <Field label="Portion / notes"><Input value={m.portionSize ?? ""} onChange={(v) => setMeal(i, { portionSize: v })} /></Field>
                    </div>
                  )}
                </Card>
              );
            })}
          </Section>
        )}

        {/* Symptoms */}
        {drafts.symptoms.length > 0 && (
          <Section title="Symptoms">
            {drafts.symptoms.map((s, i) => {
              const key = `sym-${i}`;
              return (
                <Card key={key}>
                  <div className="flex gap-3.5">
                    <IconBadge icon={symptomIcon(s.symptomType)} tone="danger" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>{s.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted" style={{ fontFamily: "var(--font-label)" }}>{formatTime(s.occurredAt)}</span>
                          <CompletenessRing value={s.completenessScore} />
                          <EditBtn onClick={() => setEditing(editing === key ? null : key)} />
                          <DelBtn onClick={() => removeFrom("symptoms", i)} />
                        </div>
                      </div>
                      {s.description && <p className="text-[13px] leading-snug text-muted">{s.description}</p>}
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className={"h-1 w-[18px] rounded-full " + (n <= s.severity ? "bg-danger" : "bg-line")} />
                          ))}
                        </div>
                        {(s.triggers?.[0]?.suspectedFoodText) && (
                          <Chip tone="orange">↳ {s.triggers![0].suspectedFoodText}</Chip>
                        )}
                      </div>
                    </div>
                  </div>
                  {editing === key && (
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3">
                      <Field label="Title"><Input value={s.title} onChange={(v) => setSymptom(i, { title: v })} /></Field>
                      <Field label={`Severity · ${s.severity}/5`}>
                        <input type="range" min={1} max={5} value={s.severity} onChange={(e) => setSymptom(i, { severity: Number(e.target.value) })} className="w-full accent-[#d64545]" />
                      </Field>
                      <Field label="Time">
                        <Input type="datetime-local" value={isoToLocal(s.occurredAt)} onChange={(v) => setSymptom(i, { occurredAt: localToIso(v) })} />
                      </Field>
                      <Field label="Duration (min)">
                        <Input type="number" value={s.durationMinutes != null ? String(s.durationMinutes) : ""} onChange={(v) => setSymptom(i, { durationMinutes: v ? Number(v) : null })} />
                      </Field>
                      <Field label="Body location"><Input value={s.bodyLocation ?? ""} onChange={(v) => setSymptom(i, { bodyLocation: v })} /></Field>
                      <Field label="Suspected food (what may have caused it?)">
                        <Input
                          value={s.triggers?.[0]?.suspectedFoodText ?? ""}
                          onChange={(v) =>
                            setSymptom(i, {
                              triggers: v
                                ? [{ suspectedMealId: null, suspectedMealItemId: null, suspectedFoodText: v, relationNote: null, source: "user", userConfidence: null }]
                                : [],
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}
                </Card>
              );
            })}
          </Section>
        )}

        {/* Mood */}
        {drafts.moods.length > 0 && (
          <Section title="Mood">
            {drafts.moods.map((m, i) => (
              <Card key={`mood-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>How you felt</span>
                  <DelBtn onClick={() => removeFrom("moods", i)} />
                </div>
                <div className="mt-3">
                  <Stars value={m.rating} size={30} onChange={(v) => setMood(i, { rating: v })} />
                </div>
              </Card>
            ))}
          </Section>
        )}

        {/* Hydration */}
        {drafts.hydration.length > 0 && (
          <Section title="Hydration">
            {drafts.hydration.map((h, i) => (
              <Card key={`hyd-${i}`}>
                <div className="flex items-center gap-3">
                  <IconBadge icon={beverageIcon(h.beverageType)} tone="warm" size={36} />
                  <span className="flex-1 text-[14px] font-semibold text-ink capitalize" style={{ fontFamily: "var(--font-display)" }}>{h.beverageType}</span>
                  <span className="text-[13px] text-muted">{h.amountMl} ml</span>
                  <DelBtn onClick={() => removeFrom("hydration", i)} />
                </div>
              </Card>
            ))}
          </Section>
        )}

        {/* Cycle */}
        {drafts.cycle.length > 0 && (
          <Section title="Cycle">
            {drafts.cycle.map((c, i) => (
              <Card key={`cyc-${i}`}>
                <div className="flex items-center gap-3">
                  <IconBadge icon={Droplet} tone="danger" size={36} />
                  <div className="flex flex-1 flex-col">
                    <span className="text-[14px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                      {c.label}
                    </span>
                    <span className="text-[12px] text-muted">
                      {new Date(`${c.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <DelBtn onClick={() => removeFrom("cycle", i)} />
                </div>
              </Card>
            ))}
          </Section>
        )}

        {/* Follow-ups */}
        {drafts.followUps.length > 0 && (
          <Section title="A few more details?">
            {drafts.followUps.map((f, i) => (
              <Card key={`fu-${i}`}>
                <div className="flex items-start gap-2.5">
                  <MessageCircleQuestion size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="text-[13px] font-medium text-ink">{f.questionText}</p>
                    <Input value={f.answerText ?? ""} onChange={(v) => answerFollowUp(i, v)} placeholder="Add an answer…" />
                  </div>
                </div>
              </Card>
            ))}
          </Section>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 flex gap-3 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur">
        <button onClick={discard} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-[15px] font-semibold text-muted">
          <Trash2 size={18} /> Discard
        </button>
        <PrimaryButton icon={Check} onClick={save} className="flex-[2]">
          Save to today
        </PrimaryButton>
      </div>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="px-1 text-[15px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
      {children}
    </section>
  );
}
function DarkChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">{children}</span>;
}
function EditBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-primary-press"><Pencil size={14} /></button>;
}
function DelBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-faint"><Trash2 size={14} /></button>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>{label}</span>
      {children}
    </label>
  );
}
function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-[14px] text-ink outline-none focus:border-primary"
    />
  );
}
function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-[14px] capitalize text-ink outline-none focus:border-primary">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
