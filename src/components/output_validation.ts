import path from "node:path";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData, validateResourcePath } from "@mokly/viewer/data";

import type { PendingGeneratedFiles } from "../build/pending_generated.js";
import { isGeneratedRoute } from "../build/styles/routes.js";
import {
  isPublicStaticFile,
  publicFileFailureReason,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";

/** Metadata cannot grant ownership of source files or missing public resources. */
export function validateComponentResources(
  views: ReadonlyMap<string, ComponentViewRecord>,
  config: ResolvedConfig,
  pending?: PendingGeneratedFiles,
): void {
  for (const [route, view] of views)
    for (const resource of view.resources) {
      validateResourcePath(resource.path, route);
      const candidate = path.resolve(config.mockupsDir, resource.path);
      if (
        !pending?.has(resource.path) &&
        (isGeneratedRoute(resource.path) ||
          !isPublicStaticFile(candidate, config))
      )
        invalidData(
          route,
          `component resource is not a public file: ${resource.path} (${publicFileFailureReason(candidate, config) ?? "missing, non-regular, or outside mockupsDir"})`,
        );
    }
}
