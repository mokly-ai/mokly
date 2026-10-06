import type { TimingEvent } from "../../packages/mokly/src/diagnostics/timings.js";

export interface ReceivedTiming {
  event: TimingEvent;
  receivedMs: number;
}

export function timingCollector(now?: () => number): {
  records: ReceivedTiming[];
  accept(chunk: string | Uint8Array): void;
};

export function baselineMeasurement(
  records: readonly ReceivedTiming[],
  beginning: number,
  cacheHit: boolean,
): {
  cacheHit: boolean;
  baselineMs: number;
  baselineReadyMs: number;
  preparingToPendingMs: number;
  baselinePhases: { stage: string; durationMs: number }[];
};
