"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiClient, ApiException } from "@/lib/api-client";
import { StatusCard, Spinner } from "@/components/StatusCard";

type Toast = { message: string; isError: boolean } | null;

const STATUS_KEY = "detector-status";

export default function DetectorPage() {
  const [startInFlight, setStartInFlight] = useState(false);
  const [stopInFlight, setStopInFlight] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // useSWR owns the fetch-on-mount + poll-every-5s lifecycle, so this
  // component never calls setState directly inside an effect body -- it
  // just reads whatever useSWR's own subscription last resolved to.
  const { data, error, mutate } = useSWR(STATUS_KEY, () => apiClient.getDetectorStatus(), {
    refreshInterval: 5000,
    // Skip a background refresh while a start/stop is already waiting on
    // the Pi to reach its real end state, so a concurrent poll can't
    // race and overwrite that in-flight result.
    isPaused: () => startInFlight || stopInFlight,
    revalidateOnFocus: false,
  });

  function showToast(message: string, isError = false) {
    setToast({ message, isError });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function startDetector() {
    setStartInFlight(true);
    try {
      const result = await apiClient.startDetector();
      const success = result["success"] !== false;
      showToast(success ? "Detector started" : "Failed to start detector", !success);
      if (success) {
        // The backend already verifies the real outcome before reporting
        // success, so trust it directly instead of spending a second SSH
        // round trip just to re-confirm what this response already told us.
        const output = String(result["output"] ?? "");
        const match = output.match(/STARTED\s+(\d+)/);
        mutate({ success: true, running: true, pid: match ? match[1] : undefined }, false);
      } else {
        mutate();
      }
    } catch (err) {
      const message = err instanceof ApiException ? err.message : "connection error";
      showToast(`Failed to start detector: ${message}`, true);
      mutate();
    } finally {
      setStartInFlight(false);
    }
  }

  async function stopDetector() {
    setStopInFlight(true);
    try {
      const result = await apiClient.stopDetector();
      const success = result["success"] !== false;
      showToast(success ? "Detector stopped" : "Failed to stop detector", !success);
      if (success) {
        mutate({ success: true, running: false }, false);
      } else {
        mutate();
      }
    } catch (err) {
      const message = err instanceof ApiException ? err.message : "connection error";
      showToast(`Failed to stop detector: ${message}`, true);
      mutate();
    } finally {
      setStopInFlight(false);
    }
  }

  const isRunning = data ? data["running"] === true : null;
  const pid = data?.["pid"] != null ? String(data["pid"]) : null;
  const statusError = Boolean(error);

  const running = isRunning === true;
  const unknown = isRunning === null || statusError;

  let label: string;
  if (startInFlight) label = "Detector: Starting…";
  else if (stopInFlight) label = "Detector: Stopping…";
  else if (statusError && isRunning === null) label = "Detector: Unknown (status unavailable)";
  else if (unknown) label = "Detector: Checking…";
  else label = running ? "Detector: Running" : "Detector: Stopped";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-base font-bold">Person Detector</h1>

      <StatusCard label={label} dotColor={unknown ? "grey" : running ? "green" : "grey"} pid={pid} running={running} />

      {toast && (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm text-white ${toast.isError ? "bg-red-500" : "bg-green-600"}`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={startDetector}
          disabled={startInFlight || running}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startInFlight ? <Spinner /> : "▶"}
          Start Detector
        </button>
        <button
          onClick={stopDetector}
          disabled={stopInFlight || !running}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {stopInFlight ? <Spinner /> : "■"}
          Stop Detector
        </button>
      </div>
    </div>
  );
}
