import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { router } from "./router";
import { useAuthStore } from "@/store/auth";
import "./index.css";

function AppRouter() {
  const { loading, session } = useAuthStore((state) => ({
    session: state.session,
    loading: state.loading
  }));

  useEffect(() => {
    void router.invalidate();
  }, [loading, session]);

  return (
    <RouterProvider
      router={router}
      context={{
        loading,
        session
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter />
    <Toaster position="bottom-right" />
  </React.StrictMode>
);
