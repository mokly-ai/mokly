/**
 * A removed screen's section on the canvas: one canvas frame for each
 * historical view, from `canvas_removed_frames.ts`, each holding its
 * historical document in a read-only `srcdoc` frame, which forwards its
 * canvas input through `canvas_frame_input.tsx`, and the note of a viewport
 * never captured in its frames' places. The compact layout shows one of
 * them, the frame of the selection's viewport and scheme.
 */

import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { CanvasMissingView } from "@mokly/ui/canvas-missing-view";

import type { ViewerSelection } from "../host/types.js";
import type { SnapshotPresentation } from "../previews/presentation.js";
import type { PreviewContent } from "../previews/request.js";

import { compactFrameLabel, pickedFrameKey } from "./canvas_compact.js";
import { useCanvasFrameInput } from "./canvas_frame_input.js";
import {
  DESKTOP_FRAME_SIZE,
  MOBILE_FRAME_SIZE,
  type CanvasFrameSize,
} from "./canvas_frame_size.js";
import type { CanvasScheme } from "./canvas_frames.js";
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
  const input = useCanvasFrameInput();
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
      focusVisible={input.focusVisible}
      height={size.height}
      kind={plan.viewport}
      label={plan.label}
      lightOnly={plan.lightOnly}
      scheme={plan.scheme}
      width={size.width}
    >
      {presentation ? (
        <SnapshotFrame
          canvasInput={input.listener}
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
  schemes,
  viewport,
  views,
}: RemovedSectionProps & {
  /** The schemes whose rows the Frames filter shows. */
  schemes?: readonly CanvasScheme[] | undefined;
  viewport: ViewerSelection["viewport"];
  views: readonly ScreenView[];
}) {
  const compact = !useCanvasLayout();
  const shown = removedScreenFrames(views, {
    compact,
    schemes: compact ? undefined : schemes,
    viewport,
  }).filter((frame) => !frame.hidden);
  // The compact layout shows the frame of the selection's viewport and
  // scheme alone, which the entry bar's picker picks, named as a current
  // screen's one frame is.
  const picked = compact
    ? pickedFrameKey(shown, { colorScheme, viewport })
    : undefined;
  const frames =
    picked === undefined
      ? shown
      : shown
          .filter((frame) => frame.key === picked)
          .map((frame) => ({
            ...frame,
            column: 0,
            label: compactFrameLabel(data.path, frame.label),
            row: 0,
          }));
  // The preview reports ready once the document of every shown frame arrived.
  if (frames.some((frame) => frame.view && !presentations.has(frame.view.url)))
    return <RemovedUnavailable retry={retry} />;
  return (
    <RemovedSection
      colorScheme={colorScheme}
      data={data}
      fitKey={`removed:${data.path}:${viewport}:${schemes?.join(",") ?? ""}${picked ? `:${picked}` : ""}`}
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
