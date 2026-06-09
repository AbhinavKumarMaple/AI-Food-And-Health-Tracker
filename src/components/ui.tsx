"use client";

import { Star, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---- Buttons ------------------------------------------------------------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
};

export function PrimaryButton({ icon: Icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50",
        className,
      )}
    >
      {Icon && <Icon size={18} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

export function SecondaryButton({ icon: Icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 text-[15px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50",
        className,
      )}
    >
      {Icon && <Icon size={18} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

/* ---- Chip / tag ---------------------------------------------------------- */

export function Chip({
  children,
  tone = "warm",
}: {
  children: React.ReactNode;
  tone?: "warm" | "orange" | "danger" | "success";
}) {
  const tones = {
    warm: "bg-warm text-muted",
    orange: "bg-primary-tint text-primary-press",
    danger: "bg-danger-tint text-danger",
    success: "bg-success-tint text-success",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-[3px] text-[10px] font-semibold tracking-wide",
        tones[tone],
      )}
      style={{ fontFamily: "var(--font-label)" }}
    >
      {children}
    </span>
  );
}

/* ---- Trend pill (e.g. +12%) --------------------------------------------- */

export function TrendPill({ delta }: { delta: string }) {
  const negative = delta.trim().startsWith("-");
  const Icon = negative ? TrendingDown : TrendingUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold",
        negative ? "text-danger" : "text-success",
      )}
      style={{ fontFamily: "var(--font-label)" }}
    >
      <Icon size={11} strokeWidth={2.6} />
      {delta}
    </span>
  );
}

/* ---- Star rating --------------------------------------------------------- */

export function Stars({
  value,
  size = 18,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        const star = (
          <Star
            size={size}
            strokeWidth={2}
            className={filled ? "text-primary" : "text-line"}
            fill={filled ? "currentColor" : "none"}
          />
        );
        return onChange ? (
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} stars`}>
            {star}
          </button>
        ) : (
          <span key={i}>{star}</span>
        );
      })}
    </div>
  );
}

/* ---- Completeness ring --------------------------------------------------- */

export function CompletenessRing({ value, size = 34 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = pct >= 80 ? "var(--color-success)" : pct >= 50 ? "var(--color-primary)" : "var(--color-faint)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-muted"
        style={{ fontFamily: "var(--font-label)" }}
      >
        {pct}
      </span>
    </div>
  );
}

/* ---- Icon badge (rounded square with tinted icon) ------------------------ */

export function IconBadge({
  icon: Icon,
  tone = "orange",
  size = 44,
}: {
  icon: LucideIcon;
  tone?: "orange" | "danger" | "warm" | "success";
  size?: number;
}) {
  const tones = {
    orange: "bg-primary-tint text-primary",
    danger: "bg-danger-tint text-danger",
    warm: "bg-warm text-muted",
    success: "bg-success-tint text-success",
  } as const;
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-xl", tones[tone])}
      style={{ width: size, height: size }}
    >
      <Icon size={size * 0.45} strokeWidth={2.2} />
    </span>
  );
}

/* ---- Section header ------------------------------------------------------ */

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      {action}
    </div>
  );
}
