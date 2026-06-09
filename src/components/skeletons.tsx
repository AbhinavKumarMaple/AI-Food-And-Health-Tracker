import { cn } from "@/lib/cn";

/** Base shimmer block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/70", className)} />;
}

function StatPillSk() {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-6 w-12" />
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

function RowSk() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

function HeaderSk({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className={cn("h-7", wide ? "w-36" : "w-24")} />
      </div>
      <Skeleton className="h-9 w-9 rounded-full" />
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="h-44 rounded-none rounded-b-[2rem]" />
      <div className="flex flex-col gap-5 px-5 pt-4">
        <Skeleton className="-mt-12 h-24 rounded-3xl" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-3">
            <StatPillSk />
            <StatPillSk />
            <StatPillSk />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-32" />
          <RowSk />
          <RowSk />
          <RowSk />
        </div>
      </div>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <HeaderSk wide />
      <Skeleton className="h-40 rounded-3xl" />
      <div className="flex justify-between">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-12 w-10 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <RowSk />
        <RowSk />
        <RowSk />
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <HeaderSk />
      <Skeleton className="h-48 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <StatPillSk />
        <StatPillSk />
        <StatPillSk />
        <StatPillSk />
      </div>
      <Skeleton className="h-4 w-40" />
      <RowSk />
      <RowSk />
    </div>
  );
}

export function DaySkeleton() {
  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-2.5">
        <RowSk />
        <RowSk />
        <RowSk />
        <RowSk />
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28" />
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-12 rounded-2xl" />
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <Skeleton className="h-44 rounded-3xl" />
      <Skeleton className="h-4 w-24" />
      <RowSk />
      <RowSk />
      <RowSk />
    </div>
  );
}
