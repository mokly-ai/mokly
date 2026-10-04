/** Exclusive synchronous work and heap observations scoped to a comparison loop. */
import { getHeapStatistics } from "node:v8";

import { ComponentComparisonCounts } from "../review/component_comparison_counts.js";

export type DocumentWorkField =
  | "htmlParseMs"
  | "rangeMs"
  | "styleDiscoveryMs"
  | "referenceMs"
  | "matchingMs"
  | "normalizationMs"
  | "projectionMs"
  | "implementationMs"
  | "inlineRuleMs"
  | "hashMs";
export type HtmlParseStep =
  | "pageAnalysis"
  | "range"
  | "styleDiscovery"
  | "reference"
  | "inlineMatching"
  | "stylesheetMatching"
  | "resourceReference"
  | "resourceMatching"
  | "legacyStylesheetMatching"
  | "legacyResourceMatching";

const fields: readonly DocumentWorkField[] = [
  "htmlParseMs",
  "rangeMs",
  "styleDiscoveryMs",
  "referenceMs",
  "matchingMs",
  "normalizationMs",
  "projectionMs",
  "implementationMs",
  "inlineRuleMs",
  "hashMs",
];

export class DocumentWork {
  readonly inlineStyles = {
    elements: 0,
    segments: 0,
    segmentHits: 0,
    segmentParses: 0,
    fallbacks: 0,
  };
  private readonly counts: Record<string, number> = {
    htmlParses: 0,
    htmlParseBytes: 0,
    materialBytes: 0,
    materialNormalizationBytes: 0,
    sourceNormalizationBytes: 0,
    materialHashBytes: 0,
    inlineFingerprintBytes: 0,
    inlineFingerprintHashes: 0,
    fingerprintedViews: 0,
    fingerprintSeams: 0,
    fingerprintSeamUnits: 0,
    ...Object.fromEntries(fields.map((field) => [field, 0])),
  };
  private readonly stack: { nested: number }[] = [];
  private heapPeak = 0;
  private readonly paths = new ComponentComparisonCounts();
  private resourceReference = false;
  private materialScope = false;

  constructor(
    private readonly clock: () => number,
    private readonly heapSample: () => number = () =>
      getHeapStatistics().used_heap_size,
  ) {}

  measure<T>(field: DocumentWorkField, operation: () => T): T {
    const frame = { nested: 0 };
    const start = this.clock();
    this.stack.push(frame);
    try {
      return operation();
    } finally {
      const duration = this.clock() - start;
      this.stack.pop();
      this.counts[field]! += Math.max(0, duration - frame.nested);
      const parent = this.stack.at(-1);
      if (parent) parent.nested += duration;
    }
  }

  parse<T>(step: HtmlParseStep, source: string, operation: () => T): T {
    if (step === "reference" && this.resourceReference)
      step = "resourceReference";
    const bytes = Buffer.byteLength(source, "utf8");
    this.counts.htmlParses! += 1;
    this.counts.htmlParseBytes! += bytes;
    for (const [prefix, value] of [
      ["htmlParses", 1],
      ["htmlParseBytes", bytes],
    ] as const) {
      const key = `${prefix}.${step}`;
      this.counts[key] = (this.counts[key] ?? 0) + value;
    }
    return this.measure("htmlParseMs", operation);
  }

  resourceReferences<T>(operation: () => T): T {
    const previous = this.resourceReference;
    this.resourceReference = true;
    try {
      return operation();
    } finally {
      this.resourceReference = previous;
    }
  }

  material<T>(operation: () => T): T {
    const previous = this.materialScope;
    this.materialScope = true;
    try {
      return operation();
    } finally {
      this.materialScope = previous;
    }
  }

  materials(sources: readonly string[]): void {
    for (const source of sources)
      this.counts.materialBytes! += Buffer.byteLength(source, "utf8");
  }

  normalization(source: string): void {
    const field = this.materialScope
      ? "materialNormalizationBytes"
      : "sourceNormalizationBytes";
    this.counts[field]! += Buffer.byteLength(source, "utf8");
  }

  materialHash(source: string): void {
    this.counts.materialHashBytes! += Buffer.byteLength(source, "utf8");
  }

  inlineFingerprint(source: string): void {
    this.counts.inlineFingerprintBytes! += Buffer.byteLength(source, "utf8");
    this.counts.inlineFingerprintHashes!++;
  }

  fingerprintedView(): void {
    this.counts.fingerprintedViews!++;
  }

  fingerprintSeam(units: number): void {
    this.counts.fingerprintSeams!++;
    this.counts.fingerprintSeamUnits! += units;
  }

  comparedView(path: "fast" | "style" | "complete"): void {
    this.paths.addPath(path);
    this.heapPeak = Math.max(this.heapPeak, this.heapSample());
  }

  comparisonCounts(): Readonly<Record<string, number>> {
    return {
      ...this.paths.record(),
      heapPeakMiB: round(this.heapPeak / 1024 ** 2),
    };
  }

  record(): Readonly<Record<string, number>> {
    return Object.fromEntries(
      Object.entries(this.counts).map(([key, value]) => [
        key,
        fields.includes(key as DocumentWorkField) ? round(value) : value,
      ]),
    );
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
