import type { ComponentViewRecord } from "@mokly/viewer";
import type { ManifestV10, ArtifactView } from "@mokly/viewer/data";

import { validateComponentResources } from "../components/output_validation.js";
import type { LinkedComponentStylesheet } from "../components/render.js";
import { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync, timingCounts } from "../diagnostics/timings.js";
import {
  gitBlobHash,
  RepositoryObjectFormatReader,
} from "../registry/blob_hash.js";
import { generatedDocumentRoutes } from "../registry/generated_documents.js";
import {
  createManifest,
  MANIFEST_NAME,
  parseManifest,
  serializeManifest,
} from "../registry/manifest.js";
import { prepareRegistry } from "../registry/prepare.js";
import { normalizeSingleDocument } from "../review/ignore.js";

import {
  normalizeBuildDiagnostics,
  type BuildDiagnostic,
} from "./build_warnings.js";
import { finalizeCompiledViews } from "./compile_components.js";
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
import {
  captureOutputSnapshot,
  assertSnapshotRoutes,
  type OutputSnapshot,
} from "./output_snapshot.js";
import { PendingGeneratedFiles } from "./pending_generated.js";
import { renderFragments } from "./render.js";
import { renderCooperatively } from "./render_cooperative.js";
import { componentResourceSeeds, type ResourceSeed } from "./resource_seeds.js";

/** Complete in-memory static compilation result. */
export interface Compilation {
  diagnostics: readonly BuildDiagnostic[];
  manifest: ManifestV10;
  outputs: ReadonlyMap<string, GeneratedFile>;
  /** Repository-relative inputs of delivered CSS and asset routes. */
  deliveredStyleSources: readonly string[];
  /** Accepted authored Markdown bodies, keyed by repository source path. */
  documentMarkdown?: ReadonlyMap<string, string>;
  /** Private closure references without component ownership or comparison meaning. */
  resourceSeeds?: readonly ResourceSeed[];
}

/** Compile all expected bytes without mutating consumer output. */
export async function compileCatalogue(
  config: ResolvedConfig,
  accepted?: {
    graph: LoadedGraph;
    checkpoint: () => Promise<void>;
    outputSnapshot: OutputSnapshot;
  },
  signal?: AbortSignal,
  onWarning?: (warning: BuildDiagnostic) => void,
): Promise<Compilation> {
  return timeAsync("compile", () =>
    compileMeasured(config, accepted, signal, onWarning),
  );
}

async function compileMeasured(
  config: ResolvedConfig,
  accepted?: {
    graph: LoadedGraph;
    checkpoint: () => Promise<void>;
    outputSnapshot: OutputSnapshot;
  },
  signal?: AbortSignal,
  onWarning?: (warning: BuildDiagnostic) => void,
): Promise<Compilation> {
  const warnings: BuildDiagnostic[] = [];
  const recordWarning = (warning: BuildDiagnostic) => {
    warnings.push(warning);
    onWarning?.(warning);
  };
  config.diagnostics?.forEach(recordWarning);
  const graph = accepted?.graph ?? (await loadConsumerGraph(config));
  config = {
    ...config,
    ...graph.discovery,
    entryModules: graph.entrySources,
    sourceFiles: graph.sourceFiles,
  };
  const registry = timeSync("registry.prepare", () =>
    prepareRegistry(graph.definitions, config, graph.documents, recordWarning),
  );
  validateGeneratedOutputPaths(
    [
      MANIFEST_NAME,
      ...generatedDocumentRoutes(
        createManifest(registry.entries, graph.sourceFiles, config.colorSchemes)
          .entries,
      ),
      ...graph.styleOutputs.keys(),
    ],
    config,
  );
  timingCounts("catalogue", () => ({
    entries: registry.entries.length,
    ...Object.fromEntries(
      ["screen", "component", "use-case", "page", "document"].map((kind) => [
        kind,
        registry.entries.filter((entry) => entry.kind === kind).length,
      ]),
    ),
  }));
  const fragmentViews = new Map<string, ArtifactView>();
  const componentViews = new Map<string, ComponentViewRecord>();
  const rendererResourceSeeds: ResourceSeed[] = [];
  const stylesheetLinks = new Map<
    string,
    readonly LinkedComponentStylesheet[]
  >();
  const pending = new PendingGeneratedFiles(graph.styleOutputs);
  const policy = new PublicFilePolicy(config);
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
          policy,
          recordWarning,
          stylesheetLinks,
          rendererResourceSeeds,
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
          { routes: graph.stylesheetRoutes, pending, policy },
          recordWarning,
          stylesheetLinks,
          rendererResourceSeeds,
        ),
      );
  pending.addHtmlMap(outputs);
  await accepted?.checkpoint();
  const resolvedLinks = timeSync("html.links", () =>
    resolveDocumentLinks(
      outputs,
      registry.entries,
      config,
      fragmentViews,
      undefined,
      [],
      recordWarning,
    ),
  );
  pending.addHtmlMap(outputs);
  timeSync("components.validate-metadata", () => {
    finalizeCompiledViews(
      outputs,
      componentViews,
      stylesheetLinks,
      config.mockupsDir,
    );
  });
  pending.addHtmlMap(outputs);
  timeSync("html.logical-links", () =>
    validateLogicalFragments(
      outputs,
      resolvedLinks.records,
      registry.entries,
      config,
    ),
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
      registry.folders,
    ),
  );
  timeSync("components.validate-resources", () =>
    validateComponentResources(componentViews, config, pending, policy),
  );
  await accepted?.checkpoint();
  const resourceSeeds = [
    ...componentResourceSeeds(componentViews),
    ...rendererResourceSeeds,
  ];
  const assetClosure = timeSync("html.links-and-resources", () =>
    validateHtmlLinks(
      outputs,
      config,
      {
        pending,
        parsed: new Map(),
        onDemand: false,
        policy,
      },
      resourceSeeds,
    ),
  );
  const compilationOutputs = new Map<string, GeneratedFile>(outputs);
  for (const [route, content] of graph.styleOutputs)
    compilationOutputs.set(route, content);
  const blobHashAlgorithm = new RepositoryObjectFormatReader().format(
    config.repoRoot,
  );
  const manifest: ManifestV10 = {
    ...draftManifest,
    assetClosure,
    blobHashAlgorithm,
    generatedFiles: [...compilationOutputs]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, content]) => ({
        path,
        blobHash: gitBlobHash(generatedBytes(content), blobHashAlgorithm),
      })),
    schemaVersion: 10,
  };
  timeSync("manifest.validate", () => parseManifest(manifest));
  timeSync("manifest.serialize", () =>
    compilationOutputs.set(MANIFEST_NAME, serializeManifest(manifest)),
  );
  const outputSnapshot =
    accepted?.outputSnapshot ??
    (await captureOutputSnapshot(compilationOutputs.keys(), config, signal));
  assertSnapshotRoutes(outputSnapshot, compilationOutputs.keys());
  timeSync("output.paths", () =>
    validateGeneratedOutputPaths(compilationOutputs.keys(), config),
  );
  const compilation: Compilation = {
    diagnostics: normalizeBuildDiagnostics(warnings),
    manifest,
    outputs: compilationOutputs,
    ...(resourceSeeds.length ? { resourceSeeds } : {}),
    deliveredStyleSources: graph.deliveredStyleSources,
    documentMarkdown: new Map(
      (graph.documents ?? []).map((entry) => [
        entry.sourceRelativePath,
        entry.markdown,
      ]),
    ),
  };
  timeSync("runtime.retain", () =>
    rememberRuntime(compilation, graph, config, outputSnapshot),
  );
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
