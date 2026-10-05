import { parseViewHref, viewHref } from "./routes.js";

/** Trusted shell metadata needed to serve a catalogue from ordinary files. */
export interface StaticDelivery {
  schemaVersion: 3;
  deploymentId: string;
  canonicalPath: string;
  /** Null explicitly disables comparisons for a current-only publication. */
  comparisonUrl: string | null;
}

/** Require the canonical file form of one shared entry route. */
function isCanonicalViewPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const identity = parseViewHref(value);
  return (
    identity !== undefined && viewHref(identity.kind, identity.id) === value
  );
}

/** Validate static metadata before it can authorize browser requests. */
export function parseStaticDelivery(
  value: unknown,
): StaticDelivery | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).length !== 4 ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 3 ||
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
      !/^\/__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/.test(
        value.comparisonUrl,
      ))
  )
    return undefined;
  return {
    schemaVersion: 3,
    deploymentId: value.deploymentId,
    canonicalPath: value.canonicalPath as string,
    comparisonUrl: value.comparisonUrl,
  };
}
