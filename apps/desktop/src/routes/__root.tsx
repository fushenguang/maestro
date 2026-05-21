import { Outlet, createRootRoute } from "@tanstack/react-router";
import App from "@/App";

function RootComponent() {
  return (
    <App>
      <Outlet />
    </App>
  );
}

export const Route = createRootRoute({
  component: RootComponent
});
