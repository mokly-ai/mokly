/**
 * A screen's or a component's canvas in the wide layout: the frames that
 * the workspace chose, each mounted by `canvas_live_frame.tsx`, in the
 * section that names the routed entry. A component frame takes the size
 * that its document's content needs, measured after each load; a fitted
 * canvas refits to the measured frames.
 */

import { useCallback, useState } from "react";

import type { ChangeStatusValue } from "@mokly/ui/change-status";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";

import {
  componentFrameSize,
  DESKTOP_FRAME_SIZE,
  MOBILE_FRAME_SIZE,
  type CanvasFrameSize,
} from "./canvas_frame_size.js";
import type { CanvasFramePlan } from "./canvas_frames.js";
import { CanvasLiveFrame } from "./canvas_live_frame.js";
import { CanvasEntryStage } from "./canvas_stage.js";
import type { Catalogue } from "./catalogue.js";
import { targetHead } from "./head.js";

/** What the workspace gives its canvas. */
export interface WorkspaceCanvas {
  /** Names the shown frames: the screen and its viewport choice, or the set. */
  fitKey: string;
  frames: readonly CanvasFramePlan[];
  /** The status beside the entry's title, as its head band shows it. */
  status?: ChangeStatusValue | undefined;
}

function frameSize(
  plan: CanvasFramePlan,
  measured: Readonly<Record<string, CanvasFrameSize>>,
): CanvasFrameSize {
  if (plan.kind === "desktop") return DESKTOP_FRAME_SIZE;
  if (plan.kind === "mobile") return MOBILE_FRAME_SIZE;
  return measured[plan.key] ?? componentFrameSize();
}

export function CanvasWorkspaceStage({
  canvas,
  catalogue,
  entry,
  fragment,
}: {
  canvas: WorkspaceCanvas;
  catalogue: Catalogue;
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "component" | "screen" }>;
  fragment?: string | undefined;
}) {
  const head = targetHead(catalogue, { kind: "entry", entry });
  const [sizes, setSizes] = useState<Readonly<Record<string, CanvasFrameSize>>>(
    {},
  );
  const onSize = useCallback((key: string, size: CanvasFrameSize) => {
    setSizes((current) => {
      const known = current[key];
      return known?.width === size.width && known.height === size.height
        ? current
        : { ...current, [key]: size };
    });
  }, []);
  return (
    <CanvasEntryStage
      fitKey={canvas.fitKey}
      frames={canvas.frames.map((plan) => {
        const size = frameSize(plan, sizes);
        return {
          column: plan.column,
          height: size.height,
          hidden: plan.hidden,
          key: plan.key,
          node: (
            <CanvasLiveFrame
              // The route's fragment names a place in the routed entry, so
              // only that entry's frames open there, not the set's other rows.
              fragment={plan.entry.path === entry.path ? fragment : undefined}
              hasDarkFragments={catalogue.hasDarkFragments}
              onSize={onSize}
              plan={plan}
              size={size}
            />
          ),
          row: plan.row,
          width: size.width,
        };
      })}
      kind={entry.kind}
      path={head.path}
      status={canvas.status}
      title={head.title}
    />
  );
}
