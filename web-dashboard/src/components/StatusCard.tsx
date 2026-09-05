/**
 * Shared status pill used by both the Detector page and the Settings
 * (servo sweep) page -- mirrors `_buildStatusCard()` from detector_tab.dart
 * and settings_page.dart, which are otherwise identical.
 */
export function StatusCard({
  label,
  dotColor,
  pid,
  running,
}: {
  label: string;
  dotColor: "grey" | "green";
  pid: string | null;
  running: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/15 p-4">
      <span
        className={`h-3.5 w-3.5 rounded-full ${dotColor === "green" ? "bg-green-500" : "bg-gray-400"}`}
      />
      <span className="flex-1 text-base font-semibold">{label}</span>
      {pid && running && <span className="text-xs text-black/50">PID {pid}</span>}
    </div>
  );
}

export function Spinner({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-white/40 border-t-white ${className}`} />;
}
