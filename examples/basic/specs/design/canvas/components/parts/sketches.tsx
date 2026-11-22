import type { ReactNode } from "react";

import { ComparisonPane } from "../../../../../../../packages/ui/src/comparison-pane/comparison-pane.js";
import type { FrameCompare } from "../../../library/canvas/frame_compare.js";
import { DesignInstances } from "../../../library/composition.js";
import {
  MiniAction,
  type MiniActionVariant,
} from "../../../parts/mini_action.js";
import { MiniDetails, MiniWelcome } from "../../../parts/mini_screens.js";
import {
  componentFrames,
  screenFrames,
  sideBySideFrames,
  type CanvasFrameSpec,
} from "../../parts/frames.js";
import { ACTION_DOCUMENT, actionFrames } from "../../parts/set_sketches.js";

import { COMPACT_SAVED } from "./props.js";

/**
 * The zoom in percent of a variant set's compared pair on a phone, where
 * both versions of the picked frame stand next to each other.
 */
export const PAIR_PHONE_FIT = 54;

/**
 * The version before the Action branch: the Action's button with its
 * earlier, smaller corner radius and narrower padding, wherever it renders.
 */
function Before({ children }: { children: ReactNode }) {
  return <div className="cv-cx-before">{children}</div>;
}

/** The Action's saved variants, as their frames name them by slug. */
const ACTION_VARIANTS = [
  "default",
  "disabled",
  "secondary",
] as const satisfies readonly MiniActionVariant[];

/** The saved variant that a frame of the Action's set shows. */
function actionVariant(slug: string | undefined): MiniActionVariant {
  const variant = ACTION_VARIANTS.find((candidate) => candidate === slug);
  if (variant === undefined)
    throw new Error(`The Action has no saved variant ${slug}.`);
  return variant;
}

/** A frame's version before the Action branch: its saved variant, earlier. */
function actionBefore(frame: CanvasFrameSpec): ReactNode {
  return (
    <Before>
      <MiniAction variant={actionVariant(frame.variant)} />
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
 * to every frame: each frame holds the version before under the current
 * version. Both versions share the frame's size.
 */
export function actionCompareFrames(compare: FrameCompare): CanvasFrameSpec[] {
  return actionFrames().map((frame) => ({
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
function sidePairs(
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
 * The Action's variant set on the Action branch in Side by side: every
 * saved variant changed, so each frame has its pair.
 */
export function actionSideFrames(): CanvasFrameSpec[] {
  return sidePairs(actionFrames(), actionBefore);
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
 * The removed Compact's frames, at the size of its siblings' documents,
 * which hold its missing current version.
 */
export function compactFrames(): CanvasFrameSpec[] {
  return componentFrames(
    [{ slug: "compact", title: "Compact", render: () => <RemovedVersion /> }],
    ACTION_DOCUMENT,
  );
}

/**
 * The Action's variant set on the removal branch: its current saved
 * variants, then the removed Compact after them.
 */
export function removedSetFrames(): CanvasFrameSpec[] {
  return [...actionFrames(), ...compactFrames()];
}

/**
 * The removed Compact as the branch point rendered it, from its saved
 * props: the Action's button with its 4px corners and no hint.
 */
function CompactBefore() {
  return (
    <div className="mbk-shot mbk-shot--action">
      <div className="mbk-shot-pad">
        <span
          className={`mbk-shot-action mbk-shot-action--${COMPACT_SAVED.tone} cv-cx-compact`}
        >
          {COMPACT_SAVED.label}
        </span>
      </div>
    </div>
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
