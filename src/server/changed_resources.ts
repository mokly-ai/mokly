/** Resource impact follows rendered references rather than source dependencies. */

import path from "node:path";

import { parse } from "parse5";

import { isStylesheetPath } from "@mokly/viewer/data";

import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import { referencedRoutes } from "../review/asset_references.js";
import type {
  OptionalReviewAssetReader,
  ReviewAssetReader,
} from "../review/assets.js";
import { ComponentMaterialReader } from "../review/component_resources.js";
import type { CssDocumentPair } from "../review/css/document.js";
import {
  CssResourceAnalysis,
  type ChangedResource,
  type ResourceEvidence,
} from "../review/css/resource_analysis.js";
import { normalizeReviewPair } from "../review/ignore.js";
import { ResourceGraph } from "../review/resource_graph.js";

/** Cache shared resource edges for one immutable changed-route calculation. */
export class ChangedResourceGraph {
  readonly #physicalRoutes = new Map<string, string>();
  readonly #contents = new Map<string, string>();
  readonly #rawContents = new Map<string, string>();
  readonly #viewResources = new Map<
    string,
    { document: string; resources: ReadonlySet<string> }
  >();
  readonly #base: ComponentMaterialReader;
  readonly #head: ComponentMaterialReader;
  readonly #baseGraph: ResourceGraph;
  readonly #byteChanges = new Set<string>();
  readonly #graph = new ResourceGraph({
    readReferences: (route) => this.references(route),
  });

  constructor(
    private readonly reader: OptionalReviewAssetReader,
    private readonly baseline: ReviewAssetReader,
    private readonly changed: ReadonlySet<string>,
    private readonly documents: ReadonlyMap<string, string>,
    private readonly css: CssResourceAnalysis = new CssResourceAnalysis(),
    private readonly compareBytes = false,
  ) {
    this.#base = new ComponentMaterialReader(baseline);
    this.#head = new ComponentMaterialReader({
      read: async (route) =>
        this.#rawContents.has(route)
          ? Buffer.from(this.#rawContents.get(route)!)
          : reader.read(route),
      readIfExists: async (route) =>
        this.#rawContents.has(route)
          ? Buffer.from(this.#rawContents.get(route)!)
          : reader.readIfExists(route),
    });
    this.#base.pairWith(this.#head, "before");
    this.#head.pairWith(this.#base, "after");
    this.#baseGraph = new ResourceGraph({
      prefetch: (routes) =>
        this.#base.prefetch(
          routes.filter((route) => /\.(css|html?)$/i.test(route)),
        ),
      readReferences: async (route) =>
        /\.(css|html?)$/i.test(route)
          ? referencedRoutes(route, await this.#base.resourceText(route), {
              resourceHints: false,
            })
          : [],
    });
  }

  /** Inspect transitive local references, terminating even for cyclic imports. */
  async hasChangedStylesheet(
    source: string,
    document: string,
  ): Promise<boolean> {
    return [...(await this.resources(source, document))].some(
      (route) => isStylesheetPath(route) && this.isChanged(route),
    );
  }

  private async resources(
    source: string,
    document: string,
  ): Promise<ReadonlySet<string>> {
    const cached = this.#viewResources.get(source);
    if (cached?.document === document) return cached.resources;
    const resources = await timeAsync("review.resource-graph", () =>
      this.#graph.collect(
        referencedRoutes(source, document, { resourceHints: false }),
      ),
    );
    this.#viewResources.set(source, { document, resources });
    return resources;
  }

  /** Analyse CSS only after current resource discovery establishes eligibility. */
  async compare(
    source: string,
    document: string,
    before?: { path: string; html: string },
  ): Promise<ResourceEvidence & { resourceChanged?: true }> {
    const resources = await this.resources(source, document);
    const changedStylesheet = [...resources].some(
      (route) => isStylesheetPath(route) && this.isChanged(route),
    );
    const changedDocument =
      before && (before.path !== source || before.html !== document);
    const bases =
      before && (this.compareBytes || changedStylesheet || changedDocument)
        ? await this.#baseGraph.collect(
            referencedRoutes(before.path, before.html, {
              resourceHints: false,
            }),
          )
        : new Set<string>();
    const all = [...new Set([...bases, ...resources])];
    const eligible = all.filter(
      (route) =>
        this.changed.has(route) ||
        this.changed.has(this.#physicalRoutes.get(route) ?? route),
    );
    const cssPaths = eligible.filter(isStylesheetPath);
    const baseCss = await this.#base.optionalTexts(cssPaths);
    const changes: ChangedResource[] = [];
    for (const route of eligible) {
      const after = isStylesheetPath(route)
        ? (this.#contents.get(route) ??
          (await this.reader
            .readIfExists(route)
            .then((bytes) =>
              bytes === undefined
                ? undefined
                : Buffer.from(bytes).toString("utf8"),
            )))
        : undefined;
      changes.push({
        path: this.changed.has(route)
          ? route
          : this.#physicalRoutes.get(route)!,
        ...(baseCss.get(route) === undefined
          ? {}
          : { before: baseCss.get(route)! }),
        ...(after === undefined ? {} : { after }),
      });
    }
    const pairs: CssDocumentPair[] = cssPaths.length
      ? [
          {
            ...(before ? { before: parse(before.html) } : {}),
            after: parse(document),
          },
        ]
      : [];
    for (const route of all.filter(
      (route) => cssPaths.length && /\.html?$/i.test(route),
    )) {
      const base = bases.has(route)
        ? await this.#base.resourceText(route)
        : undefined;
      const head =
        resources.has(route) && this.#contents.has(route)
          ? await this.#head.resourceText(route)
          : undefined;
      pairs.push({
        ...(base === undefined ? {} : { before: parse(base) }),
        ...(head === undefined ? {} : { after: parse(head) }),
      });
    }
    return {
      ...this.css.analyze(changes, pairs),
      ...(all.some(
        (route) => this.#byteChanges.has(route) && !eligible.includes(route),
      )
        ? { resourceChanged: true as const }
        : {}),
    };
  }

  private isChanged(route: string): boolean {
    return (
      this.#byteChanges.has(route) ||
      this.changed.has(route) ||
      this.changed.has(this.#physicalRoutes.get(route) ?? route)
    );
  }

  private async references(route: string): Promise<readonly string[]> {
    let content = this.documents.get(route);
    if (content === undefined) {
      const asset = await this.reader.readLocated(route);
      this.#physicalRoutes.set(route, asset.location.physicalRelativePath);
      const bytes = asset.content;
      if (bytes === undefined) {
        if (!this.compareBytes && !this.isChanged(route))
          throw new MoklyError(
            "review-invalid",
            `referenced resource is missing: ${route}`,
          );
        await this.#base.prefetch([route]);
        await this.#base.read(route);
        this.#byteChanges.add(route);
        return [];
      }
      const extension = path.posix.extname(route).toLowerCase();
      if (this.compareBytes) {
        const before = this.baseline.readIfExists
          ? await this.baseline.readIfExists(route)
          : await this.baseline.read(route);
        if (before === undefined) this.#byteChanges.add(route);
        else if ([".html", ".htm"].includes(extension)) {
          const pair = normalizeReviewPair(
            Buffer.from(before).toString("utf8"),
            Buffer.from(bytes).toString("utf8"),
            route,
          );
          if (pair.base !== pair.head) this.#byteChanges.add(route);
        } else if (!Buffer.from(before).equals(bytes))
          this.#byteChanges.add(route);
      }
      if (![".css", ".html", ".htm"].includes(extension)) return [];
      content = Buffer.from(bytes).toString("utf8");
      this.#rawContents.set(route, content);
      if (extension !== ".css") content = await this.#head.resourceText(route);
    }
    this.#contents.set(route, content);
    return referencedRoutes(route, content, { resourceHints: false });
  }
}
