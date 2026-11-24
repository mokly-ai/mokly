/**
 * The change stepper of the Changes tab: a row under the right panel's tabs
 * that reads where the shown entry stands among the entries that the Changes
 * filter lists, then Previous change and Next change, which open the entry
 * before and after it. The host gives the place, the count, and the address
 * of each step.
 */

import { CanvasIcon } from "../icons/canvas-icons.js";

/** The direction of a step, which its stylesheet reads to turn the glyph. */
type StepDirection = "next" | "previous";

/**
 * One step. A step at an end of the list is a disabled button, also when the
 * host gives it an address. Otherwise a step with an address is a link, and a
 * step without one is a picture of itself, which only a static depiction
 * draws. The glyph points down, and the stylesheet turns Previous change's
 * glyph upside down.
 */
function Step({
  direction,
  end,
  href,
  label,
}: {
  direction: StepDirection;
  end: boolean;
  href: string | undefined;
  label: string;
}) {
  const icon = <CanvasIcon name="chevron" size={15} />;
  if (end)
    return (
      <button
        aria-label={label}
        className="mbk-change-stepper-step mbk-reset"
        data-change-step={direction}
        disabled
        type="button"
      >
        {icon}
      </button>
    );
  if (href === undefined)
    return (
      <span
        aria-label={label}
        className="mbk-change-stepper-step mbk-reset"
        data-change-step={direction}
        role="img"
      >
        {icon}
      </span>
    );
  return (
    <a
      aria-label={label}
      className="mbk-change-stepper-step mbk-reset"
      data-change-step={direction}
      href={href}
    >
      {icon}
    </a>
  );
}

export function ChangeStepper({
  nextHref,
  position,
  previousHref,
  total,
}: {
  /** The shown entry's place among the entries that the Changes filter lists, from 1. */
  position: number;
  /** How many entries the Changes filter lists. */
  total: number;
  /** The address of the change before the shown one. */
  previousHref?: string | undefined;
  /** The address of the change after the shown one. */
  nextHref?: string | undefined;
}) {
  return (
    <div className="mbk-change-stepper mbk-reset">
      <span className="mbk-change-stepper-count mbk-reset">
        {`Change ${position} of ${total}`}
      </span>
      <span className="mbk-change-stepper-steps mbk-reset">
        <Step
          direction="previous"
          end={position <= 1}
          href={previousHref}
          label="Previous change"
        />
        <Step
          direction="next"
          end={position >= total}
          href={nextHref}
          label="Next change"
        />
      </span>
    </div>
  );
}
