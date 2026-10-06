/** Shared single-view render/validation with generation-local route and resource indexes. */
import type { ComponentViewRecord } from "@mokly/viewer";
import {
  entryRoute,
  documentRoute,
  isManifestComponentVariant,
  generatedViews,
} from "@mokly/viewer/data";
import type { ArtifactView } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import {
  transformCompatibilityDocuments,
  type CompatibilityContext,
} from "../compatibility/transform.js";
import type { LinkedComponentStylesheet } from "../components/render.js";
import { extractCssReferences } from "../css_references.js";
import { MoklyError } from "../errors.js";
import { extractHtmlReferences } from "../html_references.js";
import { prepareRegistry } from "../registry/prepare.js";
import { normalizeSingleDocument } from "../review/ignore.js";

import {
  normalizeBuildDiagnostics,
  isLinkControlDiagnostic,
  type BuildDiagnostic,
} from "./build_warnings.js";
import type { ComponentRuntime } from "./component_runtime.js";
import { DocumentCache } from "./document_cache.js";
import { finalizeDocumentView } from "./document_components.js";
import type {
  CompiledDocument,
  DocumentTarget,
  PreparedDocument,
} from "./document_types.js";
import type { GeneratedFile } from "./generated_file.js";
import { validateHtmlLinks, type HtmlValidationContext } from "./html_links.js";
import type { LoadedGraph } from "./load_graph.js";
import { validateLogicalFragments } from "./logical_records.js";
import {
  moveTargetsForGeneration,
  type AcceptedMoveTargets,
} from "./move_targets.js";
import {
  assertSnapshotRoutes,
  type OutputSnapshot,
} from "./output_snapshot.js";
import { validateGeneratedOwnershipHeaders } from "./ownership.js";
import { PendingGeneratedFiles } from "./pending_generated.js";
import { renderFragments } from "./render.js";

/** Pure/countable boundaries used once per accepted document generation. */
export interface DocumentValidationSeams {
  readonly orphanRoutes: (snapshot: OutputSnapshot) => readonly string[];
  readonly parseCss: (text: string) => readonly string[];
}

const defaultValidationSeams: DocumentValidationSeams = {
  orphanRoutes: (snapshot) => snapshot.orphanRoutes,
  parseCss: extractCssReferences,
};

export class DocumentCompiler {
  readonly entries: readonly ResolvedRegistryEntry[];
  readonly routes = new Map<string, DocumentTarget>();
  private readonly compatibility: CompatibilityContext;
  private readonly components;
  private readonly prepared = new DocumentCache<PreparedDocument>(
    32 * 1024 * 1024,
    (value) =>
      Buffer.byteLength(
        JSON.stringify({ ...value, anchors: [...value.anchors] }),
      ),
  );
  private readonly links: HtmlValidationContext;
  private readonly pending: PendingGeneratedFiles;
  private activeRead: ((route: string) => PreparedDocument) | undefined;

  constructor(
    readonly runtime: ComponentRuntime,
    private readonly graph: LoadedGraph,
    seams: DocumentValidationSeams = defaultValidationSeams,
  ) {
    const registry = prepareRegistry(
      graph.definitions,
      runtime.config,
      graph.documents,
    );
    this.entries = registry.entries;
    this.compatibility = { byPath: registry.byPath, routeIndexes: new Map() };
    this.components = new Map(
      runtime.manifest.entries.flatMap((entry) =>
        entry.kind === "component" && !isManifestComponentVariant(entry)
          ? [[entry.path, entry] as const]
          : [],
      ),
    );
    for (const entry of runtime.manifest.entries) {
      if (entry.kind === "document")
        for (const colorScheme of entry.colorSchemes)
          this.routes.set(documentRoute(entry.path, colorScheme), {
            entryId: entry.path,
            viewport: "desktop",
            colorScheme,
          });
      if (entry.kind === "page")
        this.routes.set(entryRoute(entry.path), {
          entryId: entry.path,
          viewport: "desktop",
          colorScheme: "light",
        });
      for (const view of generatedViews(entry))
        this.routes.set(view.path, {
          entryId: entry.path,
          viewport: view.viewport,
          colorScheme: view.colorScheme,
        });
    }
    this.pending = new PendingGeneratedFiles(
      graph.styleOutputs,
      this.routes.keys(),
      (route) => (this.activeRead?.(route) ?? this.prepare(route)).html,
      seams.parseCss,
    );
    assertSnapshotRoutes(runtime.outputSnapshot, this.pending.routes());
    this.links = {
      pending: this.pending,
      pendingOrphans: new Set(seams.orphanRoutes(runtime.outputSnapshot)),
      parsed: new Map(),
      onDemand: true,
    };
  }

