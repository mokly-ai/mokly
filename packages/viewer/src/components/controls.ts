import type { ComponentControl } from "@mokly/model";

import { invalidData } from "./data.js";
import type { ComponentPropsData } from "./prop_types.js";

/**
 * Saved props must also satisfy the narrower constraints of their controls.
 * A text length counts code points, like the schema's `maxLength`.
 */
export function validateControlledValues(
  controls: Readonly<Record<string, ComponentControl>>,
  props: ComponentPropsData,
  at: string,
): void {
  for (const [key, control] of Object.entries(controls)) {
    const value = props[key];
    if (value === undefined) continue;
    if (
      control.kind === "text" &&
      (typeof value !== "string" ||
        [...value].length > (control.maxLength ?? Infinity))
    )
      invalidData(`${at}.${key}`, "text exceeds control limits");
    if (control.kind === "boolean" && typeof value !== "boolean")
      invalidData(`${at}.${key}`, "expected a boolean");
    if (
      control.kind === "number" &&
      (typeof value !== "number" ||
        value < (control.minimum ?? -Infinity) ||
        value > (control.maximum ?? Infinity))
    )
      invalidData(`${at}.${key}`, "number exceeds control limits");
    if (
      control.kind === "select" &&
      !control.options.some((option) => Object.is(option.value, value))
    )
      invalidData(`${at}.${key}`, "value is not a control option");
  }
}
