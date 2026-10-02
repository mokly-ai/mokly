/** View-local lazy analyses, shared across quick-check fall-through. */
import type { GeneratedComponentView } from "@mokly/viewer/data";

import { normalizeReviewPair } from "./ignore.js";
import { PageAnalysis } from "./page_analysis.js";

export class PageAnalysisPair {
  private base?: PageAnalysis;
  private head?: PageAnalysis;
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
      : normalizeReviewPair(this.baseText, this.headText, this.after.path)
          .pairedIgnoreIds;
  }
}
