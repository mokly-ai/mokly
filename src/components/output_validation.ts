import path from "node:path";

import {
  isPublicStaticFile,
  publicFileFailureReason,
} from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";

import { invalidData } from "./data.js";
import type { ComponentViewRecord } from "./manifest_types.js";
import { validateResourcePath } from "./validation_helpers.js";

/** Metadata cannot grant ownership of source files or missing public resources. */
export function validateComponentResources(
  views: ReadonlyMap<string, ComponentViewRecord>,
  config: ResolvedConfig,
): void {
  for (const [route, view] of views)
    for (const resource of view.resources) {
      validateResourcePath(resource.path, route);
      const candidate = path.resolve(config.mockupsDir, resource.path);
      if (!isPublicStaticFile(candidate, config))
        invalidData(
          route,
          `component resource is not a public file: ${resource.path} (${publicFileFailureReason(candidate, config) ?? "missing, non-regular, or outside mockupsDir"})`,
        );
    }
}
