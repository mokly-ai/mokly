/**
 * Derive the catalogue navigation the home stage depicts from the example
 * build's own manifest. The tree follows the rule the catalogue itself uses:
 * one node per authored entry, projected into a Pages section and a
 * Components section, collections before entries and then by label. The
 * branch leading to the staged screen is expanded and the rest is collapsed,
 * which is the state the catalogue is in when that screen is open. No label,
 * count or section is written by hand.
 */

import type { StageRow, StageSection } from "../../src/stage.js";

/** The fields the stage reads from one manifest entry. */
export interface CatalogueEntry {
  readonly childIds?: readonly string[];
  readonly id: string;
  readonly kind: string;
  readonly navPath?: readonly string[];
  readonly route?: string;
  readonly title: string;
}

/** The trail the catalogue shows above a screen, rooted at the catalogue. */
export const CATALOGUE_ROOT = "Catalogue home";

interface Node {
  readonly children: readonly Node[];
  readonly entry: CatalogueEntry;
}

const KINDS: Readonly<Record<string, StageRow["kind"]>> = {
  collection: "collection",
  component: "component",
  page: "page",
  screen: "screen",
  "use-case": "flow",
};

function kindOf(entry: CatalogueEntry): StageRow["kind"] {
  const kind = KINDS[entry.kind];
  if (!kind) {
    throw new Error(
      `The home stage cannot depict the catalogue entry kind ${JSON.stringify(entry.kind)}.`,
    );
  }
  return kind;
}

function sorted(nodes: readonly Node[]): Node[] {
  const rank = (node: Node): number =>
    node.entry.kind === "collection" ? 1 : 2;
  return [...nodes].sort(
    (left, right) =>
      rank(left) - rank(right) ||
      left.entry.title.localeCompare(right.entry.title) ||
      left.entry.id.localeCompare(right.entry.id),
  );
}

function build(
  entries: readonly CatalogueEntry[],
  trail: readonly string[],
): Node[] {
  const children = entries.filter((entry) => {
    const own = entry.navPath ?? [];
    return (
      own.length === trail.length &&
      own.every((step, index) => step === trail[index])
    );
  });
  return sorted(
    children.map((entry) => ({
      children: build(entries, [...trail, entry.title]),
      entry,
    })),
  );
}

function project(nodes: readonly Node[], components: boolean): Node[] {
  return nodes.flatMap((node): Node[] => {
    if (node.entry.kind !== "collection") {
      return (node.entry.kind === "component") === components ? [node] : [];
    }
    const children = project(node.children, components);
    if (children.length > 0) return [{ children, entry: node.entry }];
    return !components && node.children.length === 0
      ? [{ children, entry: node.entry }]
      : [];
  });
}

function flatten(
  nodes: readonly Node[],
  open: ReadonlySet<string>,
  current: string,
  depth: number,
  limit: number,
  rows: StageRow[],
): void {
  for (const node of nodes) {
    if (rows.length >= limit || depth > 2) return;
    rows.push({
      count: node.entry.childIds?.length ?? null,
      current: node.entry.id === current,
      depth: depth as StageRow["depth"],
      kind: kindOf(node.entry),
      label: node.entry.title,
    });
    if (open.has(node.entry.id))
      flatten(node.children, open, current, depth + 1, limit, rows);
  }
}

function pathTo(nodes: readonly Node[], id: string): string[] | undefined {
  for (const node of nodes) {
    if (node.entry.id === id) return [];
    const below = pathTo(node.children, id);
    if (below) return [node.entry.id, ...below];
  }
  return undefined;
}

function identifiers(nodes: readonly Node[]): string[] {
  return nodes.flatMap((node) => [
    node.entry.id,
    ...identifiers(node.children),
  ]);
}

/** The staged screen's entry, addressed by the catalogue route it publishes. */
export function stagedEntry(
  entries: readonly CatalogueEntry[],
  route: string,
): CatalogueEntry {
  const entry = entries.find((candidate) => candidate.route === route);
  if (!entry) {
    throw new Error(
      `The catalogue manifest publishes no screen at ${route}. The home stage cannot name a screen that does not exist.`,
    );
  }
  return entry;
}

/** The trail the screen header shows, from the catalogue root downward. */
export function catalogueTrail(screen: CatalogueEntry): readonly string[] {
  return [CATALOGUE_ROOT, ...(screen.navPath ?? [])];
}

/**
 * The Pages and Components sections of the depicted navigation, each bounded
 * by `limit` rows because the frame shows one screenful of a scrolling tree.
 */
export function catalogueSections(
  entries: readonly CatalogueEntry[],
  screen: CatalogueEntry,
  limit = 10,
): readonly StageSection[] {
  const tree = build(entries, []);
  const sections: StageSection[] = [];
  for (const [title, components] of [
    ["Pages", false],
    ["Components", true],
  ] as const) {
    const nodes = project(tree, components);
    const path = pathTo(nodes, screen.id);
    const open = new Set(path ?? identifiers(nodes));
    const rows: StageRow[] = [];
    flatten(nodes, open, screen.id, 0, limit, rows);
    if (rows.length > 0) sections.push({ rows, title });
  }
  if (sections.length === 0) {
    throw new Error("The catalogue manifest has no entries to depict.");
  }
  return sections;
}
