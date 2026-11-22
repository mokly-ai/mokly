/**
 * One screen or component frame on the canvas. This container mounts the
 * frame's document through its adapter, as the one-frame stage does, and
 * `@mokly/ui/canvas-frame` draws the bare frame with its label and size tag.
 * The frame shows the view of its own scheme, whatever the appearance.
 */

import { useContext, useEffect } from "react";

import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { PreviewIframe } from "@mokly/ui/preview-frame";

import {
  componentFrameSize,
  type CanvasFrameSize,
} from "./canvas_frame_size.js";
import type { CanvasFramePlan } from "./canvas_frames.js";
import { FrameStageContext } from "./frame_layout_context.js";
import { focusThen } from "./retry_focus.js";
import { useViewFrame, viewSources } from "./stage_frame.js";
import { generatedView } from "./stage_sources.js";

/** The documents of a frame's view in both schemes, for its adapter. */
function frameSources(
  plan: CanvasFramePlan,
  fragment: string | undefined,
): readonly string[] {
  const previews = plan.preview ? [plan.preview] : [];
  const view = (scheme: "dark" | "light") =>
    plan.entry.views.find(
      (candidate) =>
        candidate.viewport === plan.viewport &&
        candidate.colorScheme === scheme,
    );
  return viewSources(
    plan.entry,
    view("light"),
    view("dark"),
    generatedView(previews, plan.variantPath, plan.viewport, "light"),
    generatedView(previews, plan.variantPath, plan.viewport, "dark"),
    fragment,
  );
}

export function CanvasLiveFrame({
  fragment,
  hasDarkFragments,
  onSize,
  plan,
  size,
}: {
  fragment?: string | undefined;
  hasDarkFragments: boolean;
  /** Receives a component frame's nominal size once its document loads. */
  onSize?: ((key: string, size: CanvasFrameSize) => void) | undefined;
  plan: CanvasFramePlan;
  size: CanvasFrameSize;
}) {
  const stage = useContext(FrameStageContext);
  const { entry, scheme, viewport } = plan;
  const frame = useViewFrame({
    entry,
    expanded: false,
    fragment,
    preview: plan.preview,
    sources: hasDarkFragments ? frameSources(plan, fragment) : [],
    stage,
    variantPath: plan.variantPath,
    view: plan.view,
    viewport,
  });
  const component = plan.kind === "component";
  // A component frame asks for its size once after each load of its
  // document: the status leaves `ready` while a document loads, and a usage
  // update keeps it, so a frame never measures a document that it has
  // already sized. No frame adapter measures a document's content yet, so
  // the frame keeps the size of a frame without a content box.
  useEffect(() => {
    if (component && frame.status === "ready")
      onSize?.(plan.key, componentFrameSize(undefined));
  }, [component, frame.status, onSize, plan.key]);
  return (
    <CanvasFrame
      error={frame.status === "error"}
      height={size.height}
      kind={plan.kind}
      label={plan.label}
      retry={{ onClick: focusThen(frame.frameRef, frame.retry) }}
      scheme={scheme}
      selected={plan.selected}
      width={size.width}
    >
      {frame.source ? (
        <PreviewIframe
          busy={frame.status === "loading"}
          data={{
            "data-mokly-fragment-frame": "",
            "data-mokly-frame-state": frame.status,
            "data-workspace-frame": viewport,
            "data-workspace-color-scheme": scheme,
            "data-workspace-variant": plan.variantPath,
          }}
          key={frame.generation}
          ref={frame.frameRef}
          src={frame.initialSource}
          title={`${entry.title} — ${viewport} — ${scheme}`}
        />
      ) : null}
    </CanvasFrame>
  );
}
