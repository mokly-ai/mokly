/** Timing counts for component-view comparison paths. */

import type { ComparedComponentView } from "./component_view.js";

/** Accumulate stable fast- and complete-path totals for diagnostics. */
export class ComponentComparisonCounts {
  private views = 0;
  private fastPath = 0;
  private completePath = 0;

  add(results: readonly ComparedComponentView[]): void {
    this.views += results.length;
    for (const result of results) {
      if (result.comparisonPath === "fast") this.fastPath += 1;
      else this.completePath += 1;
    }
  }

  record(): { views: number; fastPath: number; completePath: number } {
    return {
      views: this.views,
      fastPath: this.fastPath,
      completePath: this.completePath,
    };
  }
}
