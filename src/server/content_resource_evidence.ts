import type { ResourceEvidence } from "@mokly/viewer/data";

/** Project discovered public resource routes into the repository-relative evidence space. */
export function contentResourceEvidence(
  evidence: ResourceEvidence,
  repositoryPath: (route: string) => string,
): ResourceEvidence {
  return {
    ...(evidence.reasons
      ? {
          reasons: evidence.reasons.map((reason) => ({
            ...reason,
            path: repositoryPath(reason.path),
          })),
        }
      : {}),
    ...(evidence.excludedResources
      ? {
          excludedResources: evidence.excludedResources.map((resource) => ({
            ...resource,
            path: repositoryPath(resource.path),
          })),
        }
      : {}),
  };
}
