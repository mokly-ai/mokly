import { isStylesheetPath } from "@mokly/viewer/data";
import type { ResourceEvidence, ReviewResultV7 } from "@mokly/viewer/data";

import type { DocumentPair } from "./changed_document_pairs.js";

/** Reuse the complete classifier's screen CSS while preserving live non-CSS policy. */
export function classifiedScreenCss(
  result: ReviewResultV7 | undefined,
  view: DocumentPair["view"],
  prefix: string,
): ResourceEvidence | undefined {
  if (!result || !view) return undefined;
  const evidence = result.screens
    .find((screen) => screen.path === view.path)
    ?.views.find(
      (candidate) =>
        candidate.viewport === view.viewport &&
        candidate.colorScheme === view.colorScheme,
    );
  if (!evidence) return undefined;
  const relative = (path: string) =>
    prefix ? path.slice(prefix.length + 1) : path;
  const reasons =
    evidence.reasons
      ?.filter((reason) => isStylesheetPath(reason.path))
      .map((reason) => ({ ...reason, path: relative(reason.path) })) ?? [];
  const excludedResources =
    evidence.excludedResources?.map((resource) => ({
      ...resource,
      path: relative(resource.path),
    })) ?? [];
  return {
    ...(reasons.length ? { reasons } : {}),
    ...(excludedResources.length ? { excludedResources } : {}),
  };
}
