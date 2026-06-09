"use client";

import { X, Utensils, Clock, Activity, Link2, Smile, Droplets, Sparkles, type LucideIcon } from "lucide-react";
import { IconBadge } from "./ui";

type Row = {
  icon: LucideIcon;
  tone: "orange" | "danger" | "warm" | "success";
  title: string;
  example: string;
};

const ROWS: Row[] = [
  { icon: Utensils, tone: "orange", title: "What you ate or drank", example: "“I had oatmeal with blueberries and a black coffee”" },
  { icon: Clock, tone: "warm", title: "When — even roughly", example: "“around 8:30”, “after lunch”" },
  { icon: Activity, tone: "danger", title: "How you're feeling", example: "“a bit bloated for about 30 minutes”" },
  { icon: Link2, tone: "orange", title: "What you think caused it", example: "“I think it was the coffee”" },
  { icon: Smile, tone: "success", title: "Mood & energy", example: "“feeling pretty good, about a 4 out of 5”" },
  { icon: Droplets, tone: "warm", title: "Water & drinks", example: "“drank about 1.5 litres today”" },
];

export function SayGuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 animate-[avni-fade_0.2s_ease-out]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <div className="w-full max-w-[30rem] max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-canvas px-5 pb-9 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] animate-[avni-sheet_0.28s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />

          <div className="mb-1 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <h2 className="text-[19px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                Just talk naturally
              </h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-warm text-muted">
              <X size={16} />
            </button>
          </div>
          <p className="mb-5 text-[13px] leading-relaxed text-muted">
            Mention as much or as little as you remember — Avni structures it and asks about anything you skip.
            Here&apos;s what&apos;s useful to include:
          </p>

          <div className="flex flex-col gap-3">
            {ROWS.map((r) => (
              <div key={r.title} className="flex items-start gap-3">
                <IconBadge icon={r.icon} tone={r.tone} size={40} />
                <div className="flex flex-1 flex-col pt-0.5">
                  <span className="text-[14px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                    {r.title}
                  </span>
                  <span className="text-[12.5px] italic leading-snug text-muted">{r.example}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-primary-tint px-4 py-3 text-[12.5px] leading-relaxed text-primary-press">
            <Sparkles size={15} className="mt-0.5 shrink-0" />
            <span>You don&apos;t need all of these. Say what you can; we&apos;ll ask follow-up questions to fill in the rest.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
