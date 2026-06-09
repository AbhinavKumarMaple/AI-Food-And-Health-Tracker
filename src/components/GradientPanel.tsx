import { cn } from "@/lib/cn";

type Variant = "dark" | "orange" | "amber";

/**
 * Rounded hero panel with the layered radial "ribbon" glow from the design.
 * - dark   → near-black with warm orange blobs (History / Review header)
 * - orange → vivid orange gradient (Stats hero)
 * - amber  → warm amber header (Today greeting)
 */
export function GradientPanel({
  variant = "dark",
  className,
  children,
  rounded = "rounded-3xl",
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
  rounded?: string;
}) {
  const base =
    variant === "dark"
      ? "bg-[#1a1a1a]"
      : variant === "orange"
        ? "bg-[#ff5c00]"
        : "bg-[#e8530a]";

  return (
    <div className={cn("relative overflow-hidden", rounded, base, className)}>
      {/* decorative ribbon blobs */}
      <div className="pointer-events-none absolute inset-0">
        {variant === "dark" ? (
          <>
            <div className="absolute -left-24 -top-20 h-72 w-[28rem] rounded-full bg-[radial-gradient(closest-side,#ff5c00cc,transparent)] opacity-80" />
            <div className="absolute left-24 -top-10 h-64 w-[26rem] rounded-full bg-[radial-gradient(closest-side,#ff8533aa,transparent)] opacity-70" />
            <div className="absolute -left-10 top-24 h-64 w-[28rem] rounded-full bg-[radial-gradient(closest-side,#ffb380aa,transparent)] opacity-60" />
          </>
        ) : (
          <>
            <div className="absolute -right-16 -top-16 h-60 w-80 rounded-full bg-[radial-gradient(closest-side,#ffffff55,transparent)]" />
            <div className="absolute -left-10 bottom-0 h-56 w-80 rounded-full bg-[radial-gradient(closest-side,#ffb38066,transparent)]" />
          </>
        )}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
