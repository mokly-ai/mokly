/**
 * What a workspace shows of its canvas selection: the selection over its
 * frame, a variant set's selectable frame names, the empty canvas that
 * clears it, Inspect's Selection section and Components section, the
 * variant set's chosen row, the Frames filter's changes, and the pill above
 * the compact layout's dock. A selection from the component tree also
 * scrolls the frame's document to the instance.
 */

import { useCallback, useMemo, useState } from "react";

import type { FramesToggleName } from "@mokly/ui/frames-filter";
import type { PanelTab } from "@mokly/ui/panel-tabs";
import { SelectionPill } from "@mokly/ui/selection-pill";

import type { GeneratedComponentView } from "../components/views.js";

import {
  componentFrameSize,
  DESKTOP_FRAME_SIZE,
  MOBILE_FRAME_SIZE,
  type CanvasFrameSize,
} from "./canvas_frame_size.js";
import { framesViews, type CanvasFramePlan } from "./canvas_frames.js";
import { sessionFrame } from "./canvas_selection_frames.js";
import type { WorkspaceCanvas } from "./canvas_workspace.js";
import { frameInstanceRef } from "./frame_instances.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameSession,
} from "./frame_registry.js";
import { toggledFrames } from "./frames_filter.js";
import { useInstanceBoxModel } from "./instance_box_model.js";
import {
  pillDetails,
  selectedInstanceRecord,
  selectionDetails,
} from "./selection_details.js";
import { selectionOverlay } from "./selection_overlay.js";
import { useShellStore } from "./store_context.js";
import type { WorkspaceCanvasSelection } from "./use_canvas_selection.js";
import type { WorkspaceData } from "./workspace_data.js";

/** The nominal size of a frame, by its kind and its measured size. */
function nominalSize(
  plan: CanvasFramePlan | undefined,
  measured: Readonly<Record<string, CanvasFrameSize>>,
): CanvasFrameSize {
  if (plan?.kind === "desktop") return DESKTOP_FRAME_SIZE;
  if (plan?.kind === "mobile") return MOBILE_FRAME_SIZE;
  return (plan && measured[plan.key]) ?? componentFrameSize();
}

export function useWorkspaceSelection({
  data,
  frames,
  onPick,
  picks,
  previewViews,
  tab,
  wide,
}: {
  data: WorkspaceData;
  /** The frames of the canvas, with the edit's renders. */
  frames: readonly CanvasFramePlan[];
  /** Pick a frame in the compact layout, as its frame picker does. */
  onPick(frame: CanvasFramePlan): void;
  picks: WorkspaceCanvasSelection;
  previewViews: readonly GeneratedComponentView[];
  tab: PanelTab;
  wide: boolean;
}) {
  const store = useShellStore();
  const registry = useOptionalShellFrameRegistry();
  const [measured, setMeasured] = useState<
    Readonly<Record<string, CanvasFrameSize>>
  >({});
  const selected = picks.state.selected;
  const inspecting = tab === "inspect";
  const set = data.entry.kind === "component";
  const plan = frames.find((frame) => frame.key === selected?.frame);
  const session = selected ? picks.sessions.get(selected.frame) : undefined;
  const reading = useInstanceBoxModel(
    registry,
    session,
    selected?.kind === "instance" ? selected.key : undefined,
  );
  const record = selectedInstanceRecord(selected, frames, previewViews);
  const name = record
    ? (data.components.find(
        (component) => component.path === record.instance.componentId,
      )?.title ?? record.instance.componentId)
    : undefined;
  const details = selectionDetails({
    data,
    frameSize: (key) =>
      nominalSize(
        frames.find((frame) => frame.key === key),
        measured,
      ),
    plans: frames,
    reading,
    record,
    selected,
    sourceOf: (path) => store.catalogue.byPath.get(path)?.details.sourcePath,
  });
  // A frame of a set selects in place on the wide canvas, and in the
  // compact layout it is the frame that the picker shows.
  const chooseFrame = useCallback(
    (frame: CanvasFramePlan) => {
      if (wide) picks.selectFrame(frame.key);
      else onPick(frame);
    },
    [onPick, picks, wide],
  );
  const reveal = (frame: string, key: string) => {
    const target = picks.sessions.get(frame);
    const instance = target ? frameInstanceRef(target, key) : undefined;
    if (target && instance && registry)
      void registry.inspection
        .scrollToInstance(instance, [target])
        .catch(() => undefined);
  };
  const tree =
    plan ?? frames.find((frame) => !frame.hidden && frame.view !== undefined);
  const canvas: Pick<
    WorkspaceCanvas,
    "onEmptyClick" | "onFrameSelect" | "onFrameSize" | "overlay"
  > = {
    onEmptyClick: inspecting ? picks.clear : undefined,
    onFrameSelect: set && inspecting ? chooseFrame : undefined,
    onFrameSize: (key, size) =>
      setMeasured((current) =>
        current[key]?.width === size.width &&
        current[key].height === size.height
          ? current
          : { ...current, [key]: size },
      ),
    overlay: inspecting
      ? (frame, size) =>
          selectionOverlay({ name, plan: frame, reading, selected, size })
      : undefined,
  };
  const pill = pillDetails(details, reading);
  return {
    canvas,
    details,
    instances: {
      frame: tree,
      focus: (key: string) => {
        if (tree) picks.selectInstance(tree.key, key, false);
      },
      select: (key: string) => {
        if (!tree) return;
        picks.selectInstance(tree.key, key, true);
        reveal(tree.key, key);
      },
      selectedKey: selected?.kind === "instance" ? selected.key : undefined,
      view: tree
        ? framesViews(previewViews, [{ ...tree, hidden: false }])[0]
        : undefined,
    },
    pill:
      !wide && inspecting && pill && store.state.sheet === undefined ? (
        <SelectionPill
          {...pill}
          onOpen={() => {
            store.setSheet("panel");
            picks.reveal();
          }}
        />
      ) : null,
    selectLabel: (labelled: ShellFrameSession, key: string) => {
      const frame = sessionFrame(picks.sessions, labelled);
      if (frame) picks.selectInstance(frame, key, true);
    },
    set: {
      chosen: plan?.variantPath,
      choose: (path: string) => {
        const light = frames.find(
          (frame) => frame.variantPath === path && frame.scheme === "light",
        );
        if (light) chooseFrame(light);
      },
    },
    shown: useMemo(
      () => framesViews(previewViews, frames),
      [frames, previewViews],
    ),
    toggleFrames: (name: FramesToggleName, checked: boolean) =>
      store.setFrames(toggledFrames(store.state.frames, name, checked)),
  };
}
