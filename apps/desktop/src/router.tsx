import { createRouter } from "@tanstack/react-router";
import { Route as RootRoute } from "./routes/__root";
import { Route as IndexRoute } from "./routes/index";
import { Route as AuthCallbackRoute } from "./routes/auth-callback";
import { Route as LoginRoute } from "./routes/login";
import { Route as VerifyRoute } from "./routes/verify";
import { Route as AppRoute } from "./routes/_app";
import { Route as DashboardRoute } from "./routes/_app/dashboard";
import { Route as ResourcesRoute } from "./routes/_app/resources";
import { Route as InsightsRoute } from "./routes/_app/insights";
import { Route as IdeasRoute } from "./routes/_app/ideas/$id";
import type { Session } from "@supabase/supabase-js";

export interface RouterContext {
  session: Session | null;
  loading: boolean;
}

export const rootRoute = RootRoute;
export const indexRoute = IndexRoute;
export const loginRoute = LoginRoute;
export const authCallbackRoute = AuthCallbackRoute;
export const verifyRoute = VerifyRoute;

export const routeTree = RootRoute.addChildren([
  IndexRoute,
  LoginRoute as never,
  AuthCallbackRoute as never,
  VerifyRoute as never,
  AppRoute.addChildren([
    DashboardRoute,
    ResourcesRoute,
    InsightsRoute,
    IdeasRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    session: null,
    loading: true
  }
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

