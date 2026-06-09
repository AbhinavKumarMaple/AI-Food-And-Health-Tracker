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
    <nav className="sticky bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-around px-3 pt-2.5 pb-6">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          if (active) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-white shadow-sm"
              >
                <Icon size={18} strokeWidth={2.4} />
                <span
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ fontFamily: "var(--font-label)" }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-1 px-3 py-1 text-faint"
            >
              <Icon size={20} strokeWidth={2.2} />
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ fontFamily: "var(--font-label)" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
