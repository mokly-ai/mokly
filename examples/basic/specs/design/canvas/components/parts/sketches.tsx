import type { ReactNode } from "react";

import { ComparisonPane } from "../../../../../../../packages/ui/src/comparison-pane/comparison-pane.js";
import type { FrameCompare } from "../../../library/canvas/frame_compare.js";
import { DesignInstances } from "../../../library/composition.js";
import { MiniAction, MiniActionDocument } from "../../../parts/mini_action.js";
import { MiniDetails, MiniWelcome } from "../../../parts/mini_screens.js";
import {
  componentFrames,
  screenFrames,
  sideBySideFrames,
  type CanvasFrameSpec,
} from "../../parts/frames.js";
import {
  COMPONENT_DOCUMENTS,
  actionSetFrames,
  actionVariantOf,
} from "../../parts/set_sketches.js";

import { COMPACT_SAVED } from "./props.js";

/**
 * The zooms in percent that fit a compared frame's pair in Side by side, in
 * the way that `SET_FITS` fits a set: on the stage of a desktop, and on a
 * phone, where both versions of the picked frame stand 24px apart. Default ·
 * Light's pair takes Default's width, and Compact · Light's the narrower
 * width of its only version.
 */
export const PAIR_FITS = {
  default: { zoom: 100, phone: 72 },
  compact: { zoom: 100, phone: 100 },
} as const;

/**
 * The version before the Action branch: the Action's button with its
 * earlier, smaller corner radius and narrower padding, wherever it renders.
 */
export function Before({ children }: { children: ReactNode }) {
  return <div className="cv-cx-before">{children}</div>;
}

/**
 * A frame's version before the Action branch: its own example or its saved
 * variant, earlier.
 */
function actionBefore(frame: CanvasFrameSpec): ReactNode {
  return (
    <Before>
      <MiniAction variant={actionVariantOf(frame)} />
    </Before>
  );
}

/** A frame's version before, in an instance scope of its own. */
function beforeOf(
  frame: CanvasFrameSpec,
  render: (frame: CanvasFrameSpec) => ReactNode,
) {
  return (
    <DesignInstances name={`${frame.id}-before`}>
      {render(frame)}
    </DesignInstances>
  );
}

/**
 * The Action's variant set on the Action branch in a comparison that applies
 * to every frame: the Action's render changed, so its own example compares
 * like its saved variants, and each frame holds the version before under
 * the current version. Both versions share the frame's size, the larger of
 * the two: the version before is narrower, so each frame keeps the size of
 * its current version.
 */
export function actionCompareFrames(compare: FrameCompare): CanvasFrameSpec[] {
  return actionSetFrames().map((frame) => ({
    ...frame,
    compare,
    before: beforeOf(frame, actionBefore),
  }));
}

/**
 * A variant set's frames in Side by side: each frame as a pair, the version
 * before beside the current version, both at the frame's size and named by
 * its saved variant and scheme. The stage shows the compared frame's pair.
 */
export function sidePairs(
  frames: readonly CanvasFrameSpec[],
  before: (frame: CanvasFrameSpec) => ReactNode,
): CanvasFrameSpec[] {
  return frames.flatMap((frame) => [
    {
      ...frame,
      id: `${frame.id}-before`,
      side: "before" as const,
      content: beforeOf(frame, before),
    },
    { ...frame, id: `${frame.id}-after`, side: "after" as const },
  ]);
}

/**
 * The Action's variant set on the Action branch in Side by side: its own
 * example and every saved variant changed, so each frame has its pair.
 */
export function actionSideFrames(): CanvasFrameSpec[] {
  return sidePairs(actionSetFrames(), actionBefore);
}

/**
 * A removed saved variant's frame: a removed component entry has no
 * preview, so the frame holds the shipped pane of a version without a
 * document, with its explicit message, in place of a document.
 */
function RemovedVersion() {
  return (
    <div className="cv-cx-missing">
      <ComparisonPane missing="This variant has been removed." side="after" />
    </div>
  );
}

/**
 * The removed Compact's frames, which hold its missing current version. Its
 * only version, the version before, renders the Action's button labelled
 * Continue without a hint, so the frames take the size of that document,
 * the own example's.
 */
export function compactFrames(): CanvasFrameSpec[] {
  return componentFrames([
    {
      slug: "compact",
      title: "Compact",
      size: COMPONENT_DOCUMENTS.action,
      render: () => <RemovedVersion />,
    },
  ]);
}

/**
 * The Action's variant set on the removal branch: its own example and its
 * current saved variants, then the removed Compact after them.
 */
export function removedSetFrames(): CanvasFrameSpec[] {
  return [...actionSetFrames(), ...compactFrames()];
}

/**
 * The Action's button as the removed Compact's saved props draw it in a
 * screen, with its 4px corners and no hint: a picture, which opens nothing.
 */
export function CompactAction() {
  return (
    <span
      className={`mbk-shot-action mbk-shot-action--${COMPACT_SAVED.tone} cv-cx-compact`}
    >
      {COMPACT_SAVED.label}
    </span>
  );
}

/**
 * The removed Compact's component document as the branch point rendered it,
 * from its saved props: the Action's button with its 4px corners and no
 * hint.
 */
function CompactBefore() {
  return (
    <MiniActionDocument
      label={COMPACT_SAVED.label}
      look={COMPACT_SAVED.tone}
      radius={COMPACT_SAVED.radius}
    />
  );
}

/**
 * The removed Compact in Side by side: in each of its frames, its version
 * before beside the explicit message of its missing current version. Only
 * Compact changed on the removal branch, so only its frames have a pair.
 */
export function removedSideFrames(): CanvasFrameSpec[] {
  return sidePairs(compactFrames(), () => <CompactBefore />);
}

/** A screen that the changed Action affects on the Action branch. */
export type AffectedScreen = "details" | "welcome";

/** One version of an affected screen, whose links stay inert. */
function affectedSketch(screen: AffectedScreen, compact: boolean) {
  return screen === "welcome" ? (
    <MiniWelcome compact={compact} inert />
  ) : (
    <MiniDetails compact={compact} inert />
  );
}

/**
 * An affected screen's frames in Side by side: each frame as a pair, the
 * version before, with the earlier Action, beside the current version. The
 * screen itself is unmodified, so only its Actions differ.
 */
export function affectedFrames(screen: AffectedScreen): CanvasFrameSpec[] {
  return sideBySideFrames((viewport, _scheme, version) => {
    const sketch = affectedSketch(screen, viewport === "mobile");
    return version === "before" ? <Before>{sketch}</Before> : sketch;
  });
}

/** The frames that the compact frame picker lists for a screen: its four. */
export function screenFramePicks(): CanvasFrameSpec[] {
  return screenFrames(() => null);
}
