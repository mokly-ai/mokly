import type { TimingEvent } from "../../src/diagnostics/timings.js";

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

export function classificationMeasurement(
  records: readonly ReceivedTiming[],
  expectedStatus?: "ok" | "error",
): {
  classificationMs: number;
  inlineStyleAnalysisMs: number;
  inlineStyleAnalysisShare: number;
  cssAnalysisMs: number;
  cssAnalysisShare: number;
};

export interface ClassificationEvidence {
  classificationStatus?: "ok" | "error" | "incomplete";
  classificationMs?: number;
  inlineStyleAnalysisMs?: number;
  inlineStyleAnalysisShare?: number;
  cssAnalysisMs?: number;
  cssAnalysisShare?: number;
  inlineStyleAnalysisLowerBoundMs?: number;
  cssAnalysisLowerBoundMs?: number;
  classificationUpperBoundMs?: number;
  classificationWaitUntilStopMs?: number;
  heapPeakMiB?: number;
  documentWork?: Readonly<Record<string, number>>;
  inlineStyleCounts?: Readonly<Record<string, number>>;
  comparisonCounts?: Readonly<Record<string, number>>;
}
export function classificationEvidence(
  records: readonly ReceivedTiming[],
  stopRequestedMs?: number,
): ClassificationEvidence;
