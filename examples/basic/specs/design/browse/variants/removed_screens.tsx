import type { ComponentProps } from "react";

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
} from "../../parts/shell.js";
import type { ScreenSubject } from "../../parts/subjects.js";
import {
  REPARENTED_REMOVED_VARIANT_ROWS,
  REMOVED_VARIANT_ROWS,
} from "../../parts/variant_nav_data.js";

import { VARIANT_CRUMBS } from "./screens.js";

/** A removed variant under the parent it had, with its previous render. */
function RemovedVariant({
  design,
  nodes,
  subject,
  viewport,
}: {
  design: ComponentProps<typeof Shell>["design"];
  nodes: ComponentProps<typeof NavTree>["nodes"];
  subject: ScreenSubject;
  viewport: ArtboardViewport;
}) {
  return (
    <Shell
      design={design}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeLabel="Save failed · Removed"
            changedCount={1}
            changedOnly
            nodes={nodes}
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
            subject={subject}
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

const removed = {
  design: DESTINATIONS.variantRemoved,
  nodes: REMOVED_VARIANT_ROWS,
  subject: "welcomeError",
} as const;
const reparented = {
  design: DESTINATIONS.variantReparented,
  nodes: REPARENTED_REMOVED_VARIANT_ROWS,
  subject: "welcomeErrorReparented",
} as const;

export const variantRemovedScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A deleted variant retained as a Removed row under its surviving parent.",
  ...artboards({
    desktop: <RemovedVariant {...removed} viewport="desktop" />,
    mobile: <RemovedVariant {...removed} viewport="mobile" />,
  }),
  slug: "variant-removed",
  rationale:
    "A removed variant follows the removed-screen rules: it is hidden from All, shown in Changes under the parent it belonged to, and has no current preview. Its recorded details stay available so a reviewer can see what was deleted, and All returns to the parent rather than to catalogue home because the parent still exists.",
  title: "Removed variant",
});
export const variantReparentedScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A removed variant kept as a flat Changes row because its former parent is now another screen's variant.",
  ...artboards({
    desktop: <RemovedVariant {...reparented} viewport="desktop" />,
    mobile: <RemovedVariant {...reparented} viewport="mobile" />,
  }),
  slug: "variant-reparented",
  rationale:
    "A current variant cannot own its own variant list. When the former parent id is reused as a variant, only the historical child changes: Changes hides the unmodified parent and its variant and shows the child once as a flat Removed row.",
  title: "Removed variant after reparenting",
});
