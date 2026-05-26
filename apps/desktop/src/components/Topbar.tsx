import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface NavTab {
  label: string;
  href: string;
  disabled?: boolean;
}

const NAV_TABS: NavTab[] = [
  { label: "products", href: "/dashboard" },
  { label: "resources", href: "/resources" },
  { label: "insights", href: "/insights" },
  { label: "settings", href: "/settings", disabled: true },
];

export function Topbar() {
  const { user } = useAuthStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isProductsActive =
    pathname === "/dashboard" || pathname.startsWith("/ideas/");

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  const avatarUrl = user?.user_metadata?.["avatar_url"] as string | undefined;
  const displayName = (
    (user?.user_metadata?.["full_name"] as string | undefined) ??
    user?.email ??
    ""
  );
  const initials =
    displayName
      .split(/[\s@]/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "U";

  return (
    <header className="h-12 flex items-center px-5 border-b border-border bg-background relative z-10">
      {/* Wordmark */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Outlined M box — matches prototype */}
        <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded border border-foreground/80 font-mono text-[11px] font-semibold text-foreground leading-none">
          M
        </span>
        <span className="font-sans text-[13px] font-semibold tracking-[0.12em] uppercase text-foreground">
          Maestro
        </span>
      </div>

      {/* Nav Tabs — centred */}
      <nav className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        {NAV_TABS.map(({ label, href, disabled }) => {
          if (disabled) {
            return (
              <span
                key={label}
                className="px-[10px] py-[5px] font-mono text-xs text-muted-foreground/30 cursor-default select-none rounded"
              >
                {label}
              </span>
            );
          }
          const isActive =
            label === "products"
              ? isProductsActive
              : pathname.startsWith(href);
          return (
            <Link
              key={label}
              to={href as never}
              className={`px-[10px] py-[5px] font-mono text-xs rounded border transition-colors ${
                isActive
                  ? "border-border bg-secondary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2 shrink-0" ref={menuRef}>
        {/* + new idea */}
        <Link
          to="/ideas/new"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-border bg-foreground text-background font-sans text-[12px] font-medium hover:opacity-90 transition-opacity"
        >
          <span className="text-[13px] leading-none">+</span>
          new idea
        </Link>

        {/* Avatar */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-full focus:outline-none focus:ring-1 focus:ring-ring ml-1"
          aria-label="User menu"
          aria-expanded={menuOpen}
        >
          <Avatar className="h-7 w-7">
            {avatarUrl && (
              <AvatarImage src={avatarUrl} alt={displayName || "User"} />
            )}
            <AvatarFallback className="font-mono text-[10px] bg-muted">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-4 top-11 w-44 rounded-md border border-border bg-card shadow-lg py-1 z-50">
            {displayName && (
              <div className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground truncate border-b border-border mb-1">
                {displayName}
              </div>
            )}
            <button
              onClick={() => void handleSignOut()}
              className="w-full text-left px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
