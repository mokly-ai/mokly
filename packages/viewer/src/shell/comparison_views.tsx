/** React rendering for the aligned Before and Current comparison panes. */

import { useEffect, useState } from "react";

import { entryRoute, type ViewRouteKind } from "../navigation/routes.js";
import type { SnapshotPresentation } from "../previews/presentation.js";

import { comparisonChrome, type PaneDocument } from "./comparison_chrome.js";
import {
  createScrollOwner,
  type ComparisonSide,
  type ScrollOwner,
} from "./comparison_scroll_owner.js";
import { createComparisonScrollSync } from "./comparison_scroll_sync.js";
import type { SelectedComparisonView } from "./comparison_selection.js";
import { SideBySideComparison } from "./comparison_side.js";
import { StackedComparison } from "./comparison_stack.js";
import { entryWording } from "./entry_wording.js";
import type { ComparisonPresentation } from "./use_comparison.js";
import { isStyleOnlyView } from "./workspace_style_evidence.js";

const stateLabels = {
  added: "New screen",
  changed: "Screen changed",
  "ignored-only": "Only excluded content changed",
  removed: "Screen removed",
  unchanged: "No changes to this screen",
} as const;

interface SectionProps {
  entryId: string;
  entryKind: ViewRouteKind;
  /** The last-scrolled version, shared by every section of the comparison. */
  owner: ScrollOwner;
  presentation: ComparisonPresentation;
  presentations: ReadonlyMap<string, SnapshotPresentation>;
  selected: SelectedComparisonView;
  /** Whether Scroll together is on; switching it never reloads a pane. */
  together: boolean;
}

/**
 * Render every selected viewport section from its presented documents. The
 * sections of one shown comparison share its last-scrolled version.
 */
export function ComparisonViews({
  views,
  ...props
}: Omit<SectionProps, "owner" | "selected"> & {
  views: readonly SelectedComparisonView[] | undefined;
}) {
  const [owner] = useState(createScrollOwner);
  if (!views) return <p>This screen has no comparison available.</p>;
  return (
    <>
      {views.map((selected) => (
        <ComparisonSection
          key={selected.viewport}
          {...props}
          owner={owner}
          selected={selected}
        />
      ))}
    </>
  );
}

/** One viewport's heading and panes, owning the section's scroll offset. */
function ComparisonSection({
  entryId,
  entryKind,
  owner,
  presentation,
  presentations,
  selected,
  together,
}: SectionProps) {
  const [sync] = useState(() =>
    createComparisonScrollSync({ owner, together }),
  );
  useEffect(() => sync.setTogether(together), [sync, together]);
  const { documents, mode, view, viewport } = selected;
  const component = entryKind === "component";
  const wording = entryWording(component ? "component" : "screen");
  const label = isStyleOnlyView(view)
    ? "Styles this screen uses changed"
    : stateLabels[view.state];
  const pane = (side: ComparisonSide): PaneDocument | undefined => {
    const address = documents[side];
    const document = address ? presentations.get(address) : undefined;
    if (!document) return;
    return {
      presentation: document,
      side,
      title: `${side === "before" ? "Before" : "Current"} — ${view.viewport} — ${view.colorScheme}`,
    };
  };
  const before = pane("before");
  const after = pane("after");
  const chrome = comparisonChrome(component, viewport, entryRoute(entryId));
  return (
    <section
      className={`mbk-diff-view mbk-diff-${viewport}`}
      data-diff-viewport={viewport}
    >
      <h3>
        {viewport === "mobile" ? "Mobile" : "Desktop"} · {wording.label(label)}
        {presentation.requestedColorScheme !== view.colorScheme
          ? " · Light only"
          : ""}
      </h3>
      {mode !== "side" && before && after ? (
        <StackedComparison
          after={after}
          before={before}
          chrome={chrome}
          mode={mode}
          sync={sync}
          view={view}
        />
      ) : (
        <SideBySideComparison
          chrome={chrome}
          documents={{ after, before }}
          sync={sync}
          view={view}
        />
      )}
    </section>
  );
}
