import { mockLink } from "@mokly/mokly";

import type { DesignDestination } from "../../parts/destinations.js";
import { CanvasGlyph, type CanvasGlyphName } from "../canvas/glyphs.js";

import type { ChangeStepperProps } from "./change-stepper.js";

/**
 * One step to another change. The first change has no previous one and the
 * last no next one, so that step is a disabled button. A static artboard
 * runs no script, so a step links to the artboard that shows its outcome,
 * and a step without one is a picture of itself.
 */
function Step({
  disabled,
  glyph,
  label,
  to,
}: {
  disabled: boolean;
  glyph: CanvasGlyphName;
  label: string;
  to: DesignDestination | undefined;
}) {
  const icon = <CanvasGlyph name={glyph} size={15} />;
  if (disabled)
    return (
      <button
        aria-label={label}
        className="cv-stepper-step"
        disabled
        type="button"
      >
        {icon}
      </button>
    );
  return to === undefined ? (
    <span aria-label={label} className="cv-stepper-step" role="img">
      {icon}
    </span>
  ) : (
    <a aria-label={label} className="cv-stepper-step" href={mockLink(to)}>
      {icon}
    </a>
  );
}

/**
 * The stepper under the right panel's tabs in Changes: where the shown entry
 * stands among the changes of the branch, then Previous change and Next
 * change, which open the entry before and after it in the Changes filter.
 */
export function ChangeStepperView({
  nextDestination,
  position,
  previousDestination,
  total,
}: ChangeStepperProps) {
  return (
    <div className="cv-stepper">
      <span className="cv-stepper-count">
        Change {position} of {total}
      </span>
      <span className="cv-stepper-steps">
        <Step
          disabled={position <= 1}
          glyph="chevron-up"
          label="Previous change"
          to={previousDestination}
        />
        <Step
          disabled={position >= total}
          glyph="chevron"
          label="Next change"
          to={nextDestination}
        />
      </span>
    </div>
  );
}
