import { createHash } from "node:crypto";

import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";

import { referencedRoutes } from "./asset_references.js";
import type { ReviewAssetReader } from "./assets.js";
import { normalizeResourceDocuments } from "./resource_documents.js";
import { ResourceGraph } from "./resource_graph.js";

type ResourceExclusion = (route: string) => boolean;

interface CachedViewResources {
  all?: Promise<ReadonlySet<string>>;
  filtered: WeakMap<ResourceExclusion, Promise<ReadonlySet<string>>>;
}

/** One immutable read cache per source side; it never copies or writes snapshots. */
export class ComponentMaterialReader {
  private readonly files = new Map<string, Promise<Uint8Array>>();
  private readonly optional = new Map<
    string,
    Promise<Uint8Array | undefined>
  >();
  private readonly graph: ResourceGraph;
  private counterpart?: ComponentMaterialReader;
  private side: "before" | "after" = "after";
  private readonly normalized = new Map<string, Promise<string>>();
  private readonly viewResources = new Map<
    string,
    Map<string, CachedViewResources>
  >();
  constructor(
    private readonly reader: ReviewAssetReader,
    readonly generated: {
      readonly prefix: string;
      readonly routes: ReadonlySet<string>;
    } = { prefix: "", routes: new Set() },
  ) {
    this.graph = new ResourceGraph({
      prefetch: (routes) => this.prefetch(routes),
      readReferences: async (route) =>
        referencedRoutes(
          route,
          await this.resourceText(route),
          {
            resourceHints: false,
          },
          this.generated,
        ),
    });
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
      {
        before:
          this.side === "before"
            ? this.generated.prefix
            : (this.counterpart?.generated.prefix ?? ""),
        after:
          this.side === "after"
            ? this.generated.prefix
            : (this.counterpart?.generated.prefix ?? ""),
      },
    );
    return pair[this.side] ?? "";
  }
  /** Load known view documents together without changing lazy resource discovery. */
  async prefetch(routes: readonly string[]): Promise<void> {
    if (!this.reader.readMany) return;
    for (const route of routes) {
      const optional = this.optional.get(route);
      if (optional && !this.files.has(route))
        this.files.set(
          route,
          optional.then((content) => {
            if (content === undefined)
              throw new MoklyError(
                "review-invalid",
                `referenced resource is missing: ${route}`,
              );
            return content;
          }),
        );
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
        ? optional.then((content) => {
            if (content === undefined)
              throw new MoklyError(
                "review-invalid",
                `referenced resource is missing: ${route}`,
              );
            return content;
          })
        : this.reader.read(route);
      this.files.set(route, result);
    }
    return result;
  }
  async text(route: string): Promise<string> {
    return Buffer.from(await this.read(route)).toString("utf8");
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
  ): Promise<ReadonlySet<string>> {
    let documents = this.viewResources.get(route);
    if (!documents) {
      documents = new Map();
      this.viewResources.set(route, documents);
    }
    const digest = createHash("sha256").update(html).digest("base64url");
    let cached = documents.get(digest);
    if (!cached) {
      cached = { filtered: new WeakMap() };
      documents.set(digest, cached);
    }
    const existing = excluded ? cached.filtered.get(excluded) : cached.all;
    if (existing) return existing;
    const resources = timeAsync("review.resource-graph", () => {
      const seeds = referencedRoutes(
        route,
        html,
        {
          resourceHints: false,
        },
        this.generated,
      ).filter((path) => !excluded?.(path));
      return this.graph.collect(seeds);
    });
    if (excluded) cached.filtered.set(excluded, resources);
    else cached.all = resources;
    return resources;
  }
}
