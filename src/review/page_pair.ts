/** View-local lazy analyses, shared across quick-check fall-through. */
import type { GeneratedComponentView } from "@mokly/viewer/data";

import type { PreparedInlineRules } from "./css/inline_preparation.js";
import {
  normalizeReviewPair,
  reviewIgnoreMetadata,
  type NormalizedReviewPair,
} from "./ignore.js";
import { PageAnalysis } from "./page_analysis.js";

export class PageAnalysisPair {
  inlinePreparation?: PreparedInlineRules;
  private base?: PageAnalysis;
  private head?: PageAnalysis;
  private normalized?: NormalizedReviewPair;
  private paired?: readonly string[];
  private exclusion?: (path: string) => boolean;
  constructor(
    readonly before: GeneratedComponentView,
    readonly after: GeneratedComponentView,
    readonly baseText: string,
    readonly headText: string,
  ) {}

  get beforeAnalysis(): PageAnalysis {
    return (this.base ??= new PageAnalysis(
      this.baseText,
      this.before.path,
      this.before.usage,
    ));
  }
  get afterAnalysis(): PageAnalysis {
    return (this.head ??= new PageAnalysis(
      this.headText,
      this.after.path,
      this.after.usage,
    ));
  }
  get pairedIgnoreIds(): readonly string[] {
    if (this.normalized) return this.normalized.pairedIgnoreIds;
    if (this.paired) return this.paired;
    if (this.baseText === this.headText)
      return (this.paired = this.afterAnalysis.regions
        .map(({ id }) => id)
        .sort());
    const before =
      this.base ?? reviewIgnoreMetadata(this.baseText, this.after.path);
    const after = this.afterAnalysis;
    const headIds = new Set(after.regions.map(({ id }) => id));
    return (this.paired = before.regions
      .filter(
        ({ id }) =>
          headIds.has(id) &&
          before.materialIds.has(id) === after.materialIds.has(id),
      )
      .map(({ id }) => id)
      .sort());
  }

  get normalization(): NormalizedReviewPair {
    return (this.normalized ??= normalizeReviewPair(
      this.baseText,
      this.headText,
      this.after.path,
    ));
  }

  normalize(base: string, head: string): NormalizedReviewPair {
    return base === this.baseText && head === this.headText
      ? this.normalization
      : normalizeReviewPair(base, head, this.after.path);
  }

  resourceExclusion(
    create: () => (path: string) => boolean,
  ): (path: string) => boolean {
    return (this.exclusion ??= create());
  }
}
