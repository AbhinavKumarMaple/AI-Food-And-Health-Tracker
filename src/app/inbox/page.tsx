"use client";

import { useRouter } from "next/navigation";
import { Loader2, Sparkles, AlertTriangle, ChevronRight, Trash2, RotateCw, Inbox as InboxIcon } from "lucide-react";
import type { LogSession } from "@/lib/store/types";
import { useAuth } from "@/lib/useAuth";
import { useLogSessions, useQueryClient } from "@/lib/queries";
import { discardSessionOptimistic, retrySessionOptimistic } from "@/lib/mutations";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { RefreshButton } from "@/components/RefreshButton";
import { Card } from "@/components/cards";
import { IconBadge } from "@/components/ui";
import { RowsSkeleton } from "@/components/skeletons";

function preview(s: LogSession): string {
  return (s.transcript || s.typedTextBefore || "").trim() || "Voice note";
}
function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
/** A job that's been "processing" too long (since its last update) has likely
 *  been cut off server-side. Uses updatedAt so a fresh retry isn't "stuck". */
function isStuck(s: LogSession): boolean {
  return s.parseStatus === "processing" && Date.now() - new Date(s.updatedAt).getTime() > 2 * 60_000;
}

export default function InboxPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const q = useLogSessions(!!user);
  const sessions = q.data;

  function dismiss(id: string) {
    discardSessionOptimistic(queryClient, id);
  }
  function retry(id: string) {
    retrySessionOptimistic(queryClient, id);
  }

  return (
    <Screen>
      <PageHeader
        title="Inbox"
        eyebrow="Pending logs"
        back={false}
        right={<RefreshButton onRefresh={() => q.refetch()} />}
      />

      <div className="flex flex-col gap-2.5 px-5 pb-8 pt-2">
        {loading || !user || !sessions ? (
          <RowsSkeleton count={3} />
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
            <IconBadge icon={InboxIcon} tone="warm" size={44} />
            <p className="text-[14px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Nothing waiting
            </p>
            <p className="text-[13px] text-muted">
              Record or type a log — it&apos;ll process here in the background, then wait for your review.
            </p>
          </div>
        ) : (
          sessions.map((s) => {
            const stuck = isStuck(s);
            const ready = s.parseStatus === "parsed";
            const failed = s.parseStatus === "failed" || stuck;
            return (
              <Card key={s.id} onClick={ready ? () => router.push(`/review/${s.id}`) : undefined}>
                <div className="flex items-center gap-3">
                  {ready ? (
                    <IconBadge icon={Sparkles} tone="orange" size={40} />
                  ) : failed ? (
                    <IconBadge icon={AlertTriangle} tone="danger" size={40} />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warm text-muted">
                      <Loader2 size={18} className="animate-spin" />
                    </span>
                  )}

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                      {ready ? "Ready to review" : failed ? "Couldn't organize this" : "Organizing…"}
                    </span>
                    <span className="truncate text-[12px] text-muted">{preview(s)}</span>
                    <span className="text-[11px] text-faint" style={{ fontFamily: "var(--font-label)" }}>
                      {ago(s.createdAt)}
                      {stuck && " · taking longer than usual"}
                      {s.parseStatus === "failed" && s.error ? ` · ${s.error.slice(0, 60)}` : ""}
                    </span>
                  </div>

                  {ready ? (
                    <ChevronRight size={18} className="shrink-0 text-faint" />
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      {failed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            retry(s.id);
                          }}
                          aria-label="Retry"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary-tint active:scale-95"
                        >
                          <RotateCw size={15} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(s.id);
                        }}
                        aria-label="Dismiss"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition hover:bg-danger-tint hover:text-danger active:scale-95"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </Screen>
  );
}
