import { isMoklyError, MoklyError } from "../errors.js";

/** Product copy for the one expected earlier-baseline outcome. */
export const EARLIER_BASELINE_MESSAGE =
  "Changes are unavailable because the comparison base was built with an earlier version of Mokly. Changes will return once the base includes this version.";

/** Create the typed outcome used only at the historical manifest gate. */
export function incompatibleEarlierBaseline(): MoklyError {
  return new MoklyError(
    "baseline-incompatible-earlier",
    "the comparison base was built by an earlier Mokly version",
  );
}

/** Distinguish expected earlier output without inspecting error text. */
export function isIncompatibleEarlierBaseline(
  error: unknown,
): error is MoklyError {
  return isMoklyError(error) && error.code === "baseline-incompatible-earlier";
}
