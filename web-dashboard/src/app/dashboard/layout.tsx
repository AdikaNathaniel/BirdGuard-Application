"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tokenStorage } from "@/lib/api-client";
import { CameraIcon, ChevronDoubleLeftIcon, DetectorIcon, LogsIcon, ProfileIcon } from "@/components/icons";

const SIDEBAR_COLLAPSED_KEY = "birdguard_sidebar_collapsed";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Camera Feed", icon: CameraIcon, match: (p: string) => p === "/dashboard" },
  { href: "/dashboard/detector", label: "Detector", icon: DetectorIcon, match: (p: string) => p.startsWith("/dashboard/detector") },
  { href: "/dashboard/logs", label: "Logs", icon: LogsIcon, match: (p: string) => p.startsWith("/dashboard/logs") },
  {
    href: "/dashboard/profile",
    label: "Profile",
    icon: ProfileIcon,
    match: (p: string) => p.startsWith("/dashboard/profile") || p.startsWith("/dashboard/settings"),
  },
];

/**
 * Auth-gated shell for every /dashboard/* route: a left sidebar nav (the
 * desktop equivalent of the Flutter app's bottom NavigationBar) plus a
 * client-side redirect to /login when there's no stored JWT. Mirrors
 * MainNavigationPage's four destinations (Camera / Detector / Logs /
 * Profile), with Settings folded under Profile just like the mobile app's
 * settings-icon-on-the-profile-tab pattern.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Deliberately deferred to an effect: this layout is statically
  // prerendered (no `window`/localStorage at build time), so both the
  // server-rendered HTML and the client's first hydration pass agree on
  // `ready = false` (the spinner below). Only after mount does the client
  // check for a real token and either redirect or reveal the dashboard --
  // avoiding a hydration mismatch between server and client output. The
  // sidebar's collapsed/expanded preference is read here too, for the
  // same reason -- it only matters once the real dashboard (behind
  // `ready`) is about to render.
  useEffect(() => {
    if (!tokenStorage.read()) {
      router.replace("/login");
      return;
    }
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // Ignore -- falls back to the default expanded state.
    }
    setReady(true);
  }, [router]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore -- the toggle still works for this session, it just won't persist.
      }
      return next;
    });
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 bg-white">
      <aside
        className={`flex shrink-0 flex-col border-r border-black/10 py-6 transition-[width] duration-200 ${
          collapsed ? "w-[72px] px-3" : "w-64 px-4"
        }`}
      >
        <div className={`mb-8 flex items-center gap-3 ${collapsed ? "justify-center px-0" : "px-2"}`}>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-accent">
            <Image src="/birdguard-logo.jpg" alt="BirdGuard" width={40} height={40} className="h-full w-full object-cover" />
          </div>
          {!collapsed && <span className="text-lg font-bold text-accent">BirdGuard</span>}
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  collapsed ? "justify-center" : ""
                } ${active ? "bg-accent/10 text-accent" : "text-black/70 hover:bg-black/5"}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && label}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-black/80 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    {label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={toggleCollapsed}
          className={`group relative mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black/50 transition hover:bg-black/5 hover:text-black/70 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <ChevronDoubleLeftIcon
            className={`h-5 w-5 shrink-0 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && "Collapse"}
          {collapsed && (
            <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-black/80 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              Expand
            </span>
          )}
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
