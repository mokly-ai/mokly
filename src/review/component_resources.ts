import { parseHtml } from "../diagnostics/html_parse.js";
import { documentResourceReferences } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";

import { referencedRoutes, referenceRoutes } from "./asset_references.js";
import type { ReviewAssetReader } from "./assets.js";
import type { CssDocument } from "./css/document.js";
import {
  analyzeResourceDocument,
  type ResourceDocumentAnalysis,
} from "./resource_document_analysis.js";
import { normalizeResourceDocuments } from "./resource_documents.js";
import { ResourceGraph } from "./resource_graph.js";
import { collectStylesheetScope } from "./stylesheet_scope.js";
import { prefetchProofReads } from "./resource_proof_reads.js";
import {
  ViewResourceCache,
  type ViewResourceOptions,
} from "./view_resources.js";

type ResourceExclusion = (route: string) => boolean;

/** One immutable read cache per source side; it never copies or writes snapshots. */
export class ComponentMaterialReader {
  private readonly canReadOptionally: boolean;
  private readonly files = new Map<string, Promise<Uint8Array>>();
  private readonly optional = new Map<
    string,
    Promise<Uint8Array | undefined>
  >();
  private readonly graph: ResourceGraph;
  private componentAware = false;
  private readonly documents = new Map<
    string,
    Promise<ResourceDocumentAnalysis>
  >();
  private counterpart?: ComponentMaterialReader;
  private missingResource?: (route: string) => boolean;
  private side: "before" | "after" = "after";
  private readonly normalized = new Map<string, Promise<string>>();
  private readonly viewResources = new ViewResourceCache(
    (seeds) => this.graph.collect(seeds),
    (seeds) =>
      this.graph.collect(seeds, (routes) => this.prefetchProof(routes)),
  );
  constructor(private readonly reader: ReviewAssetReader) {
    this.canReadOptionally = Boolean(
      reader.readIfExists || reader.readManyIfExists,
    );
    this.graph = new ResourceGraph({
      prefetch: (routes) => this.prefetchResources(routes),
      readReferences: (route) => this.resourceReferences(route),
    });
  }
  /** Permit a missing current resource only while comparison verifies its baseline side. */
  allowMissingResources(predicate: (route: string) => boolean): void {
    this.missingResource = predicate;
  }
  useOriginalDocuments(): void {
    this.componentAware = true;
  }

  async resourceDocument(route: string): Promise<CssDocument> {
    return this.componentAware
      ? (await this.documentAnalysis(route, "resourceMatching")).document
      : parseHtml("resourceMatching", await this.resourceText(route));
  }

  private documentAnalysis(
    route: string,
    step: "resourceReference" | "resourceMatching",
  ): Promise<ResourceDocumentAnalysis> {
    let result = this.documents.get(route);
    if (!result) {
      result = (async () =>
        analyzeResourceDocument(
          await this.text(route),
          (await this.counterpart?.optionalTexts([route]))?.get(route),
          route,
          step,
        ))();
      this.documents.set(route, result);
    }
    return result;
  }
  /** Bind immutable source sides before traversing embedded-document resources. */
  pairWith(
    counterpart: ComponentMaterialReader,
    side: "before" | "after",
  ): void {
    this.counterpart = counterpart;
    this.side = side;
  }

  /** Embedded documents use the same paired ignore policy for edges and selectors. */
  resourceText(route: string): Promise<string> {
    if (!/\.(css|html?)$/i.test(route)) return this.text(route);
    let normalized = this.normalized.get(route);
    if (!normalized) {
      normalized = this.normalizeResource(route);
      this.normalized.set(route, normalized);
    }
    return normalized;
  }

