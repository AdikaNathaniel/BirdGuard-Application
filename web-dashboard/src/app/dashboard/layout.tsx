"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tokenStorage } from "@/lib/api-client";
import { CameraIcon, DetectorIcon, LogsIcon, ProfileIcon } from "@/components/icons";

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

  // Deliberately deferred to an effect: this layout is statically
  // prerendered (no `window`/localStorage at build time), so both the
  // server-rendered HTML and the client's first hydration pass agree on
  // `ready = false` (the spinner below). Only after mount does the client
  // check for a real token and either redirect or reveal the dashboard --
  // avoiding a hydration mismatch between server and client output.
  useEffect(() => {
    if (!tokenStorage.read()) {
      router.replace("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 bg-white">
      <aside className="flex w-64 shrink-0 flex-col border-r border-black/10 px-4 py-6">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-accent">
            <Image src="/birdguard-logo.jpg" alt="BirdGuard" width={40} height={40} className="h-full w-full object-cover" />
          </div>
          <span className="text-lg font-bold text-accent">BirdGuard</span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-accent/10 text-accent" : "text-black/70 hover:bg-black/5"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
