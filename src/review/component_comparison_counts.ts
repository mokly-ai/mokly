/** Timing counts for component-view comparison paths. */

import type { ComparedComponentView } from "./component_view_types.js";

/** Accumulate stable fast- and complete-path totals for diagnostics. */
export class ComponentComparisonCounts {
  private views = 0;
  private fastPath = 0;
  private completePath = 0;
  private stylePath = 0;

  add(results: readonly ComparedComponentView[]): void {
    for (const result of results) this.addPath(result.comparisonPath);
  }

  addPath(path: ComparedComponentView["comparisonPath"]): void {
    this.views += 1;
    if (path === "fast") this.fastPath += 1;
    else if (path === "style") this.stylePath += 1;
    else this.completePath += 1;
  }

  record(): {
    views: number;
    fastPath: number;
    stylePath: number;
    completePath: number;
  } {
    return {
      views: this.views,
      fastPath: this.fastPath,
      completePath: this.completePath,
      stylePath: this.stylePath,
    };
  }
}