  private async normalizeResource(route: string): Promise<string> {
    const text = await this.text(route);
    if (!/\.html?$/i.test(route)) return text;
    const other = (await this.counterpart?.optionalTexts([route]))?.get(route);
    const pair = normalizeResourceDocuments(
      this.side === "before" ? text : other,
      this.side === "after" ? text : other,
      route,
    );
    return pair[this.side] ?? "";
  }
  /** Load known view documents together without changing lazy resource discovery. */
  async prefetch(routes: readonly string[]): Promise<void> {
    if (!this.reader.readMany) return;
    for (const route of routes) {
      const optional = this.optional.get(route);
      if (optional && !this.files.has(route)) {
        const content = await optional;
        if (content !== undefined)
          this.files.set(route, Promise.resolve(content));
      }
    }
    const missing = [...new Set(routes)].filter(
      (route) => !this.files.has(route),
    );
    if (missing.length === 0) {
      await Promise.all(routes.map((route) => this.files.get(route)));
      return;
    }
    const loaded = this.reader.readMany(missing);
    for (const route of missing) {
      this.files.set(
        route,
        loaded.then((files) => {
          const content = files.get(route);
          if (content === undefined)
            throw new MoklyError(
              "review-invalid",
              `could not retain Review asset ${route}: batch reader omitted the file`,
            );
          return content;
        }),
      );
    }
    await Promise.all(missing.map((route) => this.files.get(route)));
  }
  read(route: string): Promise<Uint8Array> {
    let result = this.files.get(route);
    if (!result) {
      const optional = this.optional.get(route);
      result = optional
        ? optional.then((content) => content ?? this.reader.read(route))
        : this.reader.read(route);
      this.files.set(route, result);
    }
    return result;
  }
  async text(route: string): Promise<string> {
    return Buffer.from(await this.read(route)).toString("utf8");
  }
  /** Read an optional resource through the same validated and cached boundary. */
  async readIfExists(route: string): Promise<Uint8Array | undefined> {
    const required = this.files.get(route);
    if (required) return required;
    if (!this.canReadOptionally) return this.read(route);
    await this.optionalTexts([route]);
    return this.optional.get(route)!;
  }
  /** Read eligible CSS or embedded-document counterparts, allowing additions/removals. */
  async optionalTexts(
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, string | undefined>> {
    const missing = [...new Set(routes)].filter(
      (route) => !this.files.has(route) && !this.optional.has(route),
    );
    const loaded = missing.length
      ? this.reader.readManyIfExists?.(missing)
      : undefined;
    for (const route of missing)
      this.optional.set(
        route,
        loaded
          ? loaded.then((files) => {
              if (!files.has(route))
                throw new MoklyError(
                  "review-invalid",
                  `batch reader omitted the file: ${route}`,
                );
              return files.get(route);
            })
          : (this.reader.readIfExists?.(route) ?? Promise.resolve(undefined)),
      );
    const texts = new Map<string, string | undefined>();
    for (const route of routes) {
      const bytes = await (this.files.get(route) ?? this.optional.get(route));
      texts.set(
        route,
        bytes === undefined ? undefined : Buffer.from(bytes).toString("utf8"),
      );
    }
    return texts;
  }
  async resources(
    route: string,
    html: string,
    excluded?: ResourceExclusion,
    options?: ViewResourceOptions,
  ): Promise<ReadonlySet<string>> {
    return this.viewResources.resources(route, html, excluded, options);
  }

  /** A missing base file anywhere in a proof closure means fall-through. */
  resourcesIfPresent(
    route: string,
    html: string,
    excluded?: ResourceExclusion,
    options?: ViewResourceOptions,
  ): Promise<ReadonlySet<string> | undefined> {
    return this.viewResources.resourcesIfPresent(
      route,
      html,
      excluded,
      options,
    );
  }

  private async prefetchProof(routes: readonly string[]): Promise<boolean> {
    if (this.canReadOptionally) {
      const files = await this.optionalTexts(routes);
      return routes.every((route) => files.get(route) !== undefined);
    }
    return prefetchProofReads(this.reader, this.files, routes);
  }

  /** CSS imports share a document; embedded HTML starts its own stylesheet scope. */
  async stylesheets(
    route: string,
    html: string,
    options: ViewResourceOptions = {},
  ): Promise<ReadonlySet<string>> {
    const references =
      options.references !== undefined
        ? referenceRoutes(route, options.references)
        : this.componentAware &&
            /\.html?$/i.test(route) &&
            html === (await this.resourceText(route))
          ? await this.graph.references(route)
          : referencedRoutes(route, html, { resourceHints: false });
    return collectStylesheetScope(
      [...references, ...(options.insertedStylesheets ?? [])],
      (path) => this.graph.references(path),
    );
  }

  private async prefetchResources(routes: readonly string[]): Promise<void> {
    const optional = routes.filter((route) => this.mayBeMissing(route));
    if (optional.length) await this.optionalTexts(optional);
    await this.prefetch(routes.filter((route) => !this.mayBeMissing(route)));
  }

  private async resourceReferences(route: string): Promise<readonly string[]> {
    if (
      this.mayBeMissing(route) &&
      (await this.optionalTexts([route])).get(route) === undefined
    )
      return [];
    const text = await this.resourceText(route);
    if (
      this.componentAware &&
      /\.html?$/i.test(route) &&
      text === (await this.text(route))
    )
      return referenceRoutes(
        route,
        (await this.documentAnalysis(route, "resourceReference")).references,
      );
    return documentResourceReferences(() =>
      referencedRoutes(route, text, { resourceHints: false }),
    );
  }

  private mayBeMissing(route: string): boolean {
    return this.canReadOptionally && this.missingResource?.(route) === true;
  }
}
