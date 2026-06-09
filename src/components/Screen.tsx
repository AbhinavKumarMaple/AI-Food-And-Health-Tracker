"use client";

import { TabBar } from "./TabBar";

export function Screen({
  children,
  showTab = true,
}: {
  children: React.ReactNode;
  showTab?: boolean;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <main className="no-scrollbar flex-1 overflow-y-auto">{children}</main>
      {showTab && <TabBar />}
    </div>
  );
}
