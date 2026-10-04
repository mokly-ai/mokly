import type { ComponentViewRecord } from "@mokly/viewer";
import {} from "@mokly/viewer/data";
import type { ManifestV8, ArtifactView } from "@mokly/viewer/data";

import { validateComponentResources } from "../components/output_validation.js";
import { validateComponentRanges } from "../components/ranges.js";
import { rebaseStyleOwnership } from "../components/style_ownership.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync, timingCounts } from "../diagnostics/timings.js";
import {
  gitBlobHash,
  RepositoryObjectFormatReader,
} from "../registry/blob_hash.js";
import {
  createManifest,
  MANIFEST_NAME,
  parseManifest,
  serializeManifest,
} from "../registry/manifest.js";
import { prepareRegistry } from "../registry/prepare.js";
import { normalizeSingleDocument } from "../review/ignore.js";

import { rememberRuntime } from "./component_runtime.js";
import { resolveDocumentLinks } from "./document_links.js";
import {
  generatedByteLength,
  generatedBytes,
  type GeneratedFile,
} from "./generated_file.js";
import { validateHtmlLinks } from "./html_links.js";
import { loadConsumerGraph, type LoadedGraph } from "./load_graph.js";
import { validateLogicalFragments } from "./logical_records.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import { PendingGeneratedFiles } from "./pending_generated.js";
import { renderFragments } from "./render.js";
import { renderCooperatively } from "./render_cooperative.js";

/** Complete in-memory static compilation result. */
export interface Compilation {
  manifest: ManifestV8;
  outputs: ReadonlyMap<string, GeneratedFile>;
  /** Repository-relative inputs of delivered CSS and asset routes. */
  deliveredStyleSources: readonly string[];
}

/** Compile all expected bytes without mutating consumer output. */
export async function compileCatalogue(
  config: ResolvedConfig,
  accepted?: { graph: LoadedGraph; checkpoint: () => Promise<void> },
): Promise<Compilation> {
  return timeAsync("compile", () => compileMeasured(config, accepted));
}

async function compileMeasured(
  config: ResolvedConfig,
  accepted?: { graph: LoadedGraph; checkpoint: () => Promise<void> },
): Promise<Compilation> {
  const graph = accepted?.graph ?? (await loadConsumerGraph(config));
  config = {
    ...config,
    entryModules: graph.entrySources,
    sourceFiles: graph.sourceFiles,
  };
  const registry = timeSync("registry.prepare", () =>
    prepareRegistry(graph.definitions, config),
  );
  timingCounts("catalogue", () => ({
    entries: registry.entries.length,
    ...Object.fromEntries(
      ["screen", "component", "use-case", "page"].map((kind) => [
        kind,
        registry.entries.filter((entry) => entry.kind === kind).length,
      ]),
    ),
  }));
  const fragmentViews = new Map<string, ArtifactView>();
  const componentViews = new Map<string, ComponentViewRecord>();
  const pending = new PendingGeneratedFiles(graph.styleOutputs);
  const outputs = accepted
    ? await timeAsync("render", () =>
        renderCooperatively(
          registry.entries,
          graph,
          config,
          fragmentViews,
          componentViews,
          accepted.checkpoint,
          pending,
        ),
      )
    : timeSync("render", () =>
        renderFragments(
          registry.entries,
          graph.renderer,
          config,
          fragmentViews,
          graph.renderWithComponents,
          componentViews,
          undefined,
          { routes: graph.stylesheetRoutes, pending },
        ),
      );
  pending.addHtmlMap(outputs);
  const beforeLinks = new Map(outputs);
  await accepted?.checkpoint();
  const logicalRecords = timeSync("html.links", () =>
    resolveDocumentLinks(outputs, registry.entries, config, fragmentViews),
  );
  pending.addHtmlMap(outputs);
  timeSync("components.validate-metadata", () => {
    for (const [route, view] of componentViews) {
      const final = outputs.get(route)!;
      validateComponentRanges(final, view.ranges);
      componentViews.set(route, {
        ...view,
        styles: rebaseStyleOwnership(
          beforeLinks.get(route)!,
          final,
          view.styles,
        ),
      });
    }
  });
  timeSync("html.logical-links", () =>
    validateLogicalFragments(outputs, logicalRecords, registry.entries, config),
  );
  await accepted?.checkpoint();
  timeSync("html.ignore-rules", () => {
    for (const [route, content] of outputs) {
      normalizeSingleDocument(content, route);
    }
  });
  const draftManifest = timeSync("manifest.create", () =>
    createManifest(
      registry.entries,
      graph.sourceFiles,
      config.colorSchemes,
      componentViews,
    ),
  );
  timeSync("components.validate-resources", () =>
    validateComponentResources(componentViews, config, pending),
  );
  await accepted?.checkpoint();
  const resourceSeeds = [...componentViews.values()].flatMap((view) =>
    view.resources.map((resource) => resource.path),
  );
  const assetClosure = timeSync("html.links-and-resources", () =>
    validateHtmlLinks(
      outputs,
      config,
      { pending, parsed: new Map(), onDemand: false },
      resourceSeeds,
    ),
  );
  const compilationOutputs = new Map<string, GeneratedFile>(outputs);
  for (const [route, content] of graph.styleOutputs)
    compilationOutputs.set(route, content);
  const blobHashAlgorithm = new RepositoryObjectFormatReader().format(
    config.repoRoot,
  );
  const manifest: ManifestV8 = {
    ...draftManifest,
    assetClosure,
    blobHashAlgorithm,
    generatedFiles: [...compilationOutputs]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, content]) => ({
        path,
        blobHash: gitBlobHash(generatedBytes(content), blobHashAlgorithm),
      })),
    schemaVersion: 8,
  };
  timeSync("manifest.validate", () => parseManifest(manifest));
  timeSync("manifest.serialize", () =>
    compilationOutputs.set(MANIFEST_NAME, serializeManifest(manifest)),
  );
  timeSync("output.paths", () =>
    validateGeneratedOutputPaths(compilationOutputs.keys(), config),
  );
  const compilation = {
    manifest,
    outputs: compilationOutputs,
    deliveredStyleSources: graph.deliveredStyleSources,
  };
  timeSync("runtime.retain", () => rememberRuntime(compilation, graph, config));
  timingCounts("output", () => ({
    files: compilationOutputs.size,
    views: fragmentViews.size,
    componentViews: componentViews.size,
    bytes: [...compilationOutputs.values()].reduce(
      (total, content) => total + generatedByteLength(content),
      0,
    ),
    manifestBytes: generatedByteLength(compilationOutputs.get(MANIFEST_NAME)!),
    instances: [...componentViews.values()].reduce(
      (total, view) => total + view.instances.length,
      0,
    ),
  }));
  return compilation;
}
