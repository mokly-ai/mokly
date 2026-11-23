/**
 * The canvas of a screen's or a component's workspace: its frames, the name
 * that fits the canvas again, and the compact layout's frame picker. The
 * Frames filter chooses a screen's shown viewports and schemes, and a
 * variant set's shown schemes. In the compact layout the canvas shows the
 * picked frame alone, and the picker lists the shown frames: a screen's
 * pick sets the selection's viewport and scheme, and a variant set's pick
 * selects its frame and opens its row's entry in its scheme, as one
 * selection change. The frames carry no edit's views: the shown frames name
 * the edit's contexts, and the workspace adds their renders.
 */

import { useMemo } from "react";

import type { EntryBarPicker } from "@mokly/ui/entry-bar";

import {
  compactFrames,
  pickedScreenFrame,
  pickerFrames,
} from "./canvas_compact.js";
import {
  hasDarkView,
  workspaceFrames,
  type CanvasFramePlan,
  type CanvasShown,
} from "./canvas_frames.js";
import { useCanvasLayout } from "./canvas_layout.js";
import type { CanvasSelected } from "./canvas_selection.js";
import { shownSchemes, shownViewports } from "./frames_filter.js";
import { useShellStore, type ShellStore } from "./store_context.js";
import type { WorkspaceData } from "./workspace_data.js";

/** What the workspace's canvas shows. */
export interface WorkspaceCanvasFrames {
  /** Names the shown frames; a new name fits the canvas again. */
  fitKey: string;
  frames: readonly CanvasFramePlan[];
  /** Whether a frame of the entry has a dark view. */
  hasDark: boolean;
  /** The compact layout's frame picker, while one frame stands for the entry. */
  picker: EntryBarPicker | undefined;
  /** The number of frames that the Frames filter shows. */
  shownCount: number;
}

/**
 * Pick a frame: a screen frame names the selection's viewport and scheme,
 * and a variant set's frame names the scheme and opens its row's entry.
 * Each pick is one selection change, so a controlled host hears one
 * proposal.
 */
export function pickFrame(
  store: ShellStore,
  frame: CanvasFramePlan,
  routedPath: string,
): void {
  if (frame.kind !== "component") {
    store.select({ colorScheme: frame.scheme, viewport: frame.viewport });
    return;
  }
  if (frame.variantPath && frame.variantPath !== routedPath)
    store.openEntry(frame.variantPath, { colorScheme: frame.scheme });
  else store.select({ colorScheme: frame.scheme });
}

/**
 * The frames of an entry that the Frames filter shows, and whether the
 * entry has a dark view at all.
 */
function canvasShown(
  data: WorkspaceData,
  store: ShellStore,
): { hasDark: boolean; shown: CanvasShown } {
  const choice = store.state.frames;
  const set = data.entry.kind === "component";
  const hasDark = hasDarkView(
    set ? data.variants.map(({ value }) => value) : [data.entry],
  );
  return {
    hasDark,
    shown: {
      schemes: shownSchemes(choice, hasDark),
      viewports: set ? ["desktop"] : shownViewports(choice),
    },
  };
}

export function useWorkspaceCanvas(
  data: WorkspaceData,
  selected: CanvasSelected | undefined,
  onPick: (frame: CanvasFramePlan) => void,
): WorkspaceCanvasFrames {
  const store = useShellStore();
  const wide = useCanvasLayout();
  const { colorScheme, viewport } = store.state.selection;
  const entry = data.entry;
  const set = entry.kind === "component";
  const { hasDark, shown } = canvasShown(data, store);
  const shownKey = `${shown.viewports.join(",")}/${shown.schemes.join(",")}`;
  // The workspace merges each new detail into its data in place, so the
  // frames follow the entry and the set's rows, whose views carry the usage.
  const all = useMemo(
    () => workspaceFrames(data, shown),
    [data, data.entry, data.variants, shownKey],
  );
  const shownCount = all.filter((frame) => !frame.hidden).length;
  const picked = wide
    ? undefined
    : set
      ? all.find((frame) => frame.key === selected?.frame && !frame.hidden)?.key
      : pickedScreenFrame(all, { colorScheme, viewport });
  const frames = useMemo(
    () => (wide ? all : compactFrames(all, picked)),
    [all, picked, wide],
  );
  const owner =
    entry.kind === "screen" ? entry.path : (data.component?.path ?? entry.path);
  if (wide)
    return {
      fitKey: `${owner}:${shownKey}`,
      frames,
      hasDark,
      picker: undefined,
      shownCount,
    };
  return {
    fitKey: `${owner}:${picked ?? "set"}`,
    frames,
    hasDark,
    picker:
      picked === undefined
        ? undefined
        : {
            frames: pickerFrames(all),
            onChange: (key) => {
              const frame = all.find((plan) => plan.key === key);
              if (frame) onPick(frame);
            },
            value: picked,
          },
    shownCount,
  };
}
