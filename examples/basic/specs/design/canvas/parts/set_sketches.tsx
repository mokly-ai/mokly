import {
  DepictedViewScope,
  type DepictedView,
  type HighlightRegion,
  type PreviewRegions,
} from "../../parts/depicted_view.js";
import { MiniAction, type MiniActionVariant } from "../../parts/mini_action.js";
import {
  MiniToolbar,
  TOOLBAR_ACTIONS_TOP,
  type MiniToolbarVariant,
} from "../../parts/mini_toolbar.js";

import { COMPONENT_IDENTITIES } from "./component_identity.js";
import { CANVAS_ENTRIES } from "./entries.js";
import { componentFrames, type CanvasFrameSpec } from "./frames.js";
import {
  TOOLBAR_INSTANCES,
  type ToolbarInstanceId,
} from "./instance_records.js";
import { instanceLabel } from "./instances.js";

/**
 * The size of each component document that a variant set's frames hold, as
 * the built example measures it in its desktop view, in CSS pixels: the
 * Action's own example and its three saved variants, and the Toolbar's own
 * example and its saved variant Default. Light and dark measure the same.
 */
export const COMPONENT_DOCUMENTS = {
  action: { width: 147.73, height: 86 },
  actionDefault: { width: 234.3, height: 113.5 },
  actionDisabled: { width: 147.73, height: 86 },
  actionSecondary: { width: 140.56, height: 86 },
  toolbar: { width: 400.73, height: 155 },
  toolbarDefault: { width: 400.73, height: 196 },
} as const;

/**
 * The rows of the Action's variant set: its own example first, named by the
 * component's title, then its saved variants in their authored order, each
 * with the sketch that its frames draw and its document's size.
 */
const ACTION_ROWS = [
  {
    slug: CANVAS_ENTRIES.action.slug,
    title: COMPONENT_IDENTITIES.action.title,
    variant: "own",
    size: COMPONENT_DOCUMENTS.action,
  },
  {
    slug: "default",
    title: "Default",
    variant: "default",
    size: COMPONENT_DOCUMENTS.actionDefault,
  },
  {
    slug: "disabled",
    title: "Disabled",
    variant: "disabled",
    size: COMPONENT_DOCUMENTS.actionDisabled,
  },
  {
    slug: "secondary",
    title: "Secondary",
    variant: "secondary",
    size: COMPONENT_DOCUMENTS.actionSecondary,
  },
] as const satisfies readonly {
  slug: string;
  title: string;
  variant: MiniActionVariant;
  size: { width: number; height: number };
}[];

/**
 * The Action's variant set: a row for its own example, then one row for
 * each saved variant, Default, Disabled, and Secondary, each frame at its
 * document's measured size.
 */
export function actionSetFrames(): CanvasFrameSpec[] {
  return componentFrames(
    ACTION_ROWS.map(({ variant, ...row }) => ({
      ...row,
      render: () => <MiniAction variant={variant} />,
    })),
  );
}

/** The sketch of the Action that a frame of its set draws, by its row. */
export function actionVariantOf(frame: CanvasFrameSpec): MiniActionVariant {
  const row = ACTION_ROWS.find((candidate) => candidate.slug === frame.variant);
  if (row === undefined)
    throw new Error(`The Action's set has no row ${frame.variant}.`);
  return row.variant;
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

/**
 * The Toolbar's two Actions on a frame of one of its examples, as the
 * highlight marks them: at their selection boxes on the own example's
 * frame, on the row where that example's document draws them.
 */
function toolbarRegions(variant: MiniToolbarVariant): PreviewRegions {
  const region = (id: ToolbarInstanceId): HighlightRegion => ({
    box: { ...TOOLBAR_INSTANCES[id].box, y: TOOLBAR_ACTIONS_TOP[variant] },
    label: instanceLabel(TOOLBAR_INSTANCES[id]),
  });
  return [region("primary"), region("secondary")];
}

/**
 * The depicted view of one of the Toolbar's documents: it renders two
 * registered Actions, so the shell can highlight it. A component document
 * has no viewport, so both records hold the same regions.
 */
function toolbarView(variant: MiniToolbarVariant): DepictedView {
  const regions = toolbarRegions(variant);
  return {
    highlight: "available",
    regions: { desktop: regions, mobile: regions },
  };
}

/**
 * The Toolbar's variant set as the shell highlights it. Each frame marks
 * the Actions where its own document draws them, so the set's record holds
 * the regions of its first row, the own example.
 */
export const TOOLBAR_VIEW = toolbarView("own");

/** One row of the Toolbar's set: its sketch, with its document's regions. */
function toolbarRow(
  slug: string,
  title: string,
  variant: MiniToolbarVariant,
  size: { width: number; height: number },
) {
  return {
    slug,
    title,
    size,
    render: () => (
      <DepictedViewScope view={toolbarView(variant)}>
        <MiniToolbar variant={variant} />
      </DepictedViewScope>
    ),
  };
}

/**
 * The Toolbar's variant set: a row for its own example, which renders
 * without slot content, then a row for Default, its one saved variant, which
 * fills the slot, each frame at its document's measured size.
 */
export function toolbarSetFrames(): CanvasFrameSpec[] {
  return componentFrames([
    toolbarRow(
      CANVAS_ENTRIES.toolbar.slug,
      COMPONENT_IDENTITIES.toolbar.title,
      "own",
      COMPONENT_DOCUMENTS.toolbar,
    ),
    toolbarRow(
      "default",
      "Default",
      "default",
      COMPONENT_DOCUMENTS.toolbarDefault,
    ),
  ]);
}
