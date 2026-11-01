/**
 * Overlay and Difference: both versions stacked inside one chrome.
 * `@mokly/ui/comparison-stage` draws the grid and `@mokly/ui/comparison-pane`
 * each version's layer.
 */

import { ComparisonLayer } from "@mokly/ui/comparison-pane";
import { ComparisonPanes } from "@mokly/ui/comparison-stage";

import type { ReviewView } from "../review/types.js";

import {
  ChromeScheme,
  type ComparisonChrome,
  type PaneDocument,
} from "./comparison_chrome.js";
import { ComparisonFrame } from "./comparison_frame.js";
import type { ComparisonScrollSync } from "./comparison_scroll_types.js";
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
  view: ReviewView;
}) {
  return (
    <ComparisonPanes mode={mode}>
      <ChromeScheme view={view}>
        {chrome(
          <ComparisonViewport sync={sync}>
            <ComparisonLayer side="before">
              <ComparisonFrame {...before} />
            </ComparisonLayer>
            <ComparisonLayer side="after">
              <ComparisonFrame {...after} />
            </ComparisonLayer>
          </ComparisonViewport>,
        )}
      </ChromeScheme>
    </ComparisonPanes>
  );
}