  /** Render and validate just this view plus references required by its contract. */
  render(
    route: string,
    componentProps?: Readonly<Record<string, unknown>>,
    moveTargets?: AcceptedMoveTargets,
  ): CompiledDocument {
    this.compatibility.moves = moveTargetsForGeneration(
      moveTargets,
      this.runtime.generation,
    );
    const document = componentProps
      ? this.prepare(route, componentProps)
      : this.prepare(route);
    const outputs = new Map([[route, document.html]]);
    const observed = new Map<string, string>();
    const warnings = [...(document.diagnostics ?? [])];
    const read = (target: string) => {
      const value = target === route ? document : this.prepare(target);
      if (target !== route) {
        observed.set(target, value.html);
        warnings.push(
          ...value.diagnostics.filter(
            (warning) => !isLinkControlDiagnostic(warning),
          ),
        );
      }
      return value;
    };
    validateLogicalFragments(
      outputs,
      document.records,
      this.entries,
      this.runtime.config,
      (target) => read(target).anchors,
    );
    this.activeRead = read;
    try {
      validateHtmlLinks(outputs, this.runtime.config, this.links);
    } finally {
      this.activeRead = undefined;
      // Generated views are resolved from the bounded document cache, never from stale prop edits.
      for (const target of this.links.parsed.keys())
        if (this.routes.has(target)) this.links.parsed.delete(target);
    }
    return {
      diagnostics: normalizeBuildDiagnostics(warnings),
      route,
      html: document.html,
      ...(document.view ? { view: document.view } : {}),
      ...(observed.size ? { watchDocuments: [...observed] } : {}),
    };
  }

  /** Read one accepted pending route without consulting reserved files on disk. */
  readGeneratedFile(route: string): GeneratedFile | undefined {
    const file = this.pending.get(route);
    return file?.kind === "bytes" ? file.bytes : file?.text;
  }

  private prepare(
    route: string,
    componentProps?: Readonly<Record<string, unknown>>,
  ): PreparedDocument {
    const cached = !componentProps && this.prepared.get(route);
    if (cached) return cached;
    const target = this.routes.get(route);
    if (!target)
      throw new MoklyError(
        "build-invalid",
        `unknown generated document: ${route}`,
      );
    const config = this.runtime.config;
    const views = new Map<string, ArtifactView>();
    const componentViews = new Map<string, ComponentViewRecord>();
    const warnings: BuildDiagnostic[] = [];
    const stylesheetLinks = new Map<
      string,
      readonly LinkedComponentStylesheet[]
    >();
    const outputs = renderFragments(
      this.entries,
      this.graph.renderer,
      config,
      views,
      (input, renderer, components, placement) =>
        this.graph.renderWithComponents(
          { ...input, ...(componentProps ? { componentProps } : {}) },
          renderer,
          components,
          placement,
        ),
      componentViews,
      target,
      { routes: this.graph.stylesheetRoutes, pending: this.pending },
      (warning) => warnings.push(warning),
      stylesheetLinks,
    );
    const original = outputs.get(route)!;
    const compatibility = transformCompatibilityDocuments(
      outputs,
      this.entries,
      config,
      this.graph,
      views,
      [...this.routes.keys()],
      this.compatibility,
      this.pending,
    );
    let html = outputs.get(route)!;
    const entry = this.compatibility.byPath.get(target.entryId)!;
    validateGeneratedOwnershipHeaders(
      outputs,
      new Map([[route, entry.sourceRelativePath]]),
    );
    const finalized = finalizeDocumentView({
      route,
      entry,
      original,
      html,
      captured: componentViews.get(route),
      config,
      links: stylesheetLinks.get(route) ?? [],
      components: this.components,
      pending: this.pending,
    });
    html = finalized.html;
    const view = finalized.view;
    normalizeSingleDocument(html, route);
    const prepared = {
      diagnostics: normalizeBuildDiagnostics([
        ...warnings,
        ...compatibility.diagnostics,
      ]),
      route,
      html,
      records: compatibility.records,
      anchors: extractHtmlReferences(html).anchors,
      ...(view ? { view } : {}),
    };
    if (!componentProps) this.prepared.set(route, prepared);
    return prepared;
  }
}
