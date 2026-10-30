/**
 * Side by side: one chrome per version, their viewports mirrored.
 * `@mokly/ui/comparison-stage` draws the grid and `@mokly/ui/comparison-pane`
 * each labelled pane.
 */

import { ComparisonPane } from "@mokly/ui/comparison-pane";
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
import type { EntryWording } from "./entry_wording.js";

/** The design catalogue's copy for a side without a document. */
const missing = {
  after: "This screen has been removed.",
  before: "This screen did not exist before.",
} as const;

/**
 * Each version keeps its own chrome and viewport. Both viewports share the
 * section's scroll owner, so their ranges match and scrolling either moves
 * the other; a side without a document keeps its explicit message, worded
 * for the entry's kind like the pane heading.
 */
export function SideBySideComparison({
  chrome,
  documents,
  sync,
  view,
  wording,
}: {
  chrome: ComparisonChrome;
  documents: {
    after?: PaneDocument | undefined;
    before?: PaneDocument | undefined;
  };
  sync: ComparisonScrollSync;
  view: ReviewView;
  wording: Pick<EntryWording, "label">;
}) {
  return (
    <ComparisonPanes mode="side">
      {(["before", "after"] as const).map((side) => {
        const document = documents[side];
        return (
          <ComparisonPane
            key={side}
            missing={document ? undefined : wording.label(missing[side])}
            side={side}
          >
            {document ? (
              <ChromeScheme view={view}>
                {chrome(
                  <ComparisonViewport sync={sync}>
                    <ComparisonFrame {...document} />
                  </ComparisonViewport>,
                )}
              </ChromeScheme>
            ) : null}
          </ComparisonPane>
        );
      })}
    </ComparisonPanes>
  );
}
