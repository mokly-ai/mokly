import { createHash } from "node:crypto";

import type { ManifestEntry } from "@mokly/viewer/data";

import { isValidGeneratedRoute } from "../../build/styles/routes.js";
import { rewriteCssReferences } from "../../css_references.js";
import { documentResourceIndex } from "../../documents/resource_references.js";
import {
  referencedRoutes,
  resolveResourceReference,
} from "../asset_references.js";
import type { ReviewAssetReader } from "../assets.js";

import { moveDocuments } from "./content.js";
import { pairedResourceRoutes } from "./resource_routes.js";
import { moveIdentity, type EntryMove } from "./types.js";

export type MoveSide = "before" | "after";

/** Retained byte evidence and generation-local logical resource identities. */
export class MoveResources {
  readonly before: ReadonlyMap<string, string>;
  readonly after: ReadonlyMap<string, string>;
  private readonly equal: ReadonlyMap<string, string>;
  constructor(
    private readonly baseBytes: ReadonlyMap<string, Uint8Array> = new Map(),
    private readonly headBytes: ReadonlyMap<string, Uint8Array> = new Map(),
    private readonly pairs?: ReadonlyMap<string, string>,
    private readonly baseViews: ReadonlyMap<
      string,
      ReadonlySet<string>
    > = new Map(),
    private readonly headViews: ReadonlyMap<
      string,
      ReadonlySet<string>
    > = new Map(),
  ) {
    this.before = resourceDigests(baseBytes);
    this.after = resourceDigests(headBytes);
    const equal = new Map<string, string>();
    if (pairs)
      for (const [base, head] of pairs) {
        const left = baseBytes.get(base),
          right = headBytes.get(head);
        if (
          left &&
          right &&
          Buffer.from(this.material("before", base, left)).equals(
            Buffer.from(this.material("after", head, right)),
          )
        )
          equal.set(base, head);
      }
    this.equal = equal;
  }

  paired(
    before: readonly ManifestEntry[],
    after: readonly ManifestEntry[],
    moves: readonly EntryMove[],
  ): MoveResources {
    return new MoveResources(
      this.baseBytes,
      this.headBytes,
      pairedResourceRoutes(
        before,
        after,
        moves,
        new Set(this.before.keys()),
        new Set(this.after.keys()),
        this.baseViews,
        this.headViews,
        this.before,
        this.after,
      ),
      this.baseViews,
      this.headViews,
    );
  }

  identity(side: MoveSide, route: string, counterpart?: string): string {
    if (this.pairs) {
      const mapped = side === "before" ? this.pairs.get(route) : undefined;
      return mapped &&
        (counterpart === undefined ||
          this.headViews.get(counterpart)?.has(mapped))
        ? mapped
        : route;
    }
    if (this.before.has(route) && this.after.has(route)) return route;
    return this[side].get(route) ?? route;
  }

  /** Scope the byte proof to both referenced sides; unrelated identical files cannot suppress edits. */
  equivalent(
    before: ReadonlySet<string>,
    after: ReadonlySet<string>,
  ): ReadonlySet<string> {
    const result = new Set<string>();
    for (const [base, head] of this.equal)
      if (before.has(base) && after.has(head)) {
        result.add(base);
        result.add(head);
      }
    return result;
  }

  /** Only accepted, byte-equivalent moved routes suppress dependency and shared-impact paths. */
  unchangedPaths(prefix: string): ReadonlySet<string> {
    return new Set(
      [...this.equal.values()].map((route) =>
        prefix ? `${prefix}/${route}` : route,
      ),
    );
  }

  private material(
    side: MoveSide,
    route: string,
    content: Uint8Array,
  ): string | Uint8Array {
    return route.endsWith(".css")
      ? rewriteCssReferences(Buffer.from(content).toString("utf8"), (value) => {
          const target = resolveResourceReference(route, value);
          return target
            ? resourceUrl(this.identity(side, target), value)
            : value;
        })
      : content;
  }
}

