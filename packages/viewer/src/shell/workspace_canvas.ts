/**
 * The canvas of a screen's or a component's workspace: its frames, the name
 * that fits the canvas again, and the compact layout's frame picker. In the
 * wide layout a screen's viewport choice keeps one column. In the compact
 * layout the canvas shows the picked frame alone, and the picker sets the
 * selection's viewport and scheme, or opens the saved variant of the picked
 * row of a variant set. The frames carry no edit's views: the shown frames
 * name the edit's contexts, and the workspace adds their renders.
 */

import { useMemo } from "react";

import type { EntryBarPicker } from "@mokly/ui/entry-bar";

import { isComponentVariant } from "../catalogue/variants.js";
import { viewHref } from "../navigation/routes.js";

import {
  compactFrames,
  pickedScreenFrame,
  pickedSetFrame,
  pickerFrames,
} from "./canvas_compact.js";
import { workspaceFrames, type CanvasFramePlan } from "./canvas_frames.js";
import { useCanvasLayout } from "./canvas_layout.js";
import { useShellStore, type ShellStore } from "./store_context.js";
import type { WorkspaceData } from "./workspace_data.js";

/** What the workspace's canvas shows. */
export interface WorkspaceCanvasFrames {
  /** Names the shown frames; a new name fits the canvas again. */
  fitKey: string;
  frames: readonly CanvasFramePlan[];
  /** The compact layout's frame picker, while one frame stands for the entry. */
  picker: EntryBarPicker | undefined;
}

/**
 * Pick a frame: a screen frame names the selection's viewport and scheme,
 * and a variant set's frame names the scheme and opens its row's entry.
 */
function pick(
  store: ShellStore,
  frames: readonly CanvasFramePlan[],
  key: string,
  routedPath: string,
): void {
  const frame = frames.find((plan) => plan.key === key);
  if (!frame) return;
  if (frame.kind !== "component") {
    store.select({ colorScheme: frame.scheme, viewport: frame.viewport });
    return;
  }
  store.select({ colorScheme: frame.scheme });
  if (frame.variantPath && frame.variantPath !== routedPath)
    store.navigateFrame(viewHref(frame.variantPath));
}

export function useWorkspaceCanvas(data: WorkspaceData): WorkspaceCanvasFrames {
  const store = useShellStore();
  const wide = useCanvasLayout();
  const { colorScheme, viewport } = store.state.selection;
  const entry = data.entry;
  // The workspace merges each new detail into its data in place, so the
  // frames follow the entry and the set's rows, whose views carry the usage.
  const all = useMemo(
    () => workspaceFrames(data, wide ? viewport : "both"),
    [data, data.entry, data.variants, viewport, wide],
  );
  const picked = wide
    ? undefined
    : entry.kind === "screen"
      ? pickedScreenFrame(all, { colorScheme, viewport })
      : pickedSetFrame(
          all,
          isComponentVariant(entry) ? entry.path : undefined,
          colorScheme,
        );
  const frames = useMemo(
    () => (wide ? all : compactFrames(all, picked)),
    [all, picked, wide],
  );
  const owner =
    entry.kind === "screen" ? entry.path : (data.component?.path ?? entry.path);
  if (wide)
    return {
      fitKey: entry.kind === "screen" ? `${owner}:${viewport}` : owner,
      frames,
      picker: undefined,
    };
  return {
    fitKey: `${owner}:${picked ?? "set"}`,
    frames,
    picker:
      picked === undefined
        ? undefined
        : {
            frames: pickerFrames(all),
            onChange: (key) => pick(store, all, key, entry.path),
            value: picked,
          },
  };
}
