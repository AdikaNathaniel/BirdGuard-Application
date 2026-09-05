"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { tokenStorage } from "@/lib/api-client";

/**
 * The root route holds no UI of its own -- it just decides whether the
 * visitor already has a session (mirrors the Flutter app's splash screen,
 * which checks stored auth before deciding where to land).
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const hasToken = Boolean(tokenStorage.read());
    router.replace(hasToken ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
    </div>
  );
}
