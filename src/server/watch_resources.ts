/** Watch the same checked public closure that the compiler publishes. */
import path from "node:path";

import type { Compilation } from "../build/compile.js";
import {
  buildPublicClosure,
  type ResourceSeed,
  type PublicClosureSnapshot,
} from "../build/html_links.js";
import { PendingGeneratedFiles } from "../build/pending_generated.js";
import { manifestResourceSeeds } from "../build/resource_seeds.js";
import type { ResolvedConfig } from "../config/types.js";
import type { CatalogueMetadata } from "../registry/catalogue_index.js";
import { generatedDocumentRoutes } from "../registry/generated_documents.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import {
  configuredStylesheetPaths,
  isPackageOwnedIgnoredWatchPath,
  isRecoverablePublicResource,
} from "./watch_paths.js";

export interface WatchCompilation extends Pick<Compilation, "outputs"> {
  readonly manifest?: CatalogueMetadata;
  readonly resourceSeeds?: readonly ResourceSeed[];
}

/** Recovery targets are observable but never grant serving authority. */
export interface ResourceWatchSnapshot extends PublicClosureSnapshot {
  readonly paths: ReadonlySet<string>;
}

export async function discoverWatchResources(
  config: ResolvedConfig,
  compilation: WatchCompilation,
  previous?: ResourceWatchSnapshot,
  allowInvalid = false,
): Promise<ResourceWatchSnapshot> {
  const documents = new Map(
    [...compilation.outputs].flatMap(([route, content]) =>
      typeof content === "string" && /\.html?$/i.test(route)
        ? [[route, content] as const]
        : [],
    ),
  );
  const routes = compilation.manifest
    ? generatedDocumentRoutes(compilation.manifest.entries)
    : [];
  const pending = new PendingGeneratedFiles(
    new Map(
      [...compilation.outputs].filter(
        ([name]) => name !== MANIFEST_NAME && !/\.html?$/i.test(name),
      ),
    ),
    routes,
  );
  pending.addHtmlMap(documents);
  const snapshot = buildPublicClosure(
    documents,
    config,
    {
      pending,
      parsed: new Map(),
      onDemand: compilation.manifest?.schemaVersion === "live-index-2",
      watch: true,
    },
    compilation.resourceSeeds ??
      (compilation.manifest ? manifestResourceSeeds(compilation.manifest) : []),
    allowInvalid || previous !== undefined
      ? (previous ?? {
          closure: new Set(),
          references: new Map(),
          locations: new Map(),
          invalid: new Set(),
        })
      : undefined,
  );
  const configured = new Set(configuredStylesheetPaths(config));
  const paths = new Set<string>();
  for (const [route, locations] of snapshot.locations) {
    if (configured.has(route)) continue;
    for (const candidate of locations)
      if (
        !isPackageOwnedIgnoredWatchPath(candidate, config) ||
        isRecoverablePublicResource(candidate, config)
      )
        paths.add(path.resolve(candidate));
  }
  return { ...snapshot, paths };
}
