/** Shared single-view render/validation with generation-local route and resource indexes. */
import type { ComponentViewRecord } from "@mokly/viewer";
import {
  validateComponentViewRecord,
  generatedViews,
} from "@mokly/viewer/data";
import type { ArtifactView } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import {
  transformCompatibilityDocuments,
  type CompatibilityContext,
} from "../compatibility/transform.js";
import { validateComponentResources } from "../components/output_validation.js";
import { validateComponentRanges } from "../components/ranges.js";
import { rebaseStyleOwnership } from "../components/style_ownership.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import {
  extractCssReferences,
  extractHtmlReferences,
} from "../html_references.js";
import { prepareRegistry } from "../registry/prepare.js";
import { normalizeSingleDocument } from "../review/ignore.js";

import type { ComponentRuntime } from "./component_runtime.js";
import { DocumentCache } from "./document_cache.js";
import type { GeneratedFile } from "./generated_file.js";
import { validateHtmlLinks, type HtmlValidationContext } from "./html_links.js";
import type { LoadedGraph } from "./load_graph.js";
import type { LogicalReferenceRecord } from "./logical_record_types.js";
import { validateLogicalFragments } from "./logical_records.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import {
  pendingGeneratedOrphanRoutes,
  validateGeneratedOwnershipHeaders,
} from "./ownership.js";
import { PendingGeneratedFiles } from "./pending_generated.js";
import { renderFragments } from "./render.js";

export interface CompiledDocument {
  route: string;
  html: string;
  view?: ComponentViewRecord;
  watchDocuments?: readonly (readonly [string, string])[];
}
interface PreparedDocument extends CompiledDocument {
  records: readonly LogicalReferenceRecord[];
  anchors: ReadonlySet<string>;
}
interface DocumentTarget extends ArtifactView {
  entryId: string;
  variantId?: string;
}

/** Pure/countable boundaries used once per accepted document generation. */
export interface DocumentValidationSeams {
  readonly orphanRoutes: (
    config: ResolvedConfig,
    expected: Iterable<string>,
  ) => readonly string[];
  readonly parseCss: (text: string) => readonly string[];
}

const defaultValidationSeams: DocumentValidationSeams = {
  orphanRoutes: pendingGeneratedOrphanRoutes,
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
    const registry = prepareRegistry(graph.definitions, runtime.config);
    this.entries = registry.entries;
    this.compatibility = { byId: registry.byId, routeIndexes: new Map() };
    this.components = new Map(
      runtime.manifest.entries.flatMap((entry) =>
        entry.kind === "component" ? [[entry.id, entry] as const] : [],
      ),
    );
    for (const entry of runtime.manifest.entries) {
      if (entry.kind === "page")
        this.routes.set(entry.route, {
          entryId: entry.id,
          viewport: "desktop",
          colorScheme: "light",
        });
      for (const view of generatedViews(entry))
        this.routes.set(view.path, {
          entryId: entry.id,
          viewport: view.viewport,
          colorScheme: view.colorScheme,
          ...(view.variantId ? { variantId: view.variantId } : {}),
        });
    }
    this.pending = new PendingGeneratedFiles(
      graph.styleOutputs,
      this.routes.keys(),
      (route) => (this.activeRead?.(route) ?? this.prepare(route)).html,
      seams.parseCss,
    );
    this.links = {
      pending: this.pending,
      pendingOrphans: new Set(
        seams.orphanRoutes(runtime.config, this.pending.routes()),
      ),
      parsed: new Map(),
      onDemand: true,
    };
  }

  /** Render and validate just this view plus references required by its contract. */
  render(
    route: string,
    componentProps?: Readonly<Record<string, unknown>>,
  ): CompiledDocument {
    const document = componentProps
      ? this.prepare(route, componentProps)
      : this.prepare(route);
    const outputs = new Map([[route, document.html]]);
    const observed = new Map<string, string>();
    const read = (target: string) => {
      const value = target === route ? document : this.prepare(target);
      if (target !== route) observed.set(target, value.html);
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
    validateGeneratedOutputPaths([route], config);
    const views = new Map<string, ArtifactView>();
    const componentViews = new Map<string, ComponentViewRecord>();
    const outputs = renderFragments(
      this.entries,
      this.graph.renderer,
      config,
      views,
      (input, renderer, components) =>
        this.graph.renderWithComponents(
          { ...input, ...(componentProps ? { componentProps } : {}) },
          renderer,
          components,
        ),
      componentViews,
      target,
      { routes: this.graph.stylesheetRoutes, pending: this.pending },
    );
    const original = outputs.get(route)!;
    const records = transformCompatibilityDocuments(
      outputs,
      this.entries,
      config,
      this.graph,
      views,
      [...this.routes.keys()],
      this.compatibility,
      this.pending,
    );
    const html = outputs.get(route)!;
    const entry = this.compatibility.byId.get(target.entryId)!;
    validateGeneratedOwnershipHeaders(
      outputs,
      new Map([[route, entry.sourceRelativePath]]),
    );
    normalizeSingleDocument(html, route);
    const captured = componentViews.get(route);
    const view = captured
      ? {
          ...captured,
          styles: rebaseStyleOwnership(original, html, captured.styles),
        }
      : undefined;
    if (view) {
      validateComponentRanges(html, view.ranges);
      validateComponentViewRecord(
        view,
        this.components,
        route,
        entry.kind === "component" ? entry.id : undefined,
      );
      validateComponentResources(
        new Map([[route, view]]),
        config,
        this.pending,
      );
    }
    const prepared = {
      route,
      html,
      records,
      anchors: extractHtmlReferences(html).anchors,
      ...(view ? { view } : {}),
    };
    if (!componentProps) this.prepared.set(route, prepared);
    return prepared;
  }
}
