/** View-local lazy analyses, shared across quick-check fall-through. */
import type { GeneratedComponentView } from "@mokly/viewer/data";

import type { PreparedInlineRules } from "./css/inline_preparation.js";
import { normalizeReviewPair, type NormalizedReviewPair } from "./ignore.js";
import { PageAnalysis } from "./page_analysis.js";

export class PageAnalysisPair {
  inlinePreparation?: PreparedInlineRules;
  private base?: PageAnalysis;
  private head?: PageAnalysis;
  private normalized?: NormalizedReviewPair;
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
    return this.baseText === this.headText
      ? this.afterAnalysis.regions.map(({ id }) => id).sort()
      : this.normalization.pairedIgnoreIds;
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
