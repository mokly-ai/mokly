import type { ComponentViewRecord } from "@mokly/viewer";
import {
  generatedResourceRoute,
  invalidData,
  validateResourcePath,
} from "@mokly/viewer/data";

import type { PendingGeneratedFiles } from "../build/pending_generated.js";
import { isGeneratedRoute } from "../build/styles/routes.js";
import { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";

/** Metadata cannot grant ownership of source files or missing public resources. */
export function validateComponentResources(
  views: ReadonlyMap<string, ComponentViewRecord>,
  config: ResolvedConfig,
  pending?: PendingGeneratedFiles,
  policy = new PublicFilePolicy(config),
): void {
  for (const [route, view] of views)
    for (const resource of view.resources) {
      validateResourcePath(resource.path, route);
      const decision = policy.inspect(resource.path);
      if (
        !pending?.has(generatedResourceRoute(resource.path) ?? "") &&
        (isGeneratedRoute(resource.path) || decision.kind !== "public")
      )
        invalidData(
          route,
          componentResourceFailure(
            resource.path,
            decision.kind === "private"
              ? decision.reason
              : "missing, non-regular, or outside mockupsDir",
          ),
        );
    }
}

/** Preserve one public-file diagnostic for stored owners and renderer references. */
export function componentResourceFailure(path: string, reason: string): string {
  return `component resource is not a public file: ${path} (${reason})`;
}
