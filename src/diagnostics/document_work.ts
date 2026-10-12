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
  | "linkNormalization"
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
    ...Object.fromEntries(fields.map((field) => [field, 0])),
  };
  private readonly stack: { nested: number }[] = [];
  private heapPeak = 0;
  private readonly paths = new ComponentComparisonCounts();
  private resourceReference = false;

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
