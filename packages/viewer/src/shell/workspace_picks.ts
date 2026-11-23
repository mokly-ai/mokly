/**
 * A workspace's canvas and its canvas selection together: the selection
 * decides a variant set's picked frame in the compact layout, and the
 * canvas's frames decide what the selection follows. A routed saved
 * variant's frame is selected from the first render. In the compact layout
 * the selection's scheme names the picked frame, so a set's selected frame
 * moves to its row's frame of that scheme. On a variant set, the row of the
 * selected frame is the row that Props edits; a routed removed variant has
 * no frame on the set, so its own row is the chosen row.
 */

import { useEffect } from "react";

import { isComponentVariant } from "../catalogue/variants.js";

import type { CanvasFramePlan } from "./canvas_frames.js";
import { useCanvasLayout } from "./canvas_layout.js";
import { schemeFrame } from "./canvas_selection_frames.js";
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
  // A compact pick of a frame of the routed row selects that frame, and the
  // selection names it. A pick of another row opens that row's entry, whose
  // route then selects its frame, so a controlled host's proposal stays
  // inert until the host commits it.
  const onPick = (frame: CanvasFramePlan) => {
    if (frame.kind === "component" && frame.variantPath === entry.path)
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
  const scheme = store.state.selection.colorScheme;
  const selectedFrame =
    picked.selected?.kind === "frame" ? picked.selected.frame : undefined;
  useEffect(() => {
    if (wide || !set) return;
    const next = schemeFrame(canvas.frames, selectedFrame, scheme);
    if (next && selectedFrame)
      dispatch({ type: "follow", from: selectedFrame, frame: next });
  }, [canvas.frames, scheme, selectedFrame, set, wide]);
  const chosen = canvas.frames.find(
    (frame) => frame.key === picked.selected?.frame,
  );
  const removed = data.variants.find(
    (row) => savedVariant && row.removed && row.value.path === entry.path,
  );
  const chosenRow: WorkspaceVariant | undefined = set
    ? chosen
      ? data.variants.find((row) => row.value.path === chosen.variantPath)
      : removed
    : undefined;
  return { canvas, chosenRow, onPick, picks, wide };
}
