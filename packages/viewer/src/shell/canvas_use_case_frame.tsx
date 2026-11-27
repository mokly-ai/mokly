/**
 * One step frame of a use case on the canvas. This container mounts the step
 * screen's view through its adapter, as a screen's frame does, under the
 * step's own frame identity, so instance events and markers name the step.
 * `@mokly/ui/canvas-frame` draws the frame with the step's number, the link
 * that opens the step's screen, and the step's description.
 */

import { useContext } from "react";

import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { PreviewIframe } from "@mokly/ui/preview-frame";

import type { ShellCatalogueScreen } from "../catalogue/scoped_types.js";
import { viewHref } from "../navigation/routes.js";

import type { CanvasFrameSize } from "./canvas_frame_size.js";
import type { CanvasStepPlan } from "./canvas_frames.js";
import type { UseCaseFramePlan } from "./canvas_use_case_frames.js";
import { FrameStageContext } from "./frame_layout_context.js";
import { focusThen } from "./retry_focus.js";
import { useViewFrame, viewSources } from "./stage_frame.js";

/**
 * The accessible name of a step's link: the step's title, which the link
 * shows, and the screen that the link opens.
 */
function stepLinkLabel(
  step: Pick<CanvasStepPlan, "title">,
  screen: Pick<ShellCatalogueScreen, "title">,
): string {
  return `${step.title}, ${screen.title} screen`;
}

export function CanvasUseCaseFrame({
  fragment,
  hasDarkFragments,
  plan,
  size,
}: {
  /** The route's fragment, which only the first step's frame opens at. */
  fragment?: string | undefined;
  hasDarkFragments: boolean;
  plan: UseCaseFramePlan;
  size: CanvasFrameSize;
}) {
  const stage = useContext(FrameStageContext);
  const { entry, scheme, step, viewport } = plan;
  const view = (colorScheme: "dark" | "light") =>
    entry.views.find(
      (candidate) =>
        candidate.viewport === viewport &&
        candidate.colorScheme === colorScheme,
    );
  const frame = useViewFrame({
    entry,
    fragment,
    preview: undefined,
    sources: hasDarkFragments
      ? viewSources(
          entry,
          view("light"),
          view("dark"),
          undefined,
          undefined,
          fragment,
          step.index,
        )
      : [],
    stage,
    stepIndex: step.index,
    view: plan.view,
    viewport,
  });
  return (
    <CanvasFrame
      description={step.description}
      error={frame.status === "error"}
      outdated={frame.status === "outdated"}
      height={size.height}
      kind={plan.kind}
      label={step.title}
      lightOnly={step.lightOnly}
      link={{ href: viewHref(entry.path), label: stepLinkLabel(step, entry) }}
      retry={{ onClick: focusThen(frame.frameRef, frame.retry) }}
      scheme={scheme}
      step={step.number}
      width={size.width}
    >
      {frame.source ? (
        <PreviewIframe
          busy={frame.status === "loading"}
          data={{
            "data-mokly-fragment-frame": step.index === 0 ? "" : undefined,
            "data-mokly-frame-state": frame.status,
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
