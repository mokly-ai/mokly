import path from "node:path";

import { type ArtifactView } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { walkFiles } from "../build/discovery.js";
import { validateControlMetadata } from "../build/link_control_metadata.js";
import { adaptLinkControls } from "../build/link_controls.js";
import type { LoadedGraph } from "../build/load_graph.js";
import type { LogicalReferenceRecord } from "../build/logical_record_types.js";
import { validateCompatibilityRecords } from "../build/logical_records.js";
import { artifactRouteForEntry } from "../build/mock_link_routes.js";
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
  const byPath =
    context?.byPath ?? new Map(entries.map((entry) => [entry.path, entry]));
  const records: LogicalReferenceRecord[] = [];
  const outputRoutes = [...outputs.keys()];
  const availableRoutes = graph.compatibilityTransformer
    ? (context?.availableRoutes ??
      availablePublicRoutes(retainedRoutes ?? outputRoutes, config))
    : [];
  if (context && graph.compatibilityTransformer)
    context.availableRoutes = availableRoutes;
  const routeIndexes = new Map<string, LogicalArtifactRouteIndex>();
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
      byPath,
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
  byPath: ReadonlyMap<string, ResolvedRegistryEntry>;
  availableRoutes?: string[];
  routeIndexes: Map<string, LogicalArtifactRouteIndex>;
}

type LogicalArtifactRouteIndex = Readonly<Record<string, string>>;

function logicalArtifactRoutes(
  entries: readonly ResolvedRegistryEntry[],
  viewport: Parameters<typeof artifactRouteForEntry>[1],
  colorScheme: Parameters<typeof artifactRouteForEntry>[2],
  catalogueSchemes: Parameters<typeof artifactRouteForEntry>[4],
): LogicalArtifactRouteIndex {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  return Object.assign(
    Object.create(null) as Record<string, string>,
    Object.fromEntries(
      entries.flatMap((entry) => {
        const artifact = artifactRouteForEntry(
          entry,
          viewport,
          colorScheme,
          byPath,
          catalogueSchemes,
        );
        return artifact ? [[entry.path, artifact] as const] : [];
      }),
    ),
  );
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
