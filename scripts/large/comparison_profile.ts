/** CSS interval unions stay within one core classification and clock. */
import type { TimingRecord } from "./timings.js";

function union(intervals: [number, number][]) {
  let total = 0,
    end = -Infinity;
  for (const [first, last] of intervals.sort((a, b) => a[0] - b[0])) {
    total += Math.max(0, last - Math.max(first, end));
    end = Math.max(end, last);
  }
  return total;
}

export function comparisonProfile(records: readonly TimingRecord[]) {
  const events = records.map((record) => record.event);
  return events
    .filter(
      (event) =>
        event.role === "core" &&
        event.stage === "changes.classify" &&
        event.event === "end",
    )
    .map((event) => {
      const duration =
        typeof event.durationMs === "number" ? event.durationMs : 0;
      const last = typeof event.elapsedMs === "number" ? event.elapsedMs : 0;
      const first = last - duration;
      const related = events.filter(
        (other) =>
          other.pid === event.pid &&
          other.session === event.session &&
          other.role === "core",
      );
      const intervals: [number, number][] = related.flatMap((other) => {
        if (
          other.stage !== "review.css-analysis" ||
          other.event !== "end" ||
          typeof other.elapsedMs !== "number" ||
          typeof other.durationMs !== "number"
        )
          return [];
        const start = Math.max(first, other.elapsedMs - other.durationMs);
        const end = Math.min(last, other.elapsedMs);
        return end > start ? [[start, end]] : [];
      });
      const cssMs = union(intervals);
      return {
        session: event.session,
        pid: event.pid,
        id: event.id,
        status: event.status,
        durationMs: duration,
        cssMs,
        cssShare: duration > 0 ? cssMs / duration : null,
      };
    });
}
