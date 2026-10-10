import {
  generatedResourceRoute,
  invalidData,
  validateResourcePath,
} from "@mokly/viewer/data";

import { componentResourceFailure } from "../components/output_validation.js";
import { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";
import type { Renderer } from "../renderer/types.js";

import { type BuildDiagnostic } from "./build_warnings.js";
import type { ResourceSeed } from "./html_links.js";
import type { PendingGeneratedFiles } from "./pending_generated.js";
import { isGeneratedRoute } from "./styles/routes.js";
import { ignoredStylesheetResourceOwner } from "./warnings.js";

/** Discard stylesheet assertions only after validating their public file identity. */
export function rendererWithoutCssOwners(
  renderer: Renderer,
  route: string,
  config: ResolvedConfig,
  pending?: PendingGeneratedFiles,
  onWarning?: (warning: BuildDiagnostic) => void,
  onStylesheetResource?: (seed: ResourceSeed) => void,
): Renderer {
  return (input) => {
    const result = renderer(input);
    if (typeof result === "string" || !result.resources) return result;
    const policy = new PublicFilePolicy(config);
    const warned = new Set<string>();
    const resources = result.resources.filter((resource) => {
      validateResourcePath(resource.path, route);
      let identity: string;
      let stylesheet: boolean;
      if (isGeneratedRoute(resource.path)) {
        const generatedRoute = generatedResourceRoute(resource.path);
        if (!generatedRoute || !pending?.has(generatedRoute))
          invalidData(
            route,
            `renderer resource is not a public file: ${resource.path}`,
          );
        identity = `generated:${resource.path}`;
        stylesheet = pending.stylesheetRoutes().includes(generatedRoute);
      } else {
        const decision = policy.inspect(resource.path);
        if (decision.kind !== "public")
          invalidData(
            route,
            componentResourceFailure(
              resource.path,
              decision.kind === "private"
                ? decision.reason
                : "missing, non-regular, or outside mockupsDir",
            ),
          );
        identity = decision.location.physicalPath;
        stylesheet = /\.css$/i.test(resource.path) || /\.css$/i.test(identity);
      }
      if (!stylesheet) return true;
      onStylesheetResource?.({ path: resource.path, sourceRoute: route });
      if (!warned.has(identity)) {
        warned.add(identity);
        onWarning?.(ignoredStylesheetResourceOwner(route, resource.path));
      }
      return false;
    });
    return { ...result, resources };
  };
}
