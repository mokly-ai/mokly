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

/**
 * The Action's variant set on the Action branch in a comparison that applies
 * to every frame: each frame holds the version before under the current
 * version. Both versions share the frame's size.
 */
export function actionCompareFrames(compare: FrameCompare): CanvasFrameSpec[] {
  return actionFrames().map((frame) => ({
    ...frame,
    compare,
    before: (
      <DesignInstances name={`${frame.id}-before`}>
        <Before>
          <MiniAction variant={actionVariant(frame.variant)} />
        </Before>
      </DesignInstances>
    ),
  }));
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
 * The Action's variant set on the removal branch: its current saved
 * variants, then the removed Compact after them, at the size of its
 * siblings' documents.
 */
export function removedSetFrames(): CanvasFrameSpec[] {
  return [
    ...actionFrames(),
    ...componentFrames(
      [{ slug: "compact", title: "Compact", render: () => <RemovedVersion /> }],
      ACTION_DOCUMENT,
    ),
  ];
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
