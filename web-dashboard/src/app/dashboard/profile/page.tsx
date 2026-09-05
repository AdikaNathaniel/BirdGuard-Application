"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readClaims, tokenStorage } from "@/lib/api-client";
import { SettingsIcon, LogoutIcon } from "@/components/icons";

export default function ProfilePage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);

  // Deliberately deferred to an effect rather than a lazy useState
  // initializer: this page is statically prerendered (no `window` at build
  // time), so reading localStorage during render would return a different
  // value on the server than on the client and trigger a hydration
  // mismatch. Running it post-mount instead means both environments agree
  // on the initial `null` render, then the client fills in the real claims.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClaims(readClaims());
  }, []);

  function logout() {
    tokenStorage.clear();
    router.push("/login");
  }

  const email = (claims?.["email"] as string) ?? "—";
  const username = (claims?.["username"] as string) ?? "—";
  const initial = username && username !== "—" ? username[0].toUpperCase() : "?";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Link
          href="/dashboard/settings"
          className="rounded-full p-2 text-black/60 transition hover:bg-black/5"
          title="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </Link>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex h-[90px] w-[90px] items-center justify-center rounded-full bg-accent text-3xl font-bold text-white">
          {initial}
        </div>
        <span className="text-lg font-bold">{username}</span>
      </div>

      <div className="divide-y divide-black/10 rounded-2xl border border-black/15 px-4">
        <InfoRow label="Email" value={email} />
        <InfoRow label="Username" value={username} />
      </div>

      <button
        onClick={logout}
        className="flex h-[50px] items-center justify-center gap-2 rounded-full border border-red-400 text-sm font-semibold text-red-500 transition hover:bg-red-50"
      >
        <LogoutIcon className="h-5 w-5" />
        Logout
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[13px] text-black/60">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
