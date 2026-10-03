"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiClient, ApiException, type ServoMove } from "@/lib/api-client";
import { Spinner } from "@/components/StatusCard";

type Toast = { message: string; isError: boolean } | null;

const POSITION_KEY = "servo-position";

/**
 * Manual pan/tilt and laser control -- the web version of agromech_birdguard's
 * test_03b_servo.py (arrow keys move the servos, space recenters) and
 * test_04_laser.py (o/f switch the laser). Mirrors settings_tab.dart: each
 * button press is one fixed backend move, and the backend returns the new
 * { pan, tilt } angles after every move.
 */
export default function SettingsPage() {
  // The move currently waiting on the Pi, or null. Only one move runs at a
  // time -- each one starts from the previous one's result -- so every servo
  // button is disabled while one is in flight.
  const [moveInFlight, setMoveInFlight] = useState<ServoMove | null>(null);
  const [laserOnInFlight, setLaserOnInFlight] = useState(false);
  const [laserOffInFlight, setLaserOffInFlight] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Fetched once on mount; after that each move's response carries the new
  // angles, so there's nothing to poll.
  const { data: position, mutate } = useSWR(POSITION_KEY, () => apiClient.getServoPosition(), {
    revalidateOnFocus: false,
  });

  function showToast(message: string, isError = false) {
    setToast({ message, isError });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function move(target: ServoMove, failureLabel: string) {
    setMoveInFlight(target);
    try {
      const result = await apiClient.moveServo(target);
      mutate(result, false);
      if (result["success"] === false) {
        showToast(`Failed to ${failureLabel}: ${String(result["error"] ?? "unknown error")}`, true);
      }
    } catch (err) {
      const message = err instanceof ApiException ? err.message : "connection error";
      showToast(`Failed to ${failureLabel}: ${message}`, true);
    } finally {
      setMoveInFlight(null);
    }
  }

  async function laser(on: boolean) {
    const setInFlight = on ? setLaserOnInFlight : setLaserOffInFlight;
    const action = on ? "turn laser on" : "turn laser off";
    setInFlight(true);
    try {
      const result = await (on ? apiClient.laserOn() : apiClient.laserOff());
      const success = result["success"] !== false;
      showToast(success ? (on ? "Laser on" : "Laser off") : `Failed to ${action}`, !success);
    } catch (err) {
      const message = err instanceof ApiException ? err.message : "connection error";
      showToast(`Failed to ${action}: ${message}`, true);
    } finally {
      setInFlight(false);
    }
  }

  const pan = typeof position?.["pan"] === "number" ? Math.round(position["pan"]) : null;
  const tilt = typeof position?.["tilt"] === "number" ? Math.round(position["tilt"]) : null;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12.5px] text-black/60">
        Stop the detector before moving the servos by hand — it moves them itself while tracking.
      </p>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Pan" angle={pan} range="0-180°" />
        <div className="flex gap-3">
          <MoveButton
            label="Left"
            icon="←"
            busy={moveInFlight === "pan/left"}
            disabled={moveInFlight !== null}
            onClick={() => move("pan/left", "pan left")}
          />
          <MoveButton
            label="Right"
            icon="→"
            busy={moveInFlight === "pan/right"}
            disabled={moveInFlight !== null}
            onClick={() => move("pan/right", "pan right")}
          />
        </div>
      </section>

      <hr className="border-black/10" />

      <section className="flex flex-col gap-4">
        <SectionHeader title="Tilt" angle={tilt} range="40-140°" />
        <div className="flex gap-3">
          <MoveButton
            label="Up"
            icon="↑"
            busy={moveInFlight === "tilt/up"}
            disabled={moveInFlight !== null}
            onClick={() => move("tilt/up", "tilt up")}
          />
          <MoveButton
            label="Down"
            icon="↓"
            busy={moveInFlight === "tilt/down"}
            disabled={moveInFlight !== null}
            onClick={() => move("tilt/down", "tilt down")}
          />
        </div>
        <div className="flex">
          <MoveButton
            label="Recenter"
            icon="⊙"
            busy={moveInFlight === "tilt/recenter"}
            disabled={moveInFlight !== null}
            onClick={() => move("tilt/recenter", "recenter")}
          />
        </div>
      </section>

      <hr className="border-black/10" />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold">Laser</h2>
        <div className="flex gap-3">
          <button
            onClick={() => laser(true)}
            disabled={laserOnInFlight}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {laserOnInFlight ? <Spinner /> : <span aria-hidden>⚡</span>}
            On
          </button>
          <button
            onClick={() => laser(false)}
            disabled={laserOffInFlight}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {laserOffInFlight ? <Spinner /> : <span aria-hidden>■</span>}
            Off
          </button>
        </div>
      </section>

      {toast && (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm text-white ${toast.isError ? "bg-red-500" : "bg-green-600"}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, angle, range }: { title: string; angle: number | null; range: string }) {
  return (
    <div className="flex items-baseline">
      <h2 className="flex-1 text-base font-bold">{title}</h2>
      <span className="text-[13px] text-black/50">
        {angle === null ? "—" : `${angle}°`} ({range})
      </span>
    </div>
  );
}

function MoveButton({
  label,
  icon,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Spinner /> : <span aria-hidden>{icon}</span>}
      {label}
    </button>
  );
}
