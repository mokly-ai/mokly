/**
 * The parts of the compare on the canvas that outlive a render: one scroll
 * controller for each compared frame, which share the comparison's
 * last-scrolled version, Swipe's divider, which every frame draws at one
 * place and which opens in the middle, and the measured sizes of component
 * frames, measured once for each pair of documents.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SWIPE_START } from "@mokly/ui/swipe-divider";

import {
  DESKTOP_FRAME_SIZE,
  MOBILE_FRAME_SIZE,
  type CanvasFrameSize,
} from "./canvas_frame_size.js";
import type { CanvasCompareMode } from "./comparison_canvas_state.js";
import {
  comparedComponentSize,
  type MeasuredVersions,
} from "./comparison_frame_size.js";
import {
  createScrollOwner,
  type ComparisonSide,
} from "./comparison_scroll_owner.js";
import { createComparisonScrollSync } from "./comparison_scroll_sync.js";
import type { ComparisonScrollSync } from "./comparison_scroll_types.js";
import type { ComparedFrame } from "./comparison_selection.js";

/**
 * One scroll controller for each name, created on first use, all sharing
 * one last-scrolled version, with Scroll together applied to each at once.
 */
export function useComparisonSyncs(
  together: boolean,
): (name: string) => ComparisonScrollSync {
  const [owner] = useState(createScrollOwner);
  const syncs = useRef(new Map<string, ComparisonScrollSync>());
  const latest = useRef(together);
  latest.current = together;
  useEffect(() => {
    for (const sync of syncs.current.values()) sync.setTogether(together);
  }, [together]);
  return useCallback(
    (name: string) => {
      let sync = syncs.current.get(name);
      if (!sync) {
        sync = createComparisonScrollSync({ owner, together: latest.current });
        syncs.current.set(name, sync);
      }
      return sync;
    },
    [owner],
  );
}

/**
 * Where Swipe's divider stands on every frame, and its setter. Each time the
 * frames turn to Swipe, the divider opens in the middle.
 */
export function useSwipeSplit(
  mode: CanvasCompareMode | undefined,
): [number, (position: number) => void] {
  const [split, setSplit] = useState(SWIPE_START);
  const [opened, setOpened] = useState(mode);
  if (opened !== mode) {
    setOpened(mode);
    if (mode === "swipe") setSplit(SWIPE_START);
  }
  return [split, setSplit];
}

/** The measurement of a frame's pair of documents, by the frame and the pair. */
function measureKey(frame: Pick<ComparedFrame, "documents" | "key">): string {
  return JSON.stringify([
    frame.key,
    frame.documents.before ?? "",
    frame.documents.after ?? "",
  ]);
}

/** The sides of a frame that have a document. */
function presentSides(
  frame: Pick<ComparedFrame, "documents">,
): ComparisonSide[] {
  return (["before", "after"] as const).filter(
    (side) => frame.documents[side] !== undefined,
  );
}

/**
 * The size of each compared frame: a screen's frame keeps its viewport's
 * nominal size, and a component's frame takes the larger width and height of
 * its versions once both are measured. `measure` gives a component frame's
 * versions the listener of their measurements.
 */
export function useComparedSizes(): {
  measure(
    frame: Pick<ComparedFrame, "documents" | "key">,
  ): (side: ComparisonSide, size: CanvasFrameSize) => void;
  size(
    frame: Pick<ComparedFrame, "documents" | "key">,
    kind: "component" | "desktop" | "mobile",
  ): CanvasFrameSize;
} {
  const [measured, setMeasured] = useState<
    Readonly<Record<string, MeasuredVersions>>
  >({});
  const measure = useCallback(
    (frame: Pick<ComparedFrame, "documents" | "key">) => {
      const key = measureKey(frame);
      return (side: ComparisonSide, size: CanvasFrameSize) =>
        setMeasured((current) =>
          current[key]?.[side]
            ? current
            : { ...current, [key]: { ...current[key], [side]: size } },
        );
    },
    [],
  );
  const size = useCallback(
    (
      frame: Pick<ComparedFrame, "documents" | "key">,
      kind: "component" | "desktop" | "mobile",
    ): CanvasFrameSize => {
      if (kind === "desktop") return DESKTOP_FRAME_SIZE;
      if (kind === "mobile") return MOBILE_FRAME_SIZE;
      return comparedComponentSize(
        measured[measureKey(frame)],
        presentSides(frame),
      );
    },
    [measured],
  );
  return useMemo(() => ({ measure, size }), [measure, size]);
}
