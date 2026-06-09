"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  eyebrow,
  right,
  back = true,
}: {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
  back?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 px-5 pb-2 pt-3">
      {back && (
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="flex flex-1 flex-col">
        {eyebrow && (
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary"
            style={{ fontFamily: "var(--font-label)" }}
          >
            {eyebrow}
          </span>
        )}
        <h1 className="text-[26px] font-extrabold leading-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
      </div>
      {right}
    </div>
  );
}
