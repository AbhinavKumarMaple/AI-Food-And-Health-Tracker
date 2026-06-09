"use client";

import { StatusBar } from "./StatusBar";
import { TabBar } from "./TabBar";

export function Screen({
  children,
  showTab = true,
  dark = false,
}: {
  children: React.ReactNode;
  showTab?: boolean;
  dark?: boolean;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <StatusBar dark={dark} />
      <main className="no-scrollbar flex-1 overflow-y-auto">{children}</main>
      {showTab && <TabBar />}
    </div>
  );
}
