/** The bounds and step that a number control offers, and its HTML bounds. */

import type { ComponentControl } from "../components/control_types.js";

export type NumberControl = Extract<ComponentControl, { kind: "number" }>;

/**
 * The HTML bounds that offer only multiples of the step counted from zero:
 * the first offered value is the smallest multiple at or above the minimum.
 */
export function numberInputBounds(control: NumberControl): {
  min?: number;
  max?: number;
  step: number | "any";
} {
  const step = control.step;
  if (step === undefined)
    return {
      ...(control.minimum === undefined ? {} : { min: control.minimum }),
      ...(control.maximum === undefined ? {} : { max: control.maximum }),
      step: "any",
    };
  return {
    ...(control.minimum === undefined
      ? {}
      : { min: multiple(control.minimum, step, "up") }),
    ...(control.maximum === undefined
      ? {}
      : { max: multiple(control.maximum, step, "down") }),
    step,
  };
}

/** The nearest multiple of `step` at or beyond `bound` in one direction. */
function multiple(bound: number, step: number, direction: "up" | "down") {
  const decimals = Math.min(20, Math.max(precision(step), precision(bound)));
  const at = (count: number) => Number((count * step).toFixed(decimals));
  let count =
    direction === "up" ? Math.ceil(bound / step) : Math.floor(bound / step);
  if (direction === "up") {
    if (at(count) < bound) count += 1;
    else if (at(count - 1) >= bound) count -= 1;
  } else if (at(count) > bound) count -= 1;
  else if (at(count + 1) <= bound) count += 1;
  const value = at(count);
  return Object.is(value, -0) ? 0 : value;
}

function precision(value: number): number {
  const [mantissa = "", exponent = "0"] = String(value).split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent));
}
