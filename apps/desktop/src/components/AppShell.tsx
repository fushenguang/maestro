import type { PropsWithChildren } from "react";
import { Topbar } from "./Topbar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
