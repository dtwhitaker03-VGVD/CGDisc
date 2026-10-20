/** Live clock text: m:ss, or h:mm:ss once past an hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Compact length of a finished round, e.g. "1h 24m" or "52m". */
export function formatDuration(totalSeconds: number): string {
  const mins = Math.max(0, Math.round(totalSeconds / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Running time in ms, excluding paused stretches (`pausedAt` is set while paused now). */
export function elapsedMs(startedAt: number, pausedAt: number | null, pausedMs: number, now: number) {
  return Math.max(0, (pausedAt ?? now) - startedAt - pausedMs);
}
