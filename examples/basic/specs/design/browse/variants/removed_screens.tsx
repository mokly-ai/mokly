import { defineScreen } from "@mokly/mokly";

import { PreviewWorkspace } from "../../components/parts/workspace.js";
import { designMetadata } from "../../metadata.js";
import { artboards } from "../../parts/artboards.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { DetailsPanel } from "../../parts/details.js";
import { ENTRY_PATHS } from "../../parts/entry_paths.js";
import { NavTree } from "../../parts/nav.js";
import { reasonEvidence } from "../../parts/reason_sentences.js";
import { PreviousVersionStage } from "../../parts/removed_preview.js";
import { RemovedView } from "../../parts/removed_screen.js";
import { MiniSaveFailed } from "../../parts/removed_shots.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
  type Crumb,
} from "../../parts/shell.js";
import { REMOVED_VARIANT_ROWS } from "../../parts/variant_nav_data.js";

/**
 * A variant keeps its parent's breadcrumbs and ends in the parent's title.
 * A removed variant keeps every crumb as text.
 */
const VARIANT_CRUMBS: readonly Crumb[] = ["Example", "Screens", "Welcome"];

/** A removed variant under the parent it had, with its previous render. */
function RemovedVariant({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.variantRemoved}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeLabel="Save failed · Removed"
            changedCount={1}
            changedOnly
            nodes={REMOVED_VARIANT_ROWS}
          />
        ) : null
      }
    >
      <PreviewWorkspace
        header={
          <ScreenHead
            action={<ViewSwitch active={viewport} />}
            crumbs={VARIANT_CRUMBS}
            path={ENTRY_PATHS.welcomeError}
            status="removed"
            title="Save failed"
          />
        }
        // A removed screen has no current preview to inspect.
        view={{ highlight: "removed" }}
        viewport={viewport}
        inspector={
          <DetailsPanel
            comparisonEvidence={{ reasons: reasonEvidence(["removed"]) }}
            open
            subject="welcomeError"
          />
        }
        render={(previewViewport) => (
          <RemovedView
            address="example.test/welcome"
            compact={viewport === "mobile"}
            viewport={previewViewport}
          >
            <MiniSaveFailed compact={previewViewport === "mobile"} />
          </RemovedView>
        )}
        wrap={(previews) => (
          <PreviousVersionStage
            entry={{
              kind: "screen",
              path: ENTRY_PATHS.welcomeError,
              title: "Save failed",
            }}
            viewport="both"
          >
            {previews}
          </PreviousVersionStage>
        )}
      />
    </Shell>
  );
}

/**
 * A removed variant's previous version. It stays until decision 34 settles
 * how the Canvas family shows a removed entry's previous version.
 */
export const variantRemovedScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A deleted variant retained as a Removed row under its surviving parent.",
  ...artboards({
    desktop: <RemovedVariant viewport="desktop" />,
    mobile: <RemovedVariant viewport="mobile" />,
  }),
  slug: "variant-removed",
  rationale:
    "A removed variant follows the removed-screen rules: it is hidden from All, shown in Changes under the parent it belonged to, and has no current preview. Its recorded details stay available so a reviewer can see what was deleted, and All returns to the parent rather than to catalogue home because the parent still exists.",
  title: "Removed variant",
});
