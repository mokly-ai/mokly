import { canvasFrame } from "../../../library/canvas/canvas-frame.js";
import {
  DesignInstances,
  useDesignInstance,
} from "../../../library/composition.js";
import { DepictedViewScope } from "../../../parts/depicted_view.js";
import type { CanvasEntry } from "../../parts/entries.js";
import { stageTags, type CanvasFrameSpec } from "../../parts/frames.js";
import { EntryStatus, FramePicker } from "../../parts/stage.js";

import type { StepFrames, UseCaseStep } from "./steps.js";

/** The frame picker's option of a step: its number and its title. */
function stepOption(step: UseCaseStep) {
  return { id: `step-${step.number}`, label: `${step.number} · ${step.title}` };
}

/**
 * One step frame: the step screen's view of one viewport and scheme, named
 * by the step's number and title, whose title opens the step's screen, with
 * the step's description below its label. Its slot carries the frame's
 * viewport and scheme, so the Frames filter hides it while it chooses
 * another.
 */
function StepFrame({
  frame,
  step,
  zoom,
}: {
  frame: CanvasFrameSpec;
  step: UseCaseStep;
  zoom: number;
}) {
  return (
    <div
      className="cv-frame-slot"
      data-cv-scheme={frame.scheme}
      data-cv-viewport={frame.kind}
    >
      <canvasFrame.Component
        moklyInstance={useDesignInstance(`frame-${frame.id}`)}
        kind={frame.kind}
        scheme={frame.scheme}
        label={step.title}
        width={frame.width}
        height={frame.height}
        zoom={zoom / 100}
        step={step.number}
        screenDestination={step.screen}
        description={step.description}
      >
        {frame.content}
      </canvasFrame.Component>
    </div>
  );
}

interface UseCaseStageProps {
  entry: CanvasEntry;
  steps: readonly UseCaseStep[];
  /** The viewport and the scheme that the Frames filter chooses. */
  chosen: StepFrames;
  /**
   * Whether the artboard draws the Frames filter, which then chooses a step's
   * frame in place among all of them. Without it, as on a phone while the
   * panel sheet is closed, each step holds only the chosen frame.
   */
  filtered: boolean;
  /** The step that the compact frame picker shows: the first by default. */
  picked?: number | undefined;
  /** The section's zoom in percent, as the zoom pill shows it. */
  zoom: number;
}

/**
 * A use case on the canvas: one section whose head names the use case, its
 * path and its change status, with no kind tag, and one step frame for each
 * step, in step order, in one row at one zoom, whose frames draw no tags
 * below 60%. The compact form's entry bar names the use case, and its frame
 * picker lists the steps by number and title and shows the picked step's
 * frame alone.
 */
export function UseCaseStage({
  chosen,
  entry,
  filtered,
  picked = 1,
  steps,
  zoom,
}: UseCaseStageProps) {
  const shown = `${chosen.viewport}-${chosen.scheme}`;
  return (
    <>
      <div className="cv-entry-bar" data-cv-kind={entry.kind}>
        <span className="cv-entry-title">
          <span className="cv-title-tag">{entry.title}</span>
          <EntryStatus entry={entry} name="entry-status" />
        </span>
        <FramePicker
          frames={steps.map(stepOption)}
          kind={entry.kind}
          picked={`step-${picked}`}
        />
      </div>
      <div
        className="cv-view"
        data-cv-kind={entry.kind}
        data-cv-tags={stageTags(zoom)}
      >
        <div className="cv-section" data-cv-kind={entry.kind}>
          <div className="cv-section-head">
            <span className="cv-title-tag">{entry.title}</span>
            <span className="cv-path-chip">{entry.path}</span>
            <EntryStatus entry={entry} name="section-status" />
          </div>
          <div className="cv-frames" data-cv-kind={entry.kind}>
            {steps.map((step) => (
              <div
                className="cv-step"
                data-cv-step={step.number}
                key={step.name}
              >
                <DesignInstances name={step.name}>
                  <DepictedViewScope view={step.view}>
                    {step
                      .frames()
                      .filter((frame) => filtered || frame.id === shown)
                      .map((frame) => (
                        <StepFrame
                          frame={frame}
                          key={frame.id}
                          step={step}
                          zoom={zoom}
                        />
                      ))}
                  </DepictedViewScope>
                </DesignInstances>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