/** Read move-candidate generated resources once through the confined asset boundary. */
export async function readMoveResources(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  beforeReader: ReviewAssetReader,
  afterReader: ReviewAssetReader,
): Promise<MoveResources> {
  const candidates = (
    entries: readonly ManifestEntry[],
    other: readonly ManifestEntry[],
  ) => {
    const existing = new Map(
      other.map((entry) => [moveIdentity(entry), entry]),
    );
    return entries.filter(
      (entry) =>
        existing.get(moveIdentity(entry))?.sourcePath !== entry.sourcePath,
    );
  };
  const [base, head] = await Promise.all([
    readSide(candidates(before, after), beforeReader),
    readSide(candidates(after, before), afterReader),
  ]);
  return new MoveResources(
    base.bytes,
    head.bytes,
    undefined,
    base.views,
    head.views,
  );
}

async function readSide(
  entries: readonly ManifestEntry[],
  reader: ReviewAssetReader,
): Promise<{
  bytes: ReadonlyMap<string, Uint8Array>;
  views: ReadonlyMap<string, ReadonlySet<string>>;
}> {
  const declared = documentResourceIndex(entries);
  const copied = new Set(
    [...declared.values()].flatMap((routes) => [...routes]),
  );
  const generated = (route: string) =>
    isValidGeneratedRoute(route) || copied.has(route);
  const pending = new Set(copied);
  const documents = [
    ...new Set(
      entries.flatMap((entry) =>
        moveDocuments(entry).map((view) => view.route),
      ),
    ),
  ];
  const seeds = new Map<string, readonly string[]>();
  const children = new Map<string, readonly string[]>();
  for (const route of documents) {
    const html = await reader.read(route);
    const references = [
      ...referencedRoutes(route, html, { resourceHints: false }).filter(
        generated,
      ),
      ...(declared.get(route) ?? []),
    ];
    seeds.set(route, references);
    for (const resource of references) pending.add(resource);
  }
  const bytes = new Map<string, Uint8Array>();
  const visited = new Set<string>();
  while (pending.size) {
    const routes = [...pending].filter((route) => !visited.has(route));
    pending.clear();
    for (const route of routes) visited.add(route);
    const files = reader.readManyIfExists
      ? await reader.readManyIfExists(routes)
      : new Map(
          await Promise.all(
            routes.map(
              async (route) =>
                [
                  route,
                  await (reader.readIfExists?.(route) ?? reader.read(route)),
                ] as const,
            ),
          ),
        );
    for (const [route, content] of files) {
      if (content === undefined) continue;
      bytes.set(route, content);
      if (route.endsWith(".css")) {
        const references = referencedRoutes(route, content).filter(generated);
        children.set(route, references);
        for (const child of references)
          if (!visited.has(child)) pending.add(child);
      }
    }
  }
  const views = new Map<string, ReadonlySet<string>>();
  for (const [view, roots] of seeds) {
    const resources = new Set(roots);
    for (const route of resources)
      for (const child of children.get(route) ?? []) resources.add(child);
    views.set(view, resources);
  }
  return { bytes, views };
}

function resourceDigests(
  bytes: ReadonlyMap<string, Uint8Array>,
): ReadonlyMap<string, string> {
  const identities = new Map<string, string>();
  const active = new Set<string>();
  const identity = (route: string): string => {
    const saved = identities.get(route);
    if (saved) return saved;
    const content = bytes.get(route);
    if (!content || active.has(route)) return route;
    active.add(route);
    const material = route.endsWith(".css")
      ? rewriteCssReferences(Buffer.from(content).toString("utf8"), (value) => {
          const target = resolveResourceReference(route, value);
          return target ? resourceUrl(identity(target), value) : value;
        })
      : content;
    const value = `mokly-resource:${createHash("sha256").update(material).digest("hex")}`;
    active.delete(route);
    identities.set(route, value);
    return value;
  };
  for (const route of [...bytes.keys()].sort()) identity(route);
  return identities;
}

/** Retain query and fragment semantics after resolving a local reference. */
export function resourceUrl(identity: string, written: string): string {
  const suffix = written.search(/[?#]/);
  return `${identity}${suffix < 0 ? "" : written.slice(suffix)}`;
}
