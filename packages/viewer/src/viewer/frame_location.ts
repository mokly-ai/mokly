import { encodeUrlPath } from "../data/paths.js";

/** Logical fragments address a standalone view or only the first step of a flow. */
export function frameLocation(
  path: string,
  fragment?: string,
  stepIndex?: number,
): string {
  const anchor =
    stepIndex === undefined || stepIndex === 0 ? fragment : undefined;
  return `/${encodeUrlPath(path)}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`;
}
