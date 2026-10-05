/** Shared single-view render/validation with generation-local route and resource indexes. */
import type { ComponentViewRecord } from "@mokly/viewer";
import {
  GENERATED_DIRECTORY,
  entryRoute,
  documentRoute,
  isManifestComponentVariant,
  validateComponentViewRecord,
  generatedViews,
} from "@mokly/viewer/data";
import type { ArtifactView } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { validateComponentResources } from "../components/output_validation.js";
import { validateComponentRanges } from "../components/ranges.js";
import { rebaseStyleOwnership } from "../components/style_ownership.js";
import { PublicFilePolicy } from "../config/public_policy.js";
import { extractCssReferences } from "../css_references.js";
import { MoklyError } from "../errors.js";
import { extractHtmlReferences } from "../html_references.js";
import { prepareRegistry } from "../registry/prepare.js";
import { normalizeSingleDocument } from "../review/ignore.js";
import type { EntryMove } from "../review/moves/types.js";

import type { ComponentRuntime } from "./component_runtime.js";
import { DocumentCache } from "./document_cache.js";
import { resolveDocumentLinks } from "./document_links.js";
import type { GeneratedFile } from "./generated_file.js";
import {
  validateHtmlLinks,
  type HtmlValidationContext,
  type ResourceSeed,
} from "./html_links.js";
import type { LoadedGraph } from "./load_graph.js";
import type { LogicalReferenceRecord } from "./logical_record_types.js";
import { validateLogicalFragments } from "./logical_records.js";
import {
  moveTargetsForGeneration,
  type AcceptedMoveTargets,
} from "./move_targets.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import { assertSnapshotRoutes } from "./output_snapshot.js";
import { PendingGeneratedFiles } from "./pending_generated.js";
import { renderFragments } from "./render.js";
import { componentResourceSeeds } from "./resource_seeds.js";

export interface CompiledDocument {
  route: string;
  html: string;
  view?: ComponentViewRecord;
  watchDocuments?: readonly (readonly [string, string])[];
  assetClosure?: readonly string[];
  resourceSeeds?: readonly ResourceSeed[];
}
interface PreparedDocument extends CompiledDocument {
  records: readonly LogicalReferenceRecord[];
  anchors: ReadonlySet<string>;
}
interface DocumentTarget extends ArtifactView {
  entryId: string;
}

/** Pure/countable boundaries used once per accepted document generation. */
export interface DocumentValidationSeams {
  readonly parseCss: (text: string) => readonly string[];
}

const defaultValidationSeams: DocumentValidationSeams = {
  parseCss: extractCssReferences,
};

export class DocumentCompiler {
  readonly entries: readonly ResolvedRegistryEntry[];
  readonly routes = new Map<string, DocumentTarget>();
  private moves: readonly EntryMove[] = [];
  private readonly byId: ReadonlyMap<string, ResolvedRegistryEntry>;
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
    validateGeneratedOutputPaths(runtime.outputSnapshot.routes, runtime.config);
    const registry = prepareRegistry(
      graph.definitions,
      runtime.config,
      graph.documents,
    );
    this.entries = registry.entries;
    this.byId = registry.byPath;
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
      parsed: new Map(),
      onDemand: true,
      policy: new PublicFilePolicy(runtime.config),
    };
  }

  /** Render and validate just this view plus references required by its contract. */
  render(
    route: string,
    componentProps?: Readonly<Record<string, unknown>>,
    moveTargets?: AcceptedMoveTargets,
  ): CompiledDocument {
    this.moves = moveTargetsForGeneration(moveTargets, this.runtime.generation);
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
    let assetClosure: readonly string[];
    try {
      assetClosure = validateHtmlLinks(
        outputs,
        this.runtime.config,
        this.links,
        document.view
          ? componentResourceSeeds(new Map([[route, document.view]]))
          : [],
      );
    } finally {
      this.activeRead = undefined;
      // Generated views are resolved from the bounded document cache, never from stale prop edits.
      for (const target of this.links.parsed.keys())
        if (
          target.startsWith(`${GENERATED_DIRECTORY}/`) &&
          this.routes.has(target.slice(GENERATED_DIRECTORY.length + 1))
        )
          this.links.parsed.delete(target);
    }
    return {
      route,
      html: document.html,
      assetClosure,
      resourceSeeds: document.view
        ? componentResourceSeeds(new Map([[route, document.view]]))
        : [],
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
      {
        routes: this.graph.stylesheetRoutes,
        pending: this.pending,
        ...(this.links.policy ? { policy: this.links.policy } : {}),
      },
    );
    const original = outputs.get(route)!;
    const records = resolveDocumentLinks(
      outputs,
      this.entries,
      config,
      views,
      this.byId,
      this.moves,
    );
    const html = outputs.get(route)!;
    const entry = this.byId.get(target.entryId)!;
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
        entry.kind === "component" && "variantOf" in entry
          ? entry.variantOf
          : undefined,
      );
      validateComponentResources(
        new Map([[route, view]]),
        config,
        this.pending,
        this.links.policy,
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
