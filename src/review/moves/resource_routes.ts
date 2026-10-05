import path from "node:path";

import {
  GENERATED_DIRECTORY,
  generatedResourcePath,
  type ManifestEntry,
} from "@mokly/viewer/data";

import { documentResourceRoute } from "../../documents/resource_paths.js";

import { moveDocuments } from "./content.js";
import { baselineEntryIndex } from "./entries.js";
import { moveIdentity, type EntryMove } from "./types.js";

/** Derive only resource aliases supported by accepted entry/source moves and retained routes. */
export function pairedResourceRoutes(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  moves: readonly EntryMove[],
  baseRoutes: ReadonlySet<string>,
  headRoutes: ReadonlySet<string>,
  baseViews: ReadonlyMap<string, ReadonlySet<string>>,
  headViews: ReadonlyMap<string, ReadonlySet<string>>,
  baseDigests: ReadonlyMap<string, string>,
  headDigests: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  const bases = baselineEntryIndex(before, moves);
  const proposals = new Map<string, Set<string>>();
  const offer = (previous: string, current: string) => {
    if (
      previous === current ||
      !baseRoutes.has(previous) ||
      !headRoutes.has(current)
    )
      return;
    const values = proposals.get(previous) ?? new Set<string>();
    values.add(current);
    proposals.set(previous, values);
  };
  for (const head of after) {
    const base = bases.get(moveIdentity(head));
    if (!base) continue;
    offer(
      `${GENERATED_DIRECTORY}/styles/${base.sourcePath}.css`,
      `${GENERATED_DIRECTORY}/styles/${head.sourcePath}.css`,
    );
    for (const view of moveDocuments(base)) {
      const other = moveDocuments(head).find(
        (candidate) => candidate.key === view.key,
      );
      if (!other) continue;
      const left = baseViews.get(view.route) ?? new Set<string>(),
        right = headViews.get(other.route) ?? new Set<string>();
      for (const kind of ["styles", "assets"] as const) {
        const prefix = `${GENERATED_DIRECTORY}/${kind}/`;
        const removed = [...left].filter(
          (route) => route.startsWith(prefix) && !right.has(route),
        );
        const added = [...right].filter(
          (route) => route.startsWith(prefix) && !left.has(route),
        );
        for (const previous of removed) {
          const matches = added.filter(
            (route) => baseDigests.get(previous) === headDigests.get(route),
          );
          if (
            matches.length === 1 &&
            removed.filter(
              (route) =>
                baseDigests.get(route) === headDigests.get(matches[0]!),
            ).length === 1
          )
            offer(previous, matches[0]!);
        }
        if (removed.length === 1 && added.length === 1)
          offer(removed[0]!, added[0]!);
      }
    }
    const baseDirectory = path.posix.dirname(base.sourcePath),
      headDirectory = path.posix.dirname(head.sourcePath);
    for (const route of baseRoutes) {
      const prefix = `${GENERATED_DIRECTORY}/assets/${baseDirectory}/`;
      if (route.startsWith(prefix))
        offer(
          route,
          `${GENERATED_DIRECTORY}/assets/${headDirectory}/${route.slice(prefix.length)}`,
        );
    }
    if (base.kind === "document" && head.kind === "document") {
      const current = new Map(
        head.resources.map((resource) => [
          path.posix.relative(headDirectory, resource),
          documentResourceRoute(head, resource),
        ]),
      );
      for (const resource of base.resources) {
        const previous = documentResourceRoute(base, resource),
          next = current.get(path.posix.relative(baseDirectory, resource));
        if (previous && next)
          offer(generatedResourcePath(previous), generatedResourcePath(next));
      }
    }
  }
  const destinations = new Map<string, number>();
  for (const values of proposals.values())
    for (const route of values)
      destinations.set(route, (destinations.get(route) ?? 0) + 1);
  return new Map(
    [...proposals].flatMap(([base, values]) => {
      const head = [...values][0]!;
      return values.size === 1 && destinations.get(head) === 1
        ? [[base, head]]
        : [];
    }),
  );
}
