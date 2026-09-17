/** Shared ownership boundary for rule-aware stylesheet attribution. */
import path from "node:path";

import type { ViewReview } from "@mokly/viewer/data";
import { isStylesheetPath } from "@mokly/viewer/data";

import { isInside } from "../../config/paths.js";
import { isPrivateStaticPath } from "../../config/public_files.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";

/** Only public stylesheets inside the rendered output root can be analysed. */
export function analysisOwnsStylesheet(
  repositoryPath: string,
  config: ResolvedConfig,
): boolean {
  if (!isStylesheetPath(repositoryPath)) return false;
  const candidate = path.resolve(config.repoRoot, repositoryPath);
  return (
    isInside(config.mockupsDir, candidate) &&
    !isPrivateStaticPath(candidate, config)
  );
}

/** Reject analysed view evidence outside the producer's resolved public scope. */
export function assertViewAnalysisScope(
  views: readonly ViewReview[],
  config: ResolvedConfig,
): void {
  for (const view of views)
    for (const reason of view.reasons ?? [])
      if (reason.analysis && !analysisOwnsStylesheet(reason.path, config))
        throw new MoklyError(
          "review-invalid",
          `analysed resource is outside stylesheet scope: ${reason.path}`,
        );
}
