import type { ArtboardViewport } from "../../parts/shell.js";

import { ComponentDetails } from "./component_details.js";
import { ComponentLayout } from "./component_layout.js";
import { VariantPicker } from "./controls.js";
import { COMPONENT_PAGES } from "./destinations.js";
import { COMPONENT_ENTRY_BY_STATE } from "./metadata.js";
import { REMOVED_VARIANT_KEY } from "./navigation_tree.js";
import { ComponentComparison } from "./preview.js";

/**
 * The removed Compact variant's page: it keeps its Before canvas in Side by
 * side, and its Usage links the removed screen that used it. The owning
 * screen exports both artboards.
 */
export function ComponentPage({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <ComponentLayout
      design={COMPONENT_PAGES.removed}
      entry={COMPONENT_ENTRY_BY_STATE.removed}
      navigationKey={REMOVED_VARIANT_KEY}
      mode="side-by-side"
      status="removed"
      viewport={viewport}
      variants={<VariantPicker />}
      inspector={<ComponentDetails state="removed" />}
    >
      {(previewViewport) => (
        <ComponentComparison
          mode="side-by-side"
          state="removed"
          subject="action"
          viewport={previewViewport}
        />
      )}
    </ComponentLayout>
  );
}
