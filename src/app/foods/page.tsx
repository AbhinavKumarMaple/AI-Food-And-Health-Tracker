"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search, X, Check, Ban, AlertTriangle, Leaf, Info, StickyNote, Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { FOOD_SOURCE, foodKey, type FodmapStatus, type FoodItem } from "@/lib/foods/data";
import { searchFoods } from "@/lib/foods/search";
import type { FoodNote } from "@/lib/store/types";
import { useAuth } from "@/lib/useAuth";
import { useFoodNotes, useQueryClient } from "@/lib/queries";
import { upsertFoodNoteOptimistic, deleteFoodNoteOptimistic } from "@/lib/mutations";
import { Chip, IconBadge, PrimaryButton } from "@/components/ui";

const ACK_KEY = "avni-fodmap-ack-v1";

const STATUS: Record<
  FodmapStatus,
  { tone: "success" | "orange" | "danger"; icon: typeof Check; label: string; dot: string; pill: string; headline: string }
> = {
  green: { tone: "success", icon: Check, label: "Enjoy", dot: "bg-success", pill: "bg-success-tint text-success", headline: "Low FODMAP" },
  amber: { tone: "orange", icon: AlertTriangle, label: "Limit", dot: "bg-primary", pill: "bg-primary-tint text-primary-press", headline: "Limit — small serves only" },
  red: { tone: "danger", icon: Ban, label: "Avoid", dot: "bg-danger", pill: "bg-danger-tint text-danger", headline: "High FODMAP" },
};

const CONF: Record<FoodItem["confidence"], { label: string; cls: string }> = {
  tested: { label: "Lab-tested", cls: "bg-success-tint text-success" },
  estimated: { label: "Estimated", cls: "bg-warm text-muted" },
  guidance: { label: "Guidance · not lab-tested", cls: "bg-primary-tint text-primary-press" },
};

type NoteInput = { note: string; reaction: boolean; reactionLabel: string | null };

