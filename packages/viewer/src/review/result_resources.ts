import { isStylesheetPath } from "./css/stylesheet_path.js";
import {
  requireOrdered,
  reviewArray,
  reviewInvalid,
  reviewObject,
  reviewPath,
  reviewStrings,
} from "./result_helpers.js";

/** Validate dependency analysis at both the entry and view schema boundaries. */
export function validateDependencyReason(
  value: unknown,
  changedPaths: readonly string[],
): string {
  const reason = reviewObject(value, ["kind", "path"], ["analysis"]);
  const path = reviewPath(reason.path);
  if (reason.kind !== "dependency" || !changedPaths.includes(path))
    reviewInvalid("dependency did not change");
  if (reason.analysis !== undefined) {
    if (!isStylesheetPath(path))
      reviewInvalid("analysis requires a stylesheet");
    const analysis = reviewObject(reason.analysis, ["status", "selectors"]);
    if (analysis.status !== "matched" && analysis.status !== "unresolved")
      reviewInvalid("invalid stylesheet analysis status");
    const selectors = reviewStrings(analysis.selectors);
    if (analysis.status === "matched" && !selectors.length)
      reviewInvalid("matched analysis requires selectors");
  }
  return path;
}

/** Exclusions are unique changed CSS paths and cannot also be kept on this view. */
export function validateResourceEvidence(
  view: Record<string, unknown>,
  changedPaths: readonly string[],
): void {
  if (
    view.material !== undefined &&
    (view.material !== true ||
      !["changed", "added", "removed"].includes(String(view.state)))
  )
    reviewInvalid(
      "material requires true and a changed, added, or removed view",
    );
  const kept: string[] = [];
  if (view.reasons !== undefined) {
    const reasons = reviewArray(view.reasons);
    if (!reasons.length) reviewInvalid("empty optional resource reasons");
    kept.push(
      ...reasons.map((reason) =>
        validateDependencyReason(reason, changedPaths),
      ),
    );
    requireOrdered(kept, (path) => path);
  }
  if (view.excludedResources !== undefined) {
    const excluded = reviewArray(view.excludedResources);
    if (!excluded.length) reviewInvalid("empty optional exclusions");
    const paths = excluded.map((value) => {
      const resource = reviewObject(value, ["path", "reason"]);
      const path = reviewPath(resource.path);
      if (
        !isStylesheetPath(path) ||
        resource.reason !== "no-matching-rule" ||
        !changedPaths.includes(path) ||
        kept.includes(path)
      )
        reviewInvalid("invalid stylesheet exclusion");
      return path;
    });
    requireOrdered(paths, (path) => path);
  }
}
