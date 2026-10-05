/** Cache closure identities without retaining either page trees or material text. */
import { createHash } from "node:crypto";

import { timingMaterialWork } from "../diagnostics/material_timings.js";
import { documentWorkSync, timeAsync } from "../diagnostics/timings.js";

import { referenceRoutes, referencedRoutes } from "./asset_references.js";

type Exclusion = (route: string) => boolean;
interface CachedResources {
  all?: Promise<ReadonlySet<string>>;
  filtered: WeakMap<Exclusion, Promise<ReadonlySet<string>>>;
}

export class ViewResourceCache {
  private readonly views = new Map<string, Map<string, CachedResources>>();
  constructor(
    private readonly collect: (
      seeds: readonly string[],
    ) => Promise<ReadonlySet<string>>,
    private readonly collectIfPresent: (
      seeds: readonly string[],
    ) => Promise<ReadonlySet<string> | undefined>,
  ) {}

  resources(
    route: string,
    html: string,
    excluded?: Exclusion,
    references?: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const { cached, discover } = this.discovery(
      route,
      html,
      excluded,
      references,
    );
    const existing = excluded ? cached.filtered.get(excluded) : cached.all;
    if (existing) return existing;
    const resources = timeAsync("review.resource-graph", () =>
      this.collect(discover()),
    );
    this.retain(cached, excluded, resources);
    return resources;
  }

  async resourcesIfPresent(
    route: string,
    html: string,
    excluded?: Exclusion,
    references?: readonly string[],
  ): Promise<ReadonlySet<string> | undefined> {
    const { cached, discover } = this.discovery(
      route,
      html,
      excluded,
      references,
    );
    const existing = excluded ? cached.filtered.get(excluded) : cached.all;
    if (existing) return existing;
    const resources = await timeAsync("review.resource-graph", () =>
      this.collectIfPresent(discover()),
    );
    if (resources) this.retain(cached, excluded, Promise.resolve(resources));
    return resources;
  }

  private retain(
    cached: CachedResources,
    excluded: Exclusion | undefined,
    resources: Promise<ReadonlySet<string>>,
  ): void {
    if (excluded) cached.filtered.set(excluded, resources);
    else cached.all = resources;
  }

  private discovery(
    route: string,
    html: string,
    excluded: Exclusion | undefined,
    references: readonly string[] | undefined,
  ) {
    let documents = this.views.get(route);
    if (!documents) {
      documents = new Map();
      this.views.set(route, documents);
    }
    const seeds =
      references === undefined ? undefined : referenceRoutes(route, references);
    const identity =
      seeds === undefined
        ? documentWorkSync("hashMs", () => {
            timingMaterialWork()?.materialHash(html);
            return createHash("sha256").update(html).digest("base64url");
          })
        : JSON.stringify(seeds);
    let cached = documents.get(identity);
    if (!cached) {
      cached = { filtered: new WeakMap() };
      documents.set(identity, cached);
    }
    return {
      cached,
      discover: () =>
        (
          seeds ?? referencedRoutes(route, html, { resourceHints: false })
        ).filter((path) => !excluded?.(path)),
    };
  }
}
