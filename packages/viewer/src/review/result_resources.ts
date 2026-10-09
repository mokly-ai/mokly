import { isStylesheetPath } from "./css/stylesheet_path.js";
import { validateCssAnalysis } from "./result_css.js";
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
  changedPaths: readonly string[] | undefined,
  aggregate = true,
): string {
  const reason = reviewObject(value, ["kind", "path"], ["analysis"]);
  const path = reviewPath(reason.path);
  if (
    reason.kind !== "dependency" ||
    (changedPaths && !changedPaths.includes(path))
  )
    reviewInvalid("dependency did not change");
  if (isStylesheetPath(path) && reason.analysis === undefined)
    reviewInvalid("stylesheet dependency requires analysis");
  if (reason.analysis !== undefined) {
    if (!isStylesheetPath(path))
      reviewInvalid("analysis requires a stylesheet");
    validateCssAnalysis(reason.analysis, aggregate);
  }
  return path;
}

/** Exclusions are unique changed CSS paths and cannot also be kept on this view. */
export function validateResourceEvidence(
  view: Record<string, unknown>,
  changedPaths: readonly string[] | undefined,
  paired = true,
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
        validateDependencyReason(reason, changedPaths, false),
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
        (changedPaths && !changedPaths.includes(path)) ||
        kept.includes(path)
      )
        reviewInvalid("invalid stylesheet exclusion");
      return path;
    });
    requireOrdered(paths, (path) => path);
  }
  if (view.inlineStyles !== undefined) validateInlineStyles(view, paired);
}

function validateInlineStyles(
  view: Record<string, unknown>,
  paired: boolean,
): void {
  const shape = reviewObject(view.inlineStyles, ["status"], ["selectors"]);
  if (!paired || view.state === "added" || view.state === "removed")
    reviewInvalid("inline style evidence requires a paired view");
  if (shape.status === "matched" || shape.status === "unresolved") {
    const evidence = reviewObject(view.inlineStyles, ["status", "selectors"]);
    const selectors = reviewStrings(evidence.selectors);
    if (shape.status === "matched" && selectors.length === 0)
      reviewInvalid("matched inline styles require selectors");
    if (view.state !== "changed" || view.material !== true)
      reviewInvalid("retained inline styles require changed material");
    return;
  }
  if (shape.status !== "excluded")
    reviewInvalid("invalid inline style evidence status");
  reviewObject(view.inlineStyles, ["status"]);
  if (
    view.state !== "unchanged" ||
    view.material !== undefined ||
    view.reasons !== undefined
  )
    reviewInvalid("excluded inline styles require an unchanged view");
}
