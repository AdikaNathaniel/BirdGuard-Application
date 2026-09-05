"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

type Detection = {
  label?: string;
  confidence?: number;
  detectedAt?: string;
};

const PAGE_SIZE = 30;

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "Unknown time";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;

  const diffMs = Date.now() - dt.getTime();
  const diffSec = diffMs / 1000;
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;

  const two = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${two(dt.getMonth() + 1)}-${two(dt.getDate())} ${two(dt.getHours())}:${two(dt.getMinutes())}`;
}

export default function LogsPage() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const detectionsRef = useRef<Detection[]>([]);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  // Refs must only be written outside of render (effects/handlers), never
  // during the render body itself -- so mirroring `detections` into a ref
  // for loadMore()/pollForNew() to read without becoming a dependency of
  // their own closures happens here, not as a bare assignment above.
  useEffect(() => {
    detectionsRef.current = detections;
  }, [detections]);

  async function loadFirstPage() {
    setIsLoading(true);
    loadingRef.current = true;
    setHasError(false);
    try {
      const result = await apiClient.getDetections({ limit: PAGE_SIZE });
      const list = (result["detections"] as Detection[] | undefined) ?? [];
      setDetections(list);
      setHasMore(list.length === PAGE_SIZE);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }

  async function loadMore() {
    if (detectionsRef.current.length === 0) return;
    setIsLoadingMore(true);
    loadingMoreRef.current = true;
    try {
      const oldest = detectionsRef.current[detectionsRef.current.length - 1]?.detectedAt;
      const result = await apiClient.getDetections({ limit: PAGE_SIZE, before: oldest });
      const list = (result["detections"] as Detection[] | undefined) ?? [];
      setDetections((prev) => [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
    } catch {
      // Silently ignore -- the user can retry by scrolling again.
    } finally {
      setIsLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }

  // Polls for newly written detections while the page is open, and prepends
  // only entries newer than what's already shown -- mirrors _pollForNew()
  // in logs_tab.dart, since the Pi writes detections straight to MongoDB.
  async function pollForNew() {
    if (loadingRef.current || loadingMoreRef.current || detectionsRef.current.length === 0) return;
    try {
      const result = await apiClient.getDetections({ limit: PAGE_SIZE });
      const list = (result["detections"] as Detection[] | undefined) ?? [];
      if (list.length === 0) return;

      const latestKnown = detectionsRef.current[0]?.detectedAt;
      const fresh: Detection[] = [];
      for (const d of list) {
        if (latestKnown && d.detectedAt && d.detectedAt.localeCompare(latestKnown) <= 0) break;
        fresh.push(d);
      }
      if (fresh.length > 0) {
        setDetections((prev) => [...fresh, ...prev]);
      }
    } catch {
      // Silent -- the next tick or a manual refresh will catch up.
    }
  }

  // Deliberately fetches on mount rather than through a library like SWR:
  // this list has bespoke incremental-merge semantics (loadMore() appends
  // older pages, pollForNew() prepends only genuinely-new entries) that a
  // single cache key doesn't model well. Detections are also dynamic,
  // per-user data with no reason to be baked into the static prerender, so
  // deferring the first fetch to a post-mount effect (rather than a lazy
  // render-time call) is both correct and intentional here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage();
    const timer = window.setInterval(pollForNew, 8000);
    return () => window.clearInterval(timer);
  }, []);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasMore || isLoadingMore || isLoading) return;
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) {
      loadMore();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-base font-bold">Detection Logs</h1>

      {isLoading && detections.length === 0 && (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
        </div>
      )}

      {hasError && detections.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-black/60">
          <span>Could not load logs</span>
          <button onClick={loadFirstPage} className="text-sm font-medium text-accent">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !hasError && detections.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-black/50">
          <span>No detections yet</span>
        </div>
      )}

      {detections.length > 0 && (
        <div onScroll={handleScroll} className="flex max-h-[70vh] flex-col gap-2.5 overflow-y-auto pr-1">
          {detections.map((d, i) => {
            const label = d.label ?? "unknown";
            const confidence = d.confidence ?? 0;
            return (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-black/15 p-3.5">
                <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <circle cx="12" cy="8" r="3.4" />
                    <path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">
                    {label.charAt(0).toUpperCase() + label.slice(1)} detected
                  </p>
                  <p className="text-[12.5px] text-black/50">{formatTimestamp(d.detectedAt)}</p>
                </div>
                <span className="rounded-lg bg-green-500/10 px-2 py-1 text-[12.5px] font-semibold text-green-700">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            );
          })}
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
