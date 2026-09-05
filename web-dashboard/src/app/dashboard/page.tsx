"use client";

import { useState } from "react";

/**
 * URL of the Pi's existing MJPEG camera stream (from `pi_person_detector_cpu.py`).
 * Loaded directly by the browser -- does NOT go through the NestJS backend,
 * same as `cameraFeedUrl` in the Flutter app's camera_feed_tab.dart.
 * CONFIGURE ME: update the host if the Pi's LAN IP changes.
 */
const CAMERA_FEED_URL = "http://192.168.43.233:8080/";

export default function CameraFeedPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function retry() {
    setErrored(false);
    setLoaded(false);
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-base font-bold">Live Camera Feed</h1>

      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-black/15 bg-gray-100">
        {!errored && (
          // The browser's <img> tag natively handles a multipart/x-mixed-replace
          // MJPEG stream, same trick the Flutter app's MjpegView uses under the hood.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={reloadKey}
            src={CAMERA_FEED_URL}
            alt="Live camera feed"
            className="h-full w-full object-cover"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        )}

        {!loaded && !errored && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
          </div>
        )}

        {errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-black/60">
            <span className="text-sm">Camera feed unavailable</span>
            <button
              onClick={retry}
              className="rounded-full bg-black/5 px-4 py-1.5 text-xs font-medium text-accent hover:bg-black/10"
            >
              Retry
            </button>
          </div>
        )}

        <a
          href={CAMERA_FEED_URL}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 right-3 rounded-full bg-black/45 p-2 text-white hover:bg-black/60"
          title="Open full screen in a new tab"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
          </svg>
        </a>
      </div>
    </div>
  );
}
