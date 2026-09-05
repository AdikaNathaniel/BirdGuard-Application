"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiClient, ApiException } from "@/lib/api-client";
import { StatusCard, Spinner } from "@/components/StatusCard";

type Toast = { message: string; isError: boolean } | null;

const STATUS_KEY = "servo-sweep-status";

/**
 * Lets the user configure and control the pan servo's field-of-view sweep:
 * a two-step sequence (angle + hold duration for each step) that the servo
 * cycles between repeatedly -- the web equivalent of typing `recur` on the
 * Pi and entering two `p<angle>,<seconds>` steps at the prompt. Mirrors
 * settings_page.dart's Step 1/Step 2 form and its 90/0.70, 140/0.90 hints.
 */
export default function SettingsPage() {
  const [angle1, setAngle1] = useState("90");
  const [seconds1, setSeconds1] = useState("0.70");
  const [angle2, setAngle2] = useState("140");
  const [seconds2, setSeconds2] = useState("0.90");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [startInFlight, setStartInFlight] = useState(false);
  const [stopInFlight, setStopInFlight] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // useSWR owns the fetch-on-mount + poll-every-5s lifecycle, so this
  // component never calls setState directly inside an effect body -- it
  // just reads whatever useSWR's own subscription last resolved to.
  const { data, error, mutate } = useSWR(STATUS_KEY, () => apiClient.getServoSweepStatus(), {
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

  function validateAngle(value: string): string | null {
    const n = Number(value);
    if (value.trim() === "" || Number.isNaN(n)) return "Enter a number";
    if (n < 0 || n > 180) return "Must be between 0 and 180";
    return null;
  }

  function validateSeconds(value: string): string | null {
    const n = Number(value);
    if (value.trim() === "" || Number.isNaN(n)) return "Enter a number";
    if (n < 0.05 || n > 5) return "Must be between 0.05 and 5";
    return null;
  }

  function validateAll(): boolean {
    const next: Record<string, string> = {};
    const a1 = validateAngle(angle1);
    const s1 = validateSeconds(seconds1);
    const a2 = validateAngle(angle2);
    const s2 = validateSeconds(seconds2);
    if (a1) next.angle1 = a1;
    if (s1) next.seconds1 = s1;
    if (a2) next.angle2 = a2;
    if (s2) next.seconds2 = s2;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function startSweep() {
    if (!validateAll()) return;

    setStartInFlight(true);
    try {
      const result = await apiClient.startServoSweep({
        angle1: Number(angle1),
        seconds1: Number(seconds1),
        angle2: Number(angle2),
        seconds2: Number(seconds2),
      });
      const success = result["success"] !== false;
      showToast(success ? "Sweep started" : "Failed to start sweep", !success);
      if (success) {
        // The backend already verifies the process is actually alive before
        // reporting success -- trust it directly.
        const output = String(result["output"] ?? "");
        const match = output.match(/STARTED\s+(\d+)/);
        mutate({ success: true, running: true, pid: match ? match[1] : undefined }, false);
      } else {
        mutate();
      }
    } catch (err) {
      const message = err instanceof ApiException ? err.message : "connection error";
      showToast(`Failed to start sweep: ${message}`, true);
      mutate();
    } finally {
      setStartInFlight(false);
    }
  }

  async function stopSweep() {
    setStopInFlight(true);
    try {
      const result = await apiClient.stopServoSweep();
      const success = result["success"] !== false;
      showToast(success ? "Sweep stopped" : "Failed to stop sweep", !success);
      if (success) {
        mutate({ success: true, running: false }, false);
      } else {
        mutate();
      }
    } catch (err) {
      const message = err instanceof ApiException ? err.message : "connection error";
      showToast(`Failed to stop sweep: ${message}`, true);
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
  // Editing a sweep already in progress would be ambiguous (which value
  // does the app apply, and when?) -- so the fields are locked while a
  // sweep is running; stop it first to change them.
  const fieldsEnabled = !running && !startInFlight && !stopInFlight;

  let label: string;
  if (startInFlight) label = "Sweep: Starting…";
  else if (stopInFlight) label = "Sweep: Stopping…";
  else if (statusError && isRunning === null) label = "Sweep: Unknown (status unavailable)";
  else if (unknown) label = "Sweep: Checking…";
  else label = running ? "Sweep: Running" : "Sweep: Stopped";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-base font-bold">Field of View Sweep</h1>
        <p className="mt-1 text-[12.5px] text-black/60">
          The pan servo cycles between two steps — moving to Step 1&apos;s angle and holding it, then
          Step 2&apos;s angle and holding it, repeating for as long as the sweep runs. For example: Step 1
          at 90° for 0.70s, then Step 2 at 140° for 0.90s.
        </p>
      </div>

      <Step
        title="Step 1"
        angle={angle1}
        seconds={seconds1}
        onAngle={setAngle1}
        onSeconds={setSeconds1}
        angleHint="e.g. 90"
        secondsHint="e.g. 0.70"
        angleError={errors.angle1}
        secondsError={errors.seconds1}
        enabled={fieldsEnabled}
      />
      <Step
        title="Step 2"
        angle={angle2}
        seconds={seconds2}
        onAngle={setAngle2}
        onSeconds={setSeconds2}
        angleHint="e.g. 140"
        secondsHint="e.g. 0.90"
        angleError={errors.angle2}
        secondsError={errors.seconds2}
        enabled={fieldsEnabled}
      />

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
          onClick={startSweep}
          disabled={startInFlight || running}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startInFlight ? <Spinner /> : "▶"}
          Start Sweep
        </button>
        <button
          onClick={stopSweep}
          disabled={stopInFlight || !running}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {stopInFlight ? <Spinner /> : "■"}
          Stop Sweep
        </button>
      </div>
    </div>
  );
}

function Step({
  title,
  angle,
  seconds,
  onAngle,
  onSeconds,
  angleHint,
  secondsHint,
  angleError,
  secondsError,
  enabled,
}: {
  title: string;
  angle: string;
  seconds: string;
  onAngle: (v: string) => void;
  onSeconds: (v: string) => void;
  angleHint: string;
  secondsHint: string;
  angleError?: string;
  secondsError?: string;
  enabled: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-black/70">{title}</p>
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="number"
            value={angle}
            disabled={!enabled}
            onChange={(e) => onAngle(e.target.value)}
            placeholder={angleHint}
            className="w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-accent disabled:bg-black/5 disabled:text-black/40"
          />
          <span className="mt-1 block text-[11px] text-black/40">Angle (0-180), {angleHint}</span>
          {angleError && <p className="mt-1 text-xs text-red-600">{angleError}</p>}
        </div>
        <div className="flex-1">
          <input
            type="number"
            value={seconds}
            disabled={!enabled}
            onChange={(e) => onSeconds(e.target.value)}
            placeholder={secondsHint}
            className="w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-accent disabled:bg-black/5 disabled:text-black/40"
          />
          <span className="mt-1 block text-[11px] text-black/40">Hold (sec), {secondsHint}</span>
          {secondsError && <p className="mt-1 text-xs text-red-600">{secondsError}</p>}
        </div>
      </div>
    </div>
  );
}
