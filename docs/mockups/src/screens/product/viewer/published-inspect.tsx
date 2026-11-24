import type { Viewport } from "@mokly/mokly";
import { frameSizeTag } from "@mokly/ui/canvas-frame";
import { ChangeStatus } from "@mokly/ui/change-status";
import type { ChangeStatusValue } from "@mokly/ui/change-status";
import { FramesFilter } from "@mokly/ui/frames-filter";
import type { FramesToggle } from "@mokly/ui/frames-filter";
import {
  InspectHead,
  InspectPanel,
  InspectSection,
  InspectVariants,
} from "@mokly/ui/inspect-panel";
import { InspectSelection } from "@mokly/ui/inspect-selection";
import { MetadataPath, MetadataRow } from "@mokly/ui/metadata-row";

import { staticNoop } from "../../../components/static-controls";
import {
  currentScreen,
  viewerCatalogue,
} from "../../../fixtures/viewer-catalogue";

import {
  changedViews,
  frameSizes,
  hasDark,
  screenFrames,
  screenSchemes,
} from "./published-frames";

/** A viewport's frame size as its toggle's note, such as `390 × 844`. */
function sizeNote(viewport: Viewport): string {
  const { width, height } = frameSizes[viewport];
  return frameSizeTag(width, height);
}

/**
 * The Frames filter's toggles, in the viewer's order, each checked because
 * the drawing shows every frame. A screen without a dark view disables Dark,
 * which reads `Light only`. A checked toggle hides no view, so none carries
 * a change mark.
 */
const toggles: readonly FramesToggle[] = [
  { checked: true, name: "mobile", note: sizeNote("mobile") },
  { checked: true, name: "desktop", note: sizeNote("desktop") },
  { checked: true, name: "light" },
  hasDark
    ? { checked: true, name: "dark" }
    : { checked: false, disabled: true, name: "dark", note: "Light only" },
];

/**
 * Inspect for the current screen, in the order of the viewer's sections,
 * with the facts that the fixture holds: the head with the title, the status
 * of the shown frames, the path, the schemes and the changed views; the
 * Variants list, which holds the screen alone; the Frames section with its
 * count and the Frames filter; and the Selection section with nothing
 * selected. The Highlight components switch starts off. The fixture holds
 * no source file, props or usage, so the drawing draws none of them.
 */
export function PublishedInspect({ status }: { status: ChangeStatusValue }) {
  return (
    <InspectPanel>
      <InspectHead
        status={<ChangeStatus mark="data-workspace-status" status={status} />}
        title={currentScreen.title}
      >
        <MetadataRow label="Path" mark="data-inspect-path">
          <MetadataPath
            segments={currentScreen.path.split("/").map((text) => ({ text }))}
          />
        </MetadataRow>
        {viewerCatalogue.hasDarkViews ? (
          <MetadataRow label="Schemes">{screenSchemes}</MetadataRow>
        ) : null}
        <MetadataRow hidden={changedViews === ""} label="Changed views">
          {changedViews}
        </MetadataRow>
      </InspectHead>
      <InspectVariants
        variants={[
          {
            current: true,
            key: currentScreen.path,
            label: currentScreen.title,
            path: currentScreen.path,
          },
        ]}
      />
      <InspectSection count={screenFrames.length} label="Frames" name="frames">
        <FramesFilter
          descriptionId="mkc-frames-highlight"
          highlight={{ active: false, available: true }}
          onHighlight={staticNoop}
          onToggle={staticNoop}
          toggles={toggles}
        />
      </InspectSection>
      <InspectSelection selection={{ kind: "none" }} />
    </InspectPanel>
  );
}
