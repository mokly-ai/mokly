/** Discover the current consumer resources without generating comparisons. */

import path from "node:path";

import type { ReviewArtifactContent } from "@mokly/viewer/data";

import type { Compilation } from "../build/compile.js";
import { isOwned } from "../build/ownership.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import { referencedRoutes } from "../review/asset_references.js";
import { FileSystemReviewAssetReader } from "../review/assets.js";
import { ResourceGraph } from "../review/resource_graph.js";

import {
  configuredStylesheetPaths,
  isPackageOwnedIgnoredWatchPath,
} from "./watch_events.js";

/** Reachable inputs and recovery edges from one resource-discovery pass. */
export interface ResourceWatchSnapshot {
  readonly invalid: ReadonlySet<string>;
  readonly paths: ReadonlySet<string>;
  readonly references: ReadonlyMap<string, readonly string[]>;
  readonly locations: ReadonlyMap<string, readonly string[]>;
}

/** Keep live ignored-region resources observable without changing Changes semantics. */
export async function discoverWatchResources(
  config: ResolvedConfig,
  compilation: Pick<Compilation, "outputs">,
  previous?: ResourceWatchSnapshot,
  allowInvalid = false,
): Promise<ResourceWatchSnapshot> {
  const reader = new FileSystemReviewAssetReader(config);
  const references = new Map<string, readonly string[]>();
  const invalid = new Set<string>();
  const locations = new Map<string, readonly string[]>();
  const stylesheets = configuredStylesheetPaths(config).filter(
    (stylesheet) => !/^https?:\/\//.test(stylesheet),
  );
  const configured = new Set(stylesheets);
  const graph = new ResourceGraph({
    async readReferences(route): Promise<readonly string[]> {
      const logical = path.resolve(config.mockupsDir, route);
      let content: ReviewArtifactContent | undefined =
        compilation.outputs.get(route);
      if (content === undefined) locations.set(route, [logical]);
      try {
        if (content === undefined) {
          const asset = await reader.readLocated(route);
          locations.set(route, [
            ...new Set([logical, asset.location.physicalPath]),
          ]);
          if (asset.content === undefined) {
            throw new MoklyError(
              "review-invalid",
              `referenced resource is missing: ${route}`,
            );
          }
          content = asset.content;
        }
        const edges = referencedRoutes(route, content, {
          resourceHints: false,
        });
        references.set(route, edges);
        return edges;
      } catch (error) {
        if (!allowInvalid) throw error;
        invalid.add(route);
        const edges = previous?.references.get(route) ?? [];
        references.set(route, edges);
        locations.set(route, [
          ...new Set([
            ...(locations.get(route) ?? []),
            ...(previous?.locations.get(route) ?? []),
          ]),
        ]);
        return edges;
      }
    },
  });
  const documents = [...compilation.outputs.keys()].filter((route) =>
    /\.(?:html?|css)$/i.test(route),
  );
  const reachable = await graph.collect(documents);
  const paths = new Set<string>();
  for (const route of reachable) {
    if (compilation.outputs.has(route) || configured.has(route)) continue;
    for (const candidate of locations.get(route) ?? []) {
      if (
        !isPackageOwnedIgnoredWatchPath(candidate, config) &&
        !isOwned(candidate, config)
      )
        paths.add(candidate);
    }
  }
  return { paths, references, locations, invalid };
}
