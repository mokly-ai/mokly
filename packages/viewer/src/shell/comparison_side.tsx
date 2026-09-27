/** Side by side: one chrome per version, their viewports mirrored. */

import type { ViewReview } from "../review/types.js";

import {
  ChromeScheme,
  type ComparisonChrome,
  type PaneDocument,
} from "./comparison_chrome.js";
import { ComparisonFrame } from "./comparison_frame.js";
import type { ComparisonScrollSync } from "./comparison_scroll_sync.js";
import { ComparisonViewport } from "./comparison_viewport.js";

const labels = { after: "Current", before: "Before" } as const;

const missing = {
  after: "This screen was removed on this branch.",
  before: "This screen was added on this branch.",
} as const;

/**
 * Each version keeps its own chrome and viewport. Both viewports share the
 * section's scroll owner, so their ranges match and scrolling either moves
 * the other; a side without a document keeps its explicit message.
 */
export function SideBySideComparison({
  chrome,
  documents,
  sync,
  view,
}: {
  chrome: ComparisonChrome;
  documents: {
    after?: PaneDocument | undefined;
    before?: PaneDocument | undefined;
  };
  sync: ComparisonScrollSync;
  view: ViewReview;
}) {
  return (
    <div className="mb-panes" data-compare-mode="side">
      {(["before", "after"] as const).map((side) => {
        const document = documents[side];
        return (
          <div className={`mb-pane mb-pane--${side}`} key={side}>
            <p className="mb-pane-label">{labels[side]}</p>
            {document ? (
              <ChromeScheme view={view}>
                {chrome(
                  <ComparisonViewport sync={sync}>
                    <ComparisonFrame {...document} />
                  </ComparisonViewport>,
                )}
              </ChromeScheme>
            ) : (
              <p className="mb-pane-missing">{missing[side]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
