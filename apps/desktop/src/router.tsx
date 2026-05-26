import { createRouter } from "@tanstack/react-router";
import { Route as RootRoute } from "./routes/__root";
import { Route as IndexRoute } from "./routes/index";
import { Route as AuthCallbackRoute } from "./routes/auth-callback";
import { Route as LoginRoute } from "./routes/login";
import { Route as VerifyRoute } from "./routes/verify";
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
