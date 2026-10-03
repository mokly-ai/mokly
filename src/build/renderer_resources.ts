import fs from "node:fs";
import path from "node:path";

import { invalidData, validateResourcePath } from "@mokly/viewer/data";

import { isPublicStaticFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import type { Renderer } from "../renderer/types.js";

import type { PendingGeneratedFiles } from "./pending_generated.js";
import { isGeneratedRoute } from "./styles/routes.js";
import {
  ignoredStylesheetResourceOwner,
  type BuildWarning,
} from "./warnings.js";

/** Discard stylesheet assertions only after validating their public file identity. */
export function rendererWithoutCssOwners(
  renderer: Renderer,
  route: string,
  config: ResolvedConfig,
  pending?: PendingGeneratedFiles,
  onWarning?: (warning: BuildWarning) => void,
): Renderer {
  return (input) => {
    const result = renderer(input);
    if (typeof result === "string" || !result.resources) return result;
    const warned = new Set<string>();
    const resources = result.resources.filter((resource) => {
      validateResourcePath(resource.path, route);
      let identity: string;
      let stylesheet: boolean;
      if (isGeneratedRoute(resource.path)) {
        if (!pending?.has(resource.path))
          invalidData(
            route,
            `renderer resource is not a public file: ${resource.path}`,
          );
        identity = `generated:${resource.path}`;
        stylesheet = pending.stylesheetRoutes().includes(resource.path);
      } else {
        const candidate = path.resolve(config.mockupsDir, resource.path);
        if (!isPublicStaticFile(candidate, config))
          invalidData(
            route,
            `renderer resource is not a public file: ${resource.path}`,
          );
        identity = fs.realpathSync(candidate);
        stylesheet = /\.css$/i.test(resource.path) || /\.css$/i.test(identity);
      }
      if (!stylesheet) return true;
      if (!warned.has(identity)) {
        warned.add(identity);
        onWarning?.(
          ignoredStylesheetResourceOwner(route, identity, resource.path),
        );
      }
      return false;
    });
    return { ...result, resources };
  };
}
