"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, History, BarChart3, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/history", label: "History", icon: History },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function TabBar() {
  const pathname = usePathname();

  return (
    // Transparent gutter so the bar reads as floating off the bottom + side edges.
    <div className="px-4 pt-2 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
      <nav className="flex items-stretch justify-around rounded-[26px] border border-line/70 bg-surface/92 px-2 py-2 shadow-[0_14px_30px_-6px_rgba(26,26,26,0.22)] backdrop-blur-md">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-1"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl transition-colors",
                  active ? "bg-primary-tint text-primary" : "text-faint",
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.6 : 2.1} />
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  active ? "text-primary" : "text-faint",
                )}
                style={{ fontFamily: "var(--font-label)" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