export default function FoodsPage() {
  const router = useRouter();
  const { user } = useAuth(false);
  const queryClient = useQueryClient();
  const notesQ = useFoodNotes(!!user);
  const notes = useMemo(() => notesQ.data ?? [], [notesQ.data]);
  const noteByKey = useMemo(() => new Map(notes.map((n) => [n.foodKey, n])), [notes]);
  const customNotes = useMemo(() => notes.filter((n) => n.isCustom), [notes]);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [acked, setAcked] = useState<boolean | null>(null);
  const [vvStyle, setVvStyle] = useState<React.CSSProperties>();

  useEffect(() => {
    setAcked(window.localStorage.getItem(ACK_KEY) === "1");
  }, []);

  // Keyboard-friendly layout: pin the page to the *visual* viewport (which DOES
  // shrink when the on-screen keyboard opens) so the header stays put and only
  // the scrollable list contracts — instead of the browser pushing the whole
  // page up to reveal the focused search input.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVvStyle({ height: vv.height, transform: `translateY(${vv.offsetTop}px)` });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Lock document scroll while this full-screen tool is mounted so nothing can
  // scroll underneath the pinned container (notably on iOS).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const q = query.trim();
  const searching = q.length > 0;

  const baseResults = useMemo(() => searchFoods(query), [query]);
  const customResults = useMemo(() => {
    if (!searching) return customNotes;
    const nq = q.toLowerCase();
    return customNotes.filter((n) => n.foodName.toLowerCase().includes(nq) || n.foodKey.includes(nq));
  }, [q, searching, customNotes]);

  const resultCount = baseResults.length + customResults.length;
  // Show "add your own" when searching a food that isn't already a known/custom entry.
  const exactExists =
    baseResults.some((r) => foodKey(r.item.name) === foodKey(q)) || customNotes.some((n) => n.foodKey === foodKey(q));
  const canAddCustom = !!user && searching && !exactExists;

  function toggle(name: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  function saveNote(key: string, foodName: string, isCustom: boolean, input: NoteInput) {
    upsertFoodNoteOptimistic(queryClient, key, { foodName, isCustom, ...input });
    setEditingKey(null);
    setAdding(null);
  }
  function removeNote(key: string) {
    deleteFoodNoteOptimistic(queryClient, key);
    setEditingKey(null);
  }
  function accept() {
    window.localStorage.setItem(ACK_KEY, "1");
    setAcked(true);
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-10 mx-auto flex w-full max-w-[30rem] flex-col bg-canvas"
      style={{ height: "100dvh", ...vvStyle }}
    >
      {/* Header + legend */}
      <header className="flex flex-col gap-3 border-b border-line px-5 pb-3 pt-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-1 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary" style={{ fontFamily: "var(--font-label)" }}>
              Low-FODMAP guide
            </span>
            <h1 className="text-[26px] font-extrabold leading-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Can I eat it?
            </h1>
          </div>
          <IconBadge icon={Leaf} tone="success" size={40} />
        </div>
        <div className="flex items-center gap-3">
          <LegendDot tone="bg-success" label="Enjoy" />
          <LegendDot tone="bg-primary" label="Limit" />
          <LegendDot tone="bg-danger" label="Avoid" />
          <span className="ml-auto text-[11px] text-faint" style={{ fontFamily: "var(--font-label)" }}>
            {searching ? `${resultCount} match${resultCount === 1 ? "" : "es"}` : `${resultCount} foods`}
          </span>
        </div>
      </header>

      {/* Results */}
      <main className="no-scrollbar flex-1 overflow-y-auto px-5 py-3">
        {!searching && (
          <div className="mb-3 flex items-start gap-2.5 rounded-2xl bg-primary-tint/60 px-4 py-3">
            <Info size={16} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-[12.5px] leading-snug text-primary-press">
              It depends on <span className="font-semibold">how much</span>: amber foods are fine in a small serve. Tap a food
              to see the safe serving, the FODMAP, a swap — and to <span className="font-semibold">add your own note</span> (e.g.
              &ldquo;cucumber → acidity&rdquo;).
            </p>
          </div>
        )}

        {/* Add-your-own (off-list foods like cucumber) */}
        {canAddCustom &&
          (adding === q ? (
            <div className="mb-2 rounded-2xl border border-primary/40 bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="mb-2 flex items-center gap-2">
                <IconBadge icon={StickyNote} tone="warm" size={32} />
                <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                  {q}
                </span>
                <span className="ml-auto rounded-md bg-warm px-2 py-[3px] text-[10px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>
                  Personal
                </span>
              </div>
              <NoteEditor onSave={(v) => saveNote(foodKey(q), q, true, v)} onCancel={() => setAdding(null)} />
            </div>
          ) : (
            <button
              onClick={() => setAdding(q)}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-3 text-left transition active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-primary">
                <Plus size={16} />
              </span>
              <span className="text-[13px] text-muted">
                Add <span className="font-semibold text-ink">{q}</span> with your own note
              </span>
            </button>
          ))}

        {resultCount === 0 && !canAddCustom ? (
          <div className="mt-10 flex flex-col items-center gap-3 px-6 text-center">
            <IconBadge icon={Search} tone="warm" size={44} />
            <p className="text-[14px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              No match for &ldquo;{q}&rdquo;
            </p>
            <p className="text-[13px] text-muted">
              {user ? "Check the spelling, or add it as your own note above." : "Check the spelling, or try a more common name."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {baseResults.map(({ item, matchedAs }) => {
              const key = foodKey(item.name);
              return (
                <FoodRow
                  key={item.name}
                  item={item}
                  matchedAs={matchedAs}
                  note={noteByKey.get(key)}
                  canNote={!!user}
                  expanded={open.has(item.name)}
                  editing={editingKey === key}
                  onToggle={() => toggle(item.name)}
                  onEdit={() => setEditingKey(key)}
                  onCancelEdit={() => setEditingKey(null)}
                  onSave={(v) => saveNote(key, item.name, false, v)}
                  onRemove={() => removeNote(key)}
                />
              );
            })}
            {customResults.map((note) => (
              <CustomFoodRow
                key={note.foodKey}
                note={note}
                expanded={open.has(note.foodKey)}
                editing={editingKey === note.foodKey}
                onToggle={() => toggle(note.foodKey)}
                onEdit={() => setEditingKey(note.foodKey)}
                onCancelEdit={() => setEditingKey(null)}
                onSave={(v) => saveNote(note.foodKey, note.foodName, true, v)}
                onRemove={() => removeNote(note.foodKey)}
              />
            ))}
          </ul>
        )}

        <p className="mt-5 px-1 text-[11px] leading-relaxed text-faint" style={{ fontFamily: "var(--font-label)" }}>
          Serving sizes are approximate and tolerance is personal — a green rating isn&apos;t a guarantee.
          <br />
          {FOOD_SOURCE}
        </p>
      </main>

      {/* Search — pinned to the bottom for thumb reach */}
      <footer
        className="border-t border-line bg-surface px-4 pt-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-warm px-3.5 py-3 focus-within:border-primary/60">
          <Search size={18} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a food — bhindi, aloo, rajma…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-faint transition active:scale-90 hover:bg-line/60"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[10.5px] text-faint" style={{ fontFamily: "var(--font-label)" }}>
          General info only — not medical advice.
        </p>
      </footer>

      {acked === false && <DisclaimerGate onAccept={accept} />}
    </div>
  );
}

function LegendDot({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>
      <span className={cn("h-2 w-2 rounded-full", tone)} />
      {label}
    </span>
  );
}

/** A small marker shown in a collapsed row when the user has a note on a food. */
function NoteMarker({ note }: { note: FoodNote }) {
  if (note.reaction) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-danger-tint px-1.5 py-[2px] text-[10px] font-semibold text-danger" style={{ fontFamily: "var(--font-label)" }}>
        <AlertTriangle size={10} strokeWidth={2.8} /> {note.reactionLabel || "reacts"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-warm px-1.5 py-[2px] text-[10px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>
      <StickyNote size={10} strokeWidth={2.5} /> note
    </span>
  );
}

/** The "Your note" block shown in an expanded card (view / edit / add). */
function YourNote({
  note,
  editing,
  canNote,
  onEdit,
  onCancelEdit,
  onSave,
  onRemove,
}: {
  note?: FoodNote;
  editing: boolean;
  canNote: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (v: NoteInput) => void;
  onRemove: () => void;
}) {
  if (!canNote) return null;
  return (
    <div className="rounded-xl bg-warm/60 p-3" onClick={(e) => e.stopPropagation()}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-faint" style={{ fontFamily: "var(--font-label)" }}>
        Your note
      </span>
      {editing ? (
        <div className="mt-2">
          <NoteEditor
            initial={note ? { note: note.note, reaction: note.reaction, reactionLabel: note.reactionLabel ?? "" } : undefined}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        </div>
      ) : note ? (
        <div className="mt-1.5 flex flex-col gap-2">
          {note.reaction && (
            <span className="inline-flex w-fit items-center gap-1 rounded-md bg-danger-tint px-2 py-[3px] text-[10px] font-bold text-danger" style={{ fontFamily: "var(--font-label)" }}>
              <AlertTriangle size={11} strokeWidth={2.8} /> {note.reactionLabel ? `Reacts · ${note.reactionLabel}` : "This disagrees with me"}
            </span>
          )}
          {note.note && <p className="text-[13px] leading-snug text-ink">{note.note}</p>}
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1 rounded-md bg-surface px-2.5 py-1 text-[11px] font-semibold text-primary-press">
              <Pencil size={12} /> Edit
            </button>
            <button onClick={onRemove} className="flex items-center gap-1 rounded-md bg-surface px-2.5 py-1 text-[11px] font-semibold text-danger">
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onEdit}
          className="mt-1.5 flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-primary-press"
        >
          <Plus size={13} /> Add a personal note
        </button>
      )}
    </div>
  );
}

function NoteEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { note: string; reaction: boolean; reactionLabel: string };
  onSave: (v: NoteInput) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(initial?.note ?? "");
  const [reaction, setReaction] = useState(initial?.reaction ?? false);
  const [label, setLabel] = useState(initial?.reactionLabel ?? "");
  const canSave = note.trim().length > 0 || reaction;

  return (
    <div className="flex flex-col gap-2.5" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        autoFocus
        placeholder="e.g. fine FODMAP-wise but gives me acidity"
        className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
      />
      <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
        <input
          type="checkbox"
          checked={reaction}
          onChange={(e) => setReaction(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-danger)]"
        />
        This disagrees with me
      </label>
      {reaction && (
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="short label, e.g. acidity, bloating"
          className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-primary"
        />
      )}
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-muted">
          Cancel
        </button>
        <button
          onClick={() => onSave({ note: note.trim(), reaction, reactionLabel: reaction ? label.trim() || null : null })}
          disabled={!canSave}
          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function FoodRow({
  item,
  matchedAs,
  note,
  canNote,
  expanded,
  editing,
  onToggle,
  onEdit,
  onCancelEdit,
  onSave,
  onRemove,
}: {
  item: FoodItem;
  matchedAs?: string;
  note?: FoodNote;
  canNote: boolean;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (v: NoteInput) => void;
  onRemove: () => void;
}) {
  const cfg = STATUS[item.status];
  return (
    <li
      onClick={onToggle}
      className="cursor-pointer rounded-2xl border border-line bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <IconBadge icon={cfg.icon} tone={cfg.tone} size={40} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            {item.name}
          </span>
          <span className="truncate text-[12px] text-muted">{rowSubtitle(item, matchedAs)}</span>
          {note && (
            <span className="mt-1">
              <NoteMarker note={note} />
            </span>
          )}
        </div>
        <span
          className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", cfg.pill)}
          style={{ fontFamily: "var(--font-label)" }}
        >
          <cfg.icon size={12} strokeWidth={3} />
          {cfg.label}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-line/70 pt-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-[12.5px] leading-snug text-muted">
            <span className="font-semibold text-ink">{cfg.headline}</span>
            {item.dominantFodmap ? ` · ${item.dominantFodmap}` : ""}
          </p>

          {(item.safeServe || item.limitServe) && (
            <div className="flex flex-col gap-1">
              {item.safeServe && (
                <p className="flex items-start gap-2 text-[12.5px] text-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span>
                    Low serve: <span className="font-medium text-ink">{item.safeServe}</span>
                  </span>
                </p>
              )}
              {item.limitServe && (
                <p className="flex items-start gap-2 text-[12.5px] text-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                  <span>
                    High at: <span className="font-medium text-ink">{item.limitServe}</span>
                  </span>
                </p>
              )}
            </div>
          )}

          {item.prepNote && <p className="text-[12.5px] leading-snug text-muted">{item.prepNote}</p>}

          {item.swap && (
            <p className="text-[12.5px] leading-snug text-muted">
              <span className="font-semibold text-ink">Try instead: </span>
              {item.swap}
            </p>
          )}

          {item.note && <p className="text-[12px] leading-snug text-faint">{item.note}</p>}

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span
              className={cn("inline-flex items-center rounded-md px-2 py-[3px] text-[10px] font-semibold tracking-wide", CONF[item.confidence].cls)}
              style={{ fontFamily: "var(--font-label)" }}
            >
              {CONF[item.confidence].label}
            </span>
          </div>

          {item.aliases.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-faint" style={{ fontFamily: "var(--font-label)" }}>
                Also called
              </span>
              <div className="flex flex-wrap gap-1.5">
                {item.aliases.map((a) => (
                  <Chip key={a} tone="warm">
                    {a}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <YourNote
            note={note}
            editing={editing}
            canNote={canNote}
            onEdit={onEdit}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
            onRemove={onRemove}
          />
        </div>
      )}
    </li>
  );
}

/** A food the user added that isn't in the base FODMAP list — personal note only. */
function CustomFoodRow({
  note,
  expanded,
  editing,
  onToggle,
  onEdit,
  onCancelEdit,
  onSave,
  onRemove,
}: {
  note: FoodNote;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (v: NoteInput) => void;
  onRemove: () => void;
}) {
  return (
    <li
      onClick={onToggle}
      className="cursor-pointer rounded-2xl border border-line bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <IconBadge icon={StickyNote} tone="warm" size={40} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            {note.foodName}
          </span>
          <span className="truncate text-[12px] text-muted">Your own — not in the FODMAP list</span>
          <span className="mt-1">
            <NoteMarker note={note} />
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-warm px-2.5 py-1 text-[11px] font-bold text-muted" style={{ fontFamily: "var(--font-label)" }}>
          Personal
        </span>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-line/70 pt-3" onClick={(e) => e.stopPropagation()}>
          <YourNote
            note={note}
            editing={editing}
            canNote
            onEdit={onEdit}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
            onRemove={onRemove}
          />
        </div>
      )}
    </li>
  );
}

function rowSubtitle(item: FoodItem, matchedAs?: string): React.ReactNode {
  if (matchedAs) {
    return (
      <>
        found as <span className="font-medium text-ink">{matchedAs}</span>
      </>
    );
  }
  if (item.status === "amber" && item.safeServe) return `Small serve OK · ${item.safeServe}`;
  if (item.status === "red") return item.dominantFodmap ? `High · ${item.dominantFodmap}` : item.category;
  return item.category;
}

function DisclaimerGate({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="max-h-[88dvh] w-full max-w-[28rem] overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <IconBadge icon={Info} tone="orange" size={44} />
        <h2 className="mt-3 text-[20px] font-extrabold leading-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
          Before you start
        </h2>
        <ul className="mt-3 flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-muted">
          <li>This is general FODMAP guidance for food — <span className="font-semibold text-ink">not medical advice</span>, and it can&apos;t diagnose, treat or cure anything.</li>
          <li>Low-FODMAP helps <span className="font-semibold text-ink">manage IBS symptoms</span>; it&apos;s not a cure and not for everyone. See a doctor to confirm IBS and rule out coeliac disease or IBD first.</li>
          <li>It&apos;s a <span className="font-semibold text-ink">short-term</span> diet (about 2–6 weeks) — plan to reintroduce foods with a registered dietitian, not restrict forever.</li>
          <li>Cutting dal, chana and rajma can lower <span className="font-semibold text-ink">protein and fibre</span>, especially if you&apos;re vegetarian — get dietitian support so you don&apos;t over-restrict.</li>
          <li>Not advised in pregnancy or for children without supervision. If you have, or are at risk of, an eating disorder, please talk to a professional first.</li>
          <li>Ratings use typical servings and Monash testing — your own tolerance may differ, and a green rating isn&apos;t a guarantee.</li>
        </ul>
        <PrimaryButton className="mt-5" onClick={onAccept}>
          I understand
        </PrimaryButton>
      </div>
    </div>
  );
}
