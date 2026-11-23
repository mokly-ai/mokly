/**
 * The compare modes of a screen's or a component's Changes tab, under the
 * [screen controls](../../../../docs/protocol/mokly-changes-controls.md#screen-controls):
 * a workspace that offers its compare, as a variant set does while a shown
 * row compares, offers every mode, a shown status of Added offers Current
 * alone, and the other views offer none, a removed screen's included. While
 * Changes is the selected tab, the mode keys select an offered mode. This
 * container reads the workspace's compare and the Scroll together choice;
 * `@mokly/ui/compare-modes` draws the tiles, the frame chips of Side by side,
 * the switch and Refresh.
 */

import type { ReactNode } from "react";

import {
  COMPARE_MODES,
  CompareModes,
  type CompareFrame,
  type CompareMode,
} from "@mokly/ui/compare-modes";

import { useCompareModeKeys } from "./compare_mode_keys.js";
import type { ComparisonFramePlan } from "./comparison_rows.js";
import { useScrollTogether } from "./use_scroll_together.js";
import type { EntryStatus } from "./view_status.js";
import type { WorkspaceComparison } from "./workspace_comparison.js";

/** Every mode in the order of its key, from Current (1) to Swipe (5). */
const EVERY_MODE: readonly CompareMode[] = COMPARE_MODES.map(([mode]) => mode);

const CURRENT_ALONE: readonly CompareMode[] = ["current"];

const NO_MODE: readonly CompareMode[] = [];

/** What decides the compare modes that an entry offers. */
interface ModeOffer {
  /**
   * Whether the workspace offers its compare modes, as a variant set does
   * while a shown row compares.
   */
  eligible: boolean;
  /** Whether the entry is a removed screen, which shows its previous version. */
  removedScreen: boolean;
  /** The status that the shown views give. */
  status: EntryStatus | undefined;
}

/**
 * The modes that an entry offers, in the order of their keys: every mode
 * while its workspace offers the compare, Current alone for a shown status of
 * Added, and none for any other view or for a removed screen.
 */
export function offeredModes({
  eligible,
  removedScreen,
  status,
}: ModeOffer): readonly CompareMode[] {
  if (removedScreen) return NO_MODE;
  if (eligible) return EVERY_MODE;
  return status === "Added" ? CURRENT_ALONE : NO_MODE;
}

/**
 * The chip of each shown frame whose row compares, in the canvas's order, or
 * of each view of a removed component or variant, which passes no compared
 * frames: the frame's own name, such as `Desktop · Light`, and its kind.
 */
export function compareFrames(
  plans: ReadonlyMap<
    string,
    Pick<ComparisonFramePlan, "key" | "kind" | "name">
  >,
  compared: readonly { key: string }[] | undefined,
): CompareFrame[] {
  const keys = compared && new Set(compared.map(({ key }) => key));
  return [...plans.values()]
    .filter((plan) => !keys || keys.has(plan.key))
    .map((plan) => ({ key: plan.key, kind: plan.kind, label: plan.name }));
}

/**
 * The compare modes of the Changes tab, or nothing for an entry that offers
 * none, and their keys while `selected`, which Changes is while it is the
 * selected tab.
 */
export function useCompareModes({
  compare,
  selected,
  ...offer
}: ModeOffer & {
  compare: WorkspaceComparison;
  selected: boolean;
}): ReactNode {
  const together = useScrollTogether();
  const { controller } = compare;
  const offered = offeredModes(offer);
  useCompareModeKeys({
    enabled: selected && offered.length > 0,
    modes: EVERY_MODE,
    offered,
    onMode: controller.selectMode,
  });
  if (!offered.length) return undefined;
  return (
    <CompareModes
      comparable={offered.length === EVERY_MODE.length}
      frame={controller.comparedFrame}
      frames={compareFrames(compare.canvas.plans, compare.compared)}
      // Any compared row's generation can be renewed, also when the routed
      // row does not compare.
      loaded={(controller.generations?.size ?? 0) > 0}
      mode={controller.mode}
      onFrame={controller.setComparedFrame}
      onMode={controller.selectMode}
      onRefresh={controller.refresh}
      onTogether={together.set}
      together={together.on}
    />
  );
}
