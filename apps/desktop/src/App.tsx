import type { PropsWithChildren } from "react";
import { Button } from "@/components/ui/button";

export default function App({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Maestro Desktop
            </p>
            <h1 className="text-xl font-semibold">Bootstrap shell</h1>
          </div>
          <Button variant="outline">Desktop Shell</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
