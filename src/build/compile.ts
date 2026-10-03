import type { ComponentViewRecord } from "@mokly/viewer";
import {
  entryRoute,
  effectiveColorSchemes,
  viewRoute,
  VIEWPORTS,
} from "@mokly/viewer/data";
import type { ManifestV8, ArtifactView } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { transformCompatibilityDocuments } from "../compatibility/transform.js";
import { validateComponentResources } from "../components/output_validation.js";
import { validateComponentRanges } from "../components/ranges.js";
import { rebaseStyleOwnership } from "../components/style_ownership.js";
import { finalizeComponentStylesheets } from "../components/stylesheet_provenance.js";
import {
  isComponentVariantDefinition,
  type ComponentDefinition,
} from "../components/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync, timingCounts } from "../diagnostics/timings.js";
import {
  createManifest,
  MANIFEST_NAME,
  parseManifest,
  serializeManifest,
} from "../registry/manifest.js";
import { prepareRegistry } from "../registry/prepare.js";
import { normalizeSingleDocument } from "../review/ignore.js";

import { rememberRuntime } from "./component_runtime.js";
import { generatedByteLength, type GeneratedFile } from "./generated_file.js";
import { validateHtmlLinks } from "./html_links.js";
import { loadConsumerGraph, type LoadedGraph } from "./load_graph.js";
import { validateLogicalFragments } from "./logical_records.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import { validateGeneratedOwnershipHeaders } from "./ownership.js";
import { PendingGeneratedFiles } from "./pending_generated.js";
import { renderFragments, stylesheetPlacementFor } from "./render.js";
import { renderCooperatively } from "./render_cooperative.js";
import type { BuildWarning } from "./warnings.js";

/** Complete in-memory static compilation result. */
export interface Compilation {
  manifest: ManifestV8;
  outputs: ReadonlyMap<string, GeneratedFile>;
  /** Repository-relative inputs of delivered CSS and asset routes. */
  deliveredStyleSources: readonly string[];
  warnings?: readonly BuildWarning[];
}

/** Compile all expected bytes without mutating consumer output. */
export async function compileCatalogue(
  config: ResolvedConfig,
  accepted?: { graph: LoadedGraph; checkpoint: () => Promise<void> },
  onWarning?: (warning: BuildWarning) => void,
): Promise<Compilation> {
  return timeAsync("compile", () =>
    compileMeasured(config, accepted, onWarning),
  );
}

async function compileMeasured(
  config: ResolvedConfig,
  accepted?: { graph: LoadedGraph; checkpoint: () => Promise<void> },
  onWarning?: (warning: BuildWarning) => void,
): Promise<Compilation> {
  const warnings: BuildWarning[] = [];
  const recordWarning = (warning: BuildWarning) => {
    warnings.push(warning);
    onWarning?.(warning);
  };
  config.warnings?.forEach(recordWarning);
  const graph = accepted?.graph ?? (await loadConsumerGraph(config));
  config = {
    ...config,
    entryModules: graph.entrySources,
    sourceFiles: graph.sourceFiles,
  };
  const registry = timeSync("registry.prepare", () =>
    prepareRegistry(graph.definitions, config, recordWarning),
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
          recordWarning,
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
          recordWarning,
        ),
      );
  pending.addHtmlMap(outputs);
  const generatedOwners = new Map<string, string>();
  const catalogueRoutes = new Map<
    string,
    { route: string; entryRoot?: string }
  >();
  for (const entry of registry.entries) {
    if (entry.kind === "page")
      generatedOwners.set(
        entryRoute("page", entry.id),
        entry.sourceRelativePath,
      );
    if (
      entry.kind !== "screen" &&
      !(entry.kind === "component" && isComponentVariantDefinition(entry))
    )
      continue;
    {
      for (const viewport of VIEWPORTS) {
        for (const colorScheme of effectiveColorSchemes(
          entry,
          config.colorSchemes,
        )) {
          const route = viewRoute(entry.kind, entry.id, viewport, colorScheme);
          generatedOwners.set(route, entry.sourceRelativePath);
          catalogueRoutes.set(route, {
            route: entryRoute(entry.kind, entry.id),
            ...(entry.entryRoot ? { entryRoot: entry.entryRoot } : {}),
          });
        }
      }
    }
  }
  const beforeTransform = new Map(outputs);
  await accepted?.checkpoint();
  const logicalRecords = timeSync("html.compatibility", () =>
    transformCompatibilityDocuments(
      outputs,
      registry.entries,
      config,
      graph,
      fragmentViews,
      undefined,
      undefined,
      pending,
    ),
  );
  pending.addHtmlMap(outputs);
  timeSync("components.validate-metadata", () => {
    for (const [route, view] of componentViews) {
      const original = beforeTransform.get(route)!;
      const finalized = finalizeComponentStylesheets(
        original,
        outputs.get(route)!,
        view,
        route,
        config.mockupsDir,
        registry.entries.filter(
          (entry): entry is ComponentDefinition & ResolvedRegistryEntry =>
            entry.kind === "component" && !isComponentVariantDefinition(entry),
        ),
        stylesheetPlacementFor(
          catalogueRoutes.get(route)!.route,
          route,
          fragmentViews.get(route)!.colorScheme,
          config,
          catalogueRoutes.get(route)!.entryRoot,
          { routes: graph.stylesheetRoutes, pending },
        ).hrefs,
      );
      outputs.set(route, finalized.html);
      validateComponentRanges(finalized.html, view.ranges);
      componentViews.set(route, {
        ...finalized.view,
        styles: rebaseStyleOwnership(original, finalized.html, view.styles),
      });
    }
  });
  pending.addHtmlMap(outputs);
  timeSync("html.ownership", () =>
    validateGeneratedOwnershipHeaders(outputs, generatedOwners),
  );
  timeSync("html.logical-links", () =>
    validateLogicalFragments(outputs, logicalRecords, registry.entries, config),
  );
  await accepted?.checkpoint();
  timeSync("html.ignore-rules", () => {
    for (const [route, content] of outputs) {
      normalizeSingleDocument(content, route);
    }
  });
  const manifest = timeSync("manifest.create", () =>
    createManifest(
      registry.entries,
      graph.sourceFiles,
      config.colorSchemes,
      componentViews,
    ),
  );
  timeSync("manifest.validate", () => parseManifest(manifest));
  timeSync("components.validate-resources", () =>
    validateComponentResources(componentViews, config, pending),
  );
  await accepted?.checkpoint();
  timeSync("manifest.serialize", () =>
    outputs.set(MANIFEST_NAME, serializeManifest(manifest)),
  );
  timeSync("html.links-and-resources", () =>
    validateHtmlLinks(outputs, config, {
      pending,
      parsed: new Map(),
      onDemand: false,
    }),
  );
  const compilationOutputs = new Map<string, GeneratedFile>(outputs);
  for (const [route, content] of graph.styleOutputs)
    compilationOutputs.set(route, content);
  timeSync("output.paths", () =>
    validateGeneratedOutputPaths(compilationOutputs.keys(), config),
  );
  const compilation = {
    manifest,
    outputs: compilationOutputs,
    deliveredStyleSources: graph.deliveredStyleSources,
    ...(warnings.length ? { warnings } : {}),
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
    manifestBytes: generatedByteLength(outputs.get(MANIFEST_NAME)!),
    instances: [...componentViews.values()].reduce(
      (total, view) => total + view.instances.length,
      0,
    ),
  }));
  return compilation;
}
