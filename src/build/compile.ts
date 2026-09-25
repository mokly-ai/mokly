import type { ComponentViewRecord } from "@mokly/viewer";
import {
  componentFragmentRoute,
  effectiveColorSchemes,
  VIEWPORTS,
} from "@mokly/viewer/data";
import type { ManifestV5, ArtifactView } from "@mokly/viewer/data";

import { transformCompatibilityDocuments } from "../compatibility/transform.js";
import { validateComponentResources } from "../components/output_validation.js";
import { validateComponentRanges } from "../components/ranges.js";
import { rebaseStyleOwnership } from "../components/style_ownership.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync, timingCounts } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import {
  createManifest,
  fragmentRoute,
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
import { renderFragments } from "./render.js";
import { renderCooperatively } from "./render_cooperative.js";

/** Complete in-memory static compilation result. */
export interface Compilation {
  manifest: ManifestV5;
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
      ["collection", "screen", "component", "use-case", "page"].map((kind) => [
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
  const routedEntries = new Set(
    registry.entries.flatMap((entry) =>
      entry.kind === "collection" ? [] : [entry.route],
    ),
  );
  const generatedOwners = new Map<string, string>();
  for (const entry of registry.entries) {
    if (entry.kind === "page")
      generatedOwners.set(entry.route, entry.sourceRelativePath);
    if (entry.kind !== "screen" && entry.kind !== "component") continue;
    for (const variantId of entry.kind === "component"
      ? entry.variants.map((variant) => variant.id)
      : [undefined]) {
      for (const viewport of VIEWPORTS) {
        for (const colorScheme of effectiveColorSchemes(
          entry,
          config.colorSchemes,
        )) {
          generatedOwners.set(
            variantId
              ? componentFragmentRoute(
                  entry.route,
                  variantId,
                  viewport,
                  colorScheme,
                )
              : fragmentRoute(entry.route, viewport, colorScheme),
            entry.sourceRelativePath,
          );
        }
      }
    }
  }
  const fragmentRoutes = new Set(
    [...generatedOwners.keys()].filter(
      (route) =>
        !registry.entries.some(
          (entry) => entry.kind === "page" && entry.route === route,
        ),
    ),
  );
  for (const route of routedEntries) {
    if (fragmentRoutes.has(route)) {
      throw new MoklyError(
        "build-invalid",
        `fragment route collides with registry route: ${route}`,
      );
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
      const final = outputs.get(route)!;
      validateComponentRanges(final, view.ranges);
      componentViews.set(route, {
        ...view,
        styles: rebaseStyleOwnership(
          beforeTransform.get(route)!,
          final,
          view.styles,
        ),
      });
    }
  });
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
