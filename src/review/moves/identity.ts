import type { ComponentViewRecord } from "@mokly/viewer";
import type { ManifestEntry } from "@mokly/viewer/data";

import type { EntryMove } from "./types.js";

/** Resolve baseline identity references without confusing a reused path's new kind. */
export function baselinePathMapper(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  moves: readonly EntryMove[],
): (path: string) => string {
  const bases = new Map(
    before.map((entry) => [entry.path.toLowerCase(), entry]),
  );
  const heads = new Map(
    after.map((entry) => [entry.path.toLowerCase(), entry]),
  );
  const paired = new Map(
    moves.map((move) => [
      `${move.kind}:${move.previousPath.toLowerCase()}`,
      move.path,
    ]),
  );
  return (path) => {
    const key = path.toLowerCase();
    const base = bases.get(key);
    const head = heads.get(key);
    if (base && head?.kind === base.kind) return head.path;
    return (base && paired.get(`${base.kind}:${key}`)) || path;
  };
}

/** Align component references while retaining occurrence keys and original range coordinates. */
export function mapUsagePaths(
  view: ComponentViewRecord,
  mapPath: (path: string) => string,
): ComponentViewRecord {
  return {
    ...view,
    ...(view.insertedStylesheets === undefined
      ? {}
      : {
          insertedStylesheets: view.insertedStylesheets.map((link) => ({
            ...link,
            componentPaths: link.componentPaths.map(mapPath).sort(),
          })),
        }),
    instances: view.instances.map((instance) => ({
      ...instance,
      componentId: mapPath(instance.componentId),
    })),
    styles: view.styles.map((style) => ({
      ...style,
      componentIds: style.componentIds.map(mapPath).sort(),
    })),
    resources: view.resources.map((resource) => ({
      ...resource,
      componentIds: resource.componentIds.map(mapPath).sort(),
    })),
  };
}
