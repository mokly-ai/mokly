import { VIEWER_DIRECTORY } from "../catalogue/delivery_paths.js";

import { parseViewHref, viewHref } from "./routes.js";

/** Trusted shell metadata needed to serve a catalogue from ordinary files. */
export interface StaticDelivery {
  schemaVersion: 5;
  deploymentId: string;
  canonicalPath: string;
  /** Null explicitly disables comparisons for a current-only publication. */
  comparisonUrl: string | null;
}

/** Require the canonical file form of one shared entry route. */
function isCanonicalViewPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const identity = parseViewHref(value);
  return identity !== undefined && viewHref(identity) === value;
}

/** Classify untrusted metadata without crossing a browser error boundary. */
export type StaticDeliveryParseResult =
  | { kind: "valid"; value: StaticDelivery }
  | { kind: "unsupported-version"; version: unknown }
  | { kind: "invalid" };

export function parseStaticDelivery(value: unknown): StaticDeliveryParseResult {
  try {
    if (
      value &&
      typeof value === "object" &&
      "schemaVersion" in value &&
      value.schemaVersion !== 5
    )
      return { kind: "unsupported-version", version: value.schemaVersion };
    const parsed = parseCurrentDelivery(value);
    return parsed ? { kind: "valid", value: parsed } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function parseCurrentDelivery(value: unknown): StaticDelivery | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).length !== 4 ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 5 ||
    !("deploymentId" in value) ||
    typeof value.deploymentId !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.deploymentId) ||
    !("canonicalPath" in value) ||
    !("comparisonUrl" in value)
  )
    return undefined;
  if (
    value.canonicalPath !== "/" &&
    value.canonicalPath !== "/404.html" &&
    !isCanonicalViewPath(value.canonicalPath)
  )
    return undefined;
  if (
    value.comparisonUrl !== null &&
    (typeof value.comparisonUrl !== "string" ||
      !new RegExp(
        `^\\/${VIEWER_DIRECTORY}\\/diffs\\/generations\\/[a-f0-9]{64}\\/review\\.json$`,
      ).test(value.comparisonUrl))
  )
    return undefined;
  return {
    schemaVersion: 5,
    deploymentId: value.deploymentId,
    canonicalPath: value.canonicalPath as string,
    comparisonUrl: value.comparisonUrl,
  };
}
