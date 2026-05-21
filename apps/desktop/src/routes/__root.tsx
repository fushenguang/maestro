import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { App } from "@/App";
import type { RouterContext } from "@/router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent
});

function RootComponent() {
  return (
    <App>
      <Outlet />
    </App>
  );
}
