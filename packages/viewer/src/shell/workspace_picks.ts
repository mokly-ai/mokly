/**
 * A workspace's canvas and its canvas selection together: the selection
 * decides a variant set's picked frame in the compact layout, and the
 * canvas's frames decide what the selection follows. A routed saved
 * variant's frame is selected from the first render. On a variant set, the
 * row of the selected frame is the row that Props edits.
 */

import { isComponentVariant } from "../catalogue/variants.js";

import type { CanvasFramePlan } from "./canvas_frames.js";
import { useCanvasLayout } from "./canvas_layout.js";
import { useShellStore } from "./store_context.js";
import {
  useCanvasSelection,
  useCanvasSelectionState,
} from "./use_canvas_selection.js";
import { pickFrame, useWorkspaceCanvas } from "./workspace_canvas.js";
import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

export function useWorkspacePicks({
  data,
  entry,
  selecting,
}: {
  data: WorkspaceData;
  entry: WorkspaceData["entry"];
  /** Whether a click on a frame selects, as it does in Inspect. */
  selecting: boolean;
}) {
  const store = useShellStore();
  const wide = useCanvasLayout();
  const set = entry.kind === "component";
  const savedVariant = set && isComponentVariant(entry);
  const routedScheme = wide ? "light" : store.state.selection.colorScheme;
  const [picked, dispatch] = useCanvasSelectionState(
    savedVariant
      ? { kind: "frame", frame: `${entry.path}:${routedScheme}` }
      : undefined,
  );
  // A compact pick of a set's frame selects that frame, and the selection
  // names it.
  const onPick = (frame: CanvasFramePlan) => {
    if (frame.kind === "component")
      dispatch({
        type: "select",
        generation: undefined,
        selected: { kind: "frame", frame: frame.key },
        reveal: false,
      });
    pickFrame(store, frame, entry.path);
  };
  const canvas = useWorkspaceCanvas(data, picked.selected, onPick);
  const picks = useCanvasSelection({
    dispatch,
    plans: canvas.frames,
    routed: { path: entry.path, savedVariant, scheme: routedScheme },
    selecting,
    set,
    state: picked,
  });
  const chosen = canvas.frames.find(
    (frame) => frame.key === picked.selected?.frame,
  );
  const chosenRow: WorkspaceVariant | undefined = set
    ? data.variants.find((row) => row.value.path === chosen?.variantPath)
    : undefined;
  return { canvas, chosenRow, onPick, picks, wide };
}
