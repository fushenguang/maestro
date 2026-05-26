import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { Route as RootRoute } from "./__root";
import { AppShell } from "@/components/AppShell";
import { useAuthStore } from "@/store/auth";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  id: "_app",
  beforeLoad: () => {
    const state = useAuthStore.getState();
    if (!state.loading && !state.session) {
      throw redirect({ to: "/login" as never });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
