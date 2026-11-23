/**
 * A removed screen's section on the canvas: one canvas frame for each
 * historical view, from `canvas_removed_frames.ts`, each holding its
 * historical document in a read-only `srcdoc` frame, and the note of a
 * viewport never captured in its frames' places.
 */

import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { CanvasMissingView } from "@mokly/ui/canvas-missing-view";

import type { ViewerSelection } from "../host/types.js";
import type { SnapshotPresentation } from "../previews/presentation.js";
import type { PreviewContent } from "../previews/request.js";

import {
  DESKTOP_FRAME_SIZE,
  MOBILE_FRAME_SIZE,
  type CanvasFrameSize,
} from "./canvas_frame_size.js";
import { useCanvasLayout } from "./canvas_layout.js";
import {
  removedScreenFrames,
  type RemovedFramePlan,
} from "./canvas_removed_frames.js";
import {
  RemovedSection,
  RemovedUnavailable,
  type RemovedSectionProps,
} from "./canvas_removed_section.js";
import { SnapshotFrame } from "./preview_frame.js";

type ScreenView = Extract<PreviewContent, { kind: "screen" }>["views"][number];

/** One historical view's frame, or the note in a missing view's place. */
function HistoricalFrame({
  plan,
  presentation,
  size,
  title,
}: {
  plan: RemovedFramePlan<ScreenView>;
  presentation: SnapshotPresentation | undefined;
  size: CanvasFrameSize;
  /** The removed screen's title. */
  title: string;
}) {
  if (!plan.view)
    return (
      <CanvasMissingView
        height={size.height}
        label={plan.label}
        otherShown={plan.otherShown}
        scheme={plan.scheme}
        viewport={plan.viewport}
        width={size.width}
      />
    );
  return (
    <CanvasFrame
      height={size.height}
      kind={plan.viewport}
      label={plan.label}
      lightOnly={plan.lightOnly}
      scheme={plan.scheme}
      width={size.width}
    >
      {presentation ? (
        <SnapshotFrame
          presentation={presentation}
          title={`${title} — ${plan.viewport} — ${plan.scheme}`}
        />
      ) : null}
    </CanvasFrame>
  );
}

/** A removed screen's section of its historical views. */
export function RemovedScreenSection({
  colorScheme,
  data,
  presentations,
  retry,
  viewport,
  views,
}: RemovedSectionProps & {
  viewport: ViewerSelection["viewport"];
  views: readonly ScreenView[];
}) {
  const compact = !useCanvasLayout();
  const frames = removedScreenFrames(views, { compact, viewport }).filter(
    (frame) => !frame.hidden,
  );
  // The preview reports ready once the document of every shown frame arrived.
  if (frames.some((frame) => frame.view && !presentations.has(frame.view.url)))
    return <RemovedUnavailable retry={retry} />;
  return (
    <RemovedSection
      colorScheme={colorScheme}
      data={data}
      fitKey={`removed:${data.path}:${viewport}`}
      frames={frames.map((plan) => {
        const size =
          plan.viewport === "desktop" ? DESKTOP_FRAME_SIZE : MOBILE_FRAME_SIZE;
        return {
          column: plan.column,
          height: size.height,
          key: plan.key,
          node: (
            <HistoricalFrame
              plan={plan}
              presentation={plan.view && presentations.get(plan.view.url)}
              size={size}
              title={data.title}
            />
          ),
          row: plan.row,
          width: size.width,
        };
      })}
      kind="screen"
    />
  );
}
