import type {
  DepictedView,
  PreviewRegions,
} from "../../parts/depicted_view.js";
import { MiniAction } from "../../parts/mini_action.js";
import { MiniToolbar } from "../../parts/mini_toolbar.js";

import { componentFrames, type CanvasFrameSpec } from "./frames.js";
import { TOOLBAR_INSTANCES } from "./instance_records.js";
import { instanceLabel } from "./instances.js";

/** The nominal size of the Action's component document. */
const ACTION_DOCUMENT = { width: 320, height: 132 } as const;

/**
 * The nominal size of the Toolbar's component document: the Toolbar 24px
 * from each edge, its two Actions side by side, narrow enough that a phone
 * shows both frames of the set at half size.
 */
const TOOLBAR_DOCUMENT = { width: 340, height: 144 } as const;

/** The Action's variant set: Default, Disabled, and Secondary. */
export function actionFrames() {
  return componentFrames(
    [
      {
        slug: "default",
        title: "Default",
        render: () => <MiniAction variant="default" />,
      },
      {
        slug: "disabled",
        title: "Disabled",
        render: () => <MiniAction variant="disabled" />,
      },
      {
        slug: "secondary",
        title: "Secondary",
        render: () => <MiniAction variant="secondary" />,
      },
    ],
    ACTION_DOCUMENT,
  );
}

/** The frame of a variant set that the reader selected, by its id. */
export function frameOf(
  frames: readonly CanvasFrameSpec[],
  id: string,
): CanvasFrameSpec {
  const frame = frames.find((candidate) => candidate.id === id);
  if (frame === undefined) throw new Error(`The set has no frame ${id}.`);
  return frame;
}

/** The Toolbar's variant set: Default, its one saved variant. */
export function toolbarFrames() {
  return componentFrames(
    [{ slug: "default", title: "Default", render: () => <MiniToolbar /> }],
    TOOLBAR_DOCUMENT,
  );
}

/** The Toolbar's two Actions, as the highlight marks them on each frame. */
const TOOLBAR_REGIONS: PreviewRegions = [
  {
    box: TOOLBAR_INSTANCES.primary.box,
    label: instanceLabel(TOOLBAR_INSTANCES.primary),
  },
  {
    box: TOOLBAR_INSTANCES.secondary.box,
    label: instanceLabel(TOOLBAR_INSTANCES.secondary),
  },
];

/**
 * The Toolbar's depicted view: it renders two registered Actions, so the
 * shell can highlight it, and each frame of its set marks them. A component
 * document has no viewport, so both records hold the same regions.
 */
export const TOOLBAR_VIEW: DepictedView = {
  highlight: "available",
  regions: { desktop: TOOLBAR_REGIONS, mobile: TOOLBAR_REGIONS },
};
