"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search, X, Check, Ban, AlertTriangle, Leaf, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { FOOD_SOURCE, type FodmapStatus, type FoodItem } from "@/lib/foods/data";
import { searchFoods } from "@/lib/foods/search";
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

export default function FoodsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [acked, setAcked] = useState<boolean | null>(null);

  useEffect(() => {
    setAcked(window.localStorage.getItem(ACK_KEY) === "1");
  }, []);

  const results = useMemo(() => searchFoods(query), [query]);
  const searching = query.trim().length > 0;

  function toggle(name: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  function accept() {
    window.localStorage.setItem(ACK_KEY, "1");
    setAcked(true);
  }

  return (
    <div className="flex h-dvh flex-col">
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
            {searching ? `${results.length} match${results.length === 1 ? "" : "es"}` : `${results.length} foods`}
          </span>
        </div>
      </header>

      {/* Results */}
      <main className="no-scrollbar flex-1 overflow-y-auto px-5 py-3">
        {!searching && (
          <div className="mb-3 flex items-start gap-2.5 rounded-2xl bg-primary-tint/60 px-4 py-3">
            <Info size={16} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-[12.5px] leading-snug text-primary-press">
              It depends on <span className="font-semibold">how much</span>: amber foods are fine in a small serve. Tap any food
              for the safe serving, the FODMAP, and a swap. Search in English or Hindi — try{" "}
              <span className="font-semibold">bhindi</span>, <span className="font-semibold">rajma</span> or{" "}
              <span className="font-semibold">jowar</span>.
            </p>
          </div>
        )}

        {results.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 px-6 text-center">
            <IconBadge icon={Search} tone="warm" size={44} />
            <p className="text-[14px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              No match for &ldquo;{query.trim()}&rdquo;
            </p>
            <p className="text-[13px] text-muted">
              We don&apos;t have that food in this list. Check the spelling, or try a more common name. When unsure, ask a dietitian.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map(({ item, matchedAs }) => (
              <FoodRow
                key={item.name}
                item={item}
                matchedAs={matchedAs}
                expanded={open.has(item.name)}
                onToggle={() => toggle(item.name)}
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

function FoodRow({
  item,
  matchedAs,
  expanded,
  onToggle,
}: {
  item: FoodItem;
  matchedAs?: string;
  expanded: boolean;
  onToggle: () => void;
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
        <div className="mt-3 flex flex-col gap-2.5 border-t border-line/70 pt-3">
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
