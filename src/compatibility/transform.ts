import path from "node:path";

import type { ArtifactView } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { walkFiles } from "../build/discovery.js";
import { validateControlMetadata } from "../build/link_control_metadata.js";
import { adaptLinkControls } from "../build/link_controls.js";
import type { LoadedGraph } from "../build/load_graph.js";
import type { LogicalReferenceRecord } from "../build/logical_record_types.js";
import { validateCompatibilityRecords } from "../build/logical_records.js";
import { logicalArtifactRoutes } from "../build/logical_routes.js";
import { rewriteMockLinks } from "../build/mock_links.js";
import { pendingGeneratedOrphanRoutes } from "../build/ownership.js";
import { toPosixPath } from "../config/paths.js";
import { isPublicStaticFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

/** Resolve catalogue id links and apply an explicitly configured migration bridge. */
export function transformCompatibilityDocuments(
  outputs: Map<string, string>,
  entries: readonly ResolvedRegistryEntry[],
  config: ResolvedConfig,
  graph: LoadedGraph,
  fragmentViews: ReadonlyMap<string, ArtifactView>,
  retainedRoutes?: readonly string[],
  context?: CompatibilityContext,
): readonly LogicalReferenceRecord[] {
  const byId =
    context?.byId ?? new Map(entries.map((entry) => [entry.id, entry]));
  const records: LogicalReferenceRecord[] = [];
  const outputRoutes = [...outputs.keys()];
  const availableRoutes = graph.compatibilityTransformer
    ? (context?.availableRoutes ??
      availablePublicRoutes(retainedRoutes ?? outputRoutes, config))
    : [];
  if (context && graph.compatibilityTransformer)
    context.availableRoutes = availableRoutes;
  const routeIndexes = new Map<
    string,
    ReturnType<typeof logicalArtifactRoutes>
  >();
  const indexes = context?.routeIndexes ?? routeIndexes;
  for (const [route, original] of outputs) {
    const { colorScheme, viewport } = fragmentViews.get(route) ?? {
      colorScheme: "light",
      viewport: "desktop",
    };
    const linked = rewriteMockLinks(
      adaptLinkControls(original, route),
      route,
      viewport,
      colorScheme,
      byId,
      config.colorSchemes,
    );
    records.push(...linked.records);
    const transformer = graph.compatibilityTransformer;
    if (!transformer) {
      outputs.set(route, linked.content);
      continue;
    }
    const routeIndexKey = `${viewport}:${colorScheme}`;
    let logicalRoutes = indexes.get(routeIndexKey);
    if (!logicalRoutes) {
      logicalRoutes = logicalArtifactRoutes(
        entries,
        viewport,
        colorScheme,
        config.colorSchemes,
      );
      indexes.set(routeIndexKey, logicalRoutes);
    }
    let transformed: string;
    try {
      transformed = transformer({
        availableRoutes,
        colorScheme,
        content: linked.content,
        logicalRoutes,
        outputPath: toPosixPath(
          path.relative(config.repoRoot, path.join(config.mockupsDir, route)),
        ),
        route,
        viewport,
      });
    } catch (error) {
      throw new MoklyError(
        "build-invalid",
        `compatibility transformer failed for ${route}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
    if (typeof transformed !== "string" || !/<html[\s>]/i.test(transformed)) {
      throw new MoklyError(
        "build-invalid",
        `compatibility transformer must return a complete HTML document for ${route}`,
      );
    }
    const normalized = transformed.endsWith("\n")
      ? transformed
      : `${transformed}\n`;
    validateControlMetadata(linked.content, normalized, route);
    validateCompatibilityRecords(route, normalized, linked.records);
    outputs.set(route, normalized);
  }
  return records;
}

/** Immutable-route indexes reused across documents of one consumer generation. */
export interface CompatibilityContext {
  byId: ReadonlyMap<string, ResolvedRegistryEntry>;
  availableRoutes?: string[];
  routeIndexes: Map<string, ReturnType<typeof logicalArtifactRoutes>>;
}

function availablePublicRoutes(
  outputRoutes: readonly string[],
  config: ResolvedConfig,
): string[] {
  const nextRoutes = [...outputRoutes, MANIFEST_NAME];
  const pendingOrphans = new Set(
    pendingGeneratedOrphanRoutes(config, nextRoutes),
  );
  const publicRoutes = walkFiles(config.mockupsDir)
    .filter((candidate) => isPublicStaticFile(candidate, config))
    .map((candidate) =>
      toPosixPath(path.relative(config.mockupsDir, candidate)),
    )
    .filter((route) => !pendingOrphans.has(route));
  return [...new Set([...nextRoutes, ...publicRoutes])].sort();
}
