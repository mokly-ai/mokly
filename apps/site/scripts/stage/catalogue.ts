/** Project the public catalogue index into the bounded home-stage drawing. */

import type { CatalogueReadModel, CatalogueRecord } from "@mokly/viewer";

import type { StageRow, StageSection } from "../../src/stage.js";

import { projectTree, type StageNode } from "./tree.js";

/** The public metadata needed to depict one catalogue entry. */
export type CatalogueEntry = Pick<
  CatalogueRecord,
  "kind" | "path" | "title"
> & {
  readonly variantOf?: string;
};

/** The catalogue root label in the stage breadcrumb. */
export const CATALOGUE_ROOT = "Catalogue home";

export type CatalogueTree = Pick<CatalogueReadModel, "tree" | "treeOrder">;

/** Find a path, including hidden ancestry when building breadcrumbs. */
function nodePath<T extends { path: string; children?: readonly T[] }>(
  nodes: readonly T[],
  path: string,
): T[] | undefined {
  for (const node of nodes) {
    if (node.path === path) return [node];
    const below = nodePath(node.children ?? [], path);
    if (below) return [node, ...below];
  }
  return undefined;
}

function row(node: StageNode, current: string, depth: number): StageRow {
  return {
    count:
      node.children.length > 0 || node.kind === "folder"
        ? node.children.length
        : null,
    current: node.kind !== "folder" && node.path === current,
    depth: depth > 1 ? 2 : depth === 1 ? 1 : 0,
    kind: node.kind,
    label: node.label,
    path: node.path,
  };
}

function flatten(
  nodes: readonly StageNode[],
  current: string,
  depth: number,
  limit: number,
  rows: StageRow[],
): void {
  if (depth > 2) return;
  for (const node of nodes) {
    if (rows.length >= limit) return;
    rows.push(row(node, current, depth));
    flatten(node.children, current, depth + 1, limit, rows);
  }
}

/** Find the canonical screen at one path in the catalogue index. */
export function stagedEntry(
  entries: readonly CatalogueEntry[],
  path: string,
): CatalogueEntry {
  const entry = entries.find((candidate) => candidate.path === path);
  if (entry?.kind !== "screen" || entry.variantOf !== undefined)
    throw new Error(`The catalogue index publishes no screen ${path}.`);
  return entry;
}

/** Use the index's resolved titles for every breadcrumb ancestor. */
export function catalogueTrail(
  entries: readonly CatalogueEntry[],
  catalogue: CatalogueTree,
  screen: CatalogueEntry,
): readonly string[] {
  const records = new Map(entries.map((entry) => [entry.path, entry]));
  return [
    CATALOGUE_ROOT,
    ...(nodePath(catalogue.tree, screen.path) ?? [])
      .slice(0, -1)
      .map((node) =>
        node.kind === "folder"
          ? node.title
          : (records.get(node.path)?.title ?? node.path),
      ),
  ];
}

/** Specs shows the screen's chain. Components shows a bounded ordered prefix. */
export function catalogueSections(
  entries: readonly CatalogueEntry[],
  catalogue: CatalogueTree,
  screen: CatalogueEntry,
  limit = 10,
): readonly StageSection[] {
  const chain = nodePath(projectTree(entries, catalogue, false), screen.path);
  if (!chain)
    throw new Error(`The home stage has no visible screen ${screen.path}.`);
  const componentRows: StageRow[] = [];
  flatten(
    projectTree(entries, catalogue, true),
    screen.path,
    0,
    limit,
    componentRows,
  );
  return [
    {
      rows: chain.slice(-4).map((node, index) => row(node, screen.path, index)),
      title: "Specs",
    },
    ...(componentRows.length
      ? [{ rows: componentRows, title: "Components" }]
      : []),
  ];
}
