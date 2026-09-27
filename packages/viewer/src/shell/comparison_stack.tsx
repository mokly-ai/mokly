/** Overlay and Difference: both versions stacked inside one chrome. */

import type { ViewReview } from "../review/types.js";

import {
  ChromeScheme,
  type ComparisonChrome,
  type PaneDocument,
} from "./comparison_chrome.js";
import { ComparisonFrame } from "./comparison_frame.js";
import type { ComparisonScrollSync } from "./comparison_scroll_sync.js";
import { ComparisonViewport } from "./comparison_viewport.js";

/**
 * One chrome whose viewport holds the Before layer and, above it, the Current
 * layer at half opacity in Overlay or difference-blended in Difference. The
 * chrome itself is never blended, and both layers always share one offset.
 */
export function StackedComparison({
  after,
  before,
  chrome,
  mode,
  sync,
  view,
}: {
  after: PaneDocument;
  before: PaneDocument;
  chrome: ComparisonChrome;
  mode: "difference" | "overlay";
  sync: ComparisonScrollSync;
  view: ViewReview;
}) {
  return (
    <div className="mb-panes" data-compare-mode={mode}>
      <ChromeScheme view={view}>
        {chrome(
          <ComparisonViewport sync={sync}>
            <div className="mb-pane mb-pane--before">
              <ComparisonFrame {...before} />
            </div>
            <div className="mb-pane mb-pane--after">
              <ComparisonFrame {...after} />
            </div>
          </ComparisonViewport>,
        )}
      </ChromeScheme>
    </div>
  );
}
