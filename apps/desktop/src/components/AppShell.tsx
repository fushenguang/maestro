import type { PropsWithChildren } from "react";
import { Topbar } from "./Topbar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar />
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
