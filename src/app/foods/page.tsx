"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search, X, Check, Ban, Leaf, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { FOOD_SOURCE, type FoodItem } from "@/lib/foods/data";
import { searchFoods } from "@/lib/foods/search";
import { Chip, IconBadge } from "@/components/ui";

export default function FoodsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

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
        <div className="flex items-center gap-2">
          <LegendDot tone="success" label="Enjoy" />
          <LegendDot tone="danger" label="Avoid" />
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
              Search any food to see if it&apos;s safe on a low-FODMAP diet. Type in English or Hindi —
              try <span className="font-semibold">bhindi</span>, <span className="font-semibold">rajma</span> or{" "}
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
          Reference only — not medical advice. FODMAP tolerance is portion-dependent and personal.
          <br />
          Source: {FOOD_SOURCE}
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
      </footer>
    </div>
  );
}

function LegendDot({ tone, label }: { tone: "success" | "danger"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted" style={{ fontFamily: "var(--font-label)" }}>
      <span className={cn("h-2 w-2 rounded-full", tone === "success" ? "bg-success" : "bg-danger")} />
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
  const low = item.fodmap === "low";
  return (
    <li
      onClick={onToggle}
      className="cursor-pointer rounded-2xl border border-line bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <IconBadge icon={low ? Check : Ban} tone={low ? "success" : "danger"} size={40} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            {item.name}
          </span>
          <span className="truncate text-[12px] text-muted">
            {matchedAs ? (
              <>
                found as <span className="font-medium text-ink">{matchedAs}</span> · {item.group}
              </>
            ) : (
              item.group
            )}
          </span>
        </div>
        <Verdict low={low} />
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-line/70 pt-3">
          <p className="text-[12.5px] leading-snug text-muted">
            <span className="font-semibold text-ink">{low ? "Low FODMAP" : "High FODMAP"}</span> · {item.group}
            {item.note ? ` — ${item.note}` : "."}
          </p>
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

function Verdict({ low }: { low: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
        low ? "bg-success-tint text-success" : "bg-danger-tint text-danger",
      )}
      style={{ fontFamily: "var(--font-label)" }}
    >
      {low ? <Check size={12} strokeWidth={3} /> : <Ban size={12} strokeWidth={3} />}
      {low ? "Enjoy" : "Avoid"}
    </span>
  );
}
