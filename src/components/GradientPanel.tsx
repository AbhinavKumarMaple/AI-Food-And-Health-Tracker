import { cn } from "@/lib/cn";

type Variant = "dark" | "orange" | "amber";

/**
 * Rounded hero panel. The "dark" and "amber" heroes (History / Review / Today)
 * use the exact ribbon artwork exported from the Pencil design
 * (public/heroes/ribbon.png). The "orange" hero (Stats) uses the design's
 * #FF5C00→#FF8533 linear gradient.
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
  const isRibbon = variant === "dark" || variant === "amber";
  const variantClass = isRibbon
    ? "bg-[#1a1a1a] bg-[url('/heroes/ribbon.png')] bg-cover bg-top"
    : "bg-[linear-gradient(135deg,#ff5c00_0%,#ff8533_100%)]";

  return (
    <div className={cn("relative overflow-hidden", rounded, variantClass, className)}>
      {variant === "orange" && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-16 h-60 w-80 rounded-full bg-[radial-gradient(closest-side,#ffffff44,transparent)]" />
          <div className="absolute -left-10 bottom-0 h-56 w-80 rounded-full bg-[radial-gradient(closest-side,#ffb38055,transparent)]" />
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
