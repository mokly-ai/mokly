import type { CatalogueNode } from "../../packages/model/dist/index.js";

import { withAncestors } from "./design_accessibility.js";
import {
  DUAL_SCHEME,
  INVENTORY,
  SHARED_COMPONENTS,
} from "./design_expectations.js";
import { stylesheets } from "./design_rules.js";
import { attribute } from "./html.js";
import type { ServedCatalogue } from "./served_design.js";

const LIBRARY = "design/library/";
const VIEWPORTS = ["mobile", "desktop"] as const;

function designEntries(catalogue: ServedCatalogue) {
  return [...catalogue.index.screens, ...catalogue.index.components].filter(
    (entry) => entry.path.startsWith("design/"),
  );
}

/**
 * The design screens equal the frozen inventory, and every design entry
 * renders both viewports in each scheme it lists: light-only, apart from the
 * dual-scheme set.
 */
export function inventoryViolations(catalogue: ServedCatalogue): string[] {
  const screens = catalogue.index.screens
    .filter((entry) => entry.path.startsWith("design/"))
    .map((entry) => entry.path)
    .sort();
  const violations = [
    ...screens
      .filter((screen) => !INVENTORY.screens.includes(screen))
      .map((screen) => `${screen} is not in the frozen inventory`),
    ...INVENTORY.screens
      .filter((screen) => !screens.includes(screen))
      .map((screen) => `${screen} is missing`),
  ];
  for (const entry of designEntries(catalogue)) {
    const schemes = DUAL_SCHEME.test(entry.path)
      ? ["light", "dark"]
      : ["light"];
    if (entry.colorSchemes.join() !== schemes.join())
      violations.push(`${entry.path} renders ${entry.colorSchemes.join("+")}`);
    const views = entry.views.map(
      (view) => `${view.viewport}.${view.colorScheme}`,
    );
    for (const viewport of VIEWPORTS)
      for (const scheme of entry.colorSchemes)
        if (!views.includes(`${viewport}.${scheme}`))
          violations.push(`${entry.path} has no ${viewport} ${scheme} view`);
  }
  return violations;
}

/**
 * Whether a design screen view of the viewport records the component in its
 * usage, directly or inside another instance.
 */
function consumed(
  catalogue: ServedCatalogue,
  component: string,
  viewport: (typeof VIEWPORTS)[number],
): boolean {
  return catalogue.index.screens.some(
    (screen) =>
      screen.path.startsWith("design/") &&
      catalogue.details
        .get(screen.path)!
        .views.some(
          ({ usage, ...view }) =>
            view.viewport === viewport &&
            usage.status === "ready" &&
            usage.instances.some((use) => use.componentId === component),
        ),
  );
}

/**
 * Every shared component has its page, which declares at least one control,
 * exactly its saved variants in order, and a real design-screen consumer in
 * each viewport, direct or composed, by the recorded usage.
 */
export function libraryViolations(catalogue: ServedCatalogue): string[] {
  const components = catalogue.index.components;
  const parents = components.filter(
    (entry) => entry.path.startsWith(LIBRARY) && !entry.variantOf,
  );
  const violations = parents
    .filter((entry) => !(entry.path.slice(LIBRARY.length) in SHARED_COMPONENTS))
    .map((entry) => `${entry.path} is not an inventory component`);
  for (const [id, variants] of Object.entries(SHARED_COMPONENTS)) {
    const parent = `${LIBRARY}${id}`;
    const page = parents.find((entry) => entry.path === parent);
    if (!page) {
      violations.push(`${parent} has no page`);
      continue;
    }
    if (Object.keys(page.controls).length === 0)
      violations.push(`${parent} declares no control`);
    const saved = components
      .filter((entry) => entry.variantOf === parent)
      .map((entry) => entry.path.slice(parent.length + 1));
    if (saved.join() !== variants.join())
      violations.push(`${parent} saves ${saved.join(", ")}`);
    for (const viewport of VIEWPORTS)
      if (!consumed(catalogue, parent, viewport))
        violations.push(`${parent} has no ${viewport} screen consumer`);
  }
  return violations;
}

function treeEntries(nodes: readonly CatalogueNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.kind === "entry" ? [node.path] : []),
    ...treeEntries(node.children ?? []),
  ]);
}

/**
 * Each design screen has an inbound design link, or the catalogue tree
 * reaches it: the contract's runtime-only states and the frozen screens that
 * no artboard links yet. The rule is one way for those frozen screens. A
 * runtime-only state takes a link only as a listed failure state's retry.
 * Every listed path names a design screen, and the tree lists every design
 * screen.
 */
export function reachabilityViolations(catalogue: ServedCatalogue): string[] {
  const screens = catalogue.index.screens
    .map((entry) => entry.path)
    .filter((screen) => screen.startsWith("design/"));
  const sources = new Map<string, Set<string>>();
  for (const view of catalogue.views)
    if (view.path.startsWith("design/"))
      for (const [element] of withAncestors(view.document)) {
        if (element.tagName !== "a") continue;
        const target = attribute(element, "data-mokly-link")?.split("#")[0];
        if (target && target !== view.path)
          sources.set(
            target,
            (sources.get(target) ?? new Set()).add(view.path),
          );
      }
  const { runtimeOnly, treeReached, retries } = INVENTORY;
  const listed = [
    ...runtimeOnly,
    ...treeReached,
    ...Object.entries(retries).flat(2),
  ];
  const tree = new Set(treeEntries(catalogue.index.tree));
  return [
    ...[...new Set(listed)]
      .filter((screen) => !screens.includes(screen))
      .map((screen) => `${screen} is listed but is no design screen`),
    ...runtimeOnly.flatMap((state) =>
      [...(sources.get(state) ?? [])]
        .filter((source) => !(retries[state] ?? []).includes(source))
        .map((source) => `${source} links to the runtime-only ${state}`),
    ),
    ...screens.flatMap((screen) => [
      ...(sources.has(screen) ||
      runtimeOnly.includes(screen) ||
      treeReached.includes(screen)
        ? []
        : [`${screen} has no inbound design link`]),
      ...(tree.has(screen) ? [] : [`${screen} is not in the catalogue tree`]),
    ]),
  ];
}

/** The sheets that the Canvas route links and no other design route links. */
const CANVAS_ROUTE_SHEETS = [
  "design-canvas-inspect.css",
  "design-canvas-sections.css",
  "design-canvas-changes.css",
  "design-canvas-outcomes.css",
  "design-canvas-flows.css",
  "design-canvas-loading.css",
  "design-canvas-search.css",
  "design-canvas-components.css",
  "design-canvas-props.css",
  "design-canvas-evidence.css",
  "design-canvas-shell.css",
  "design-canvas-compact.css",
];

/**
 * The shared design sheets keep their route scopes: the design sheet links
 * from every design view; the component design sheets and the library sheet
 * from no screen; the preview, mini-screen, and Canvas sheets from every
 * Canvas screen; and the other sheets of the Canvas route from the Canvas
 * screens only. The library pages and their 75 saved variants link every
 * listed sheet apart from the Canvas route's own sheets.
 */
export function scopeViolations(catalogue: ServedCatalogue): string[] {
  const linked = new Map<string, Set<string>>();
  for (const view of catalogue.views)
    if (view.path.startsWith("design/"))
      for (const sheet of stylesheets(view))
        if (!sheet.startsWith("design-library/"))
          linked.set(sheet, (linked.get(sheet) ?? new Set()).add(view.path));
  const entries = designEntries(catalogue);
  const library = entries
    .filter((entry) => entry.path.startsWith(LIBRARY))
    .map((entry) => entry.path);
  const variants = entries.filter(
    (entry) => entry.path.startsWith(LIBRARY) && entry.variantOf,
  ).length;
  const screens = (pattern: RegExp) =>
    entries
      .filter((entry) => entry.kind === "screen" && pattern.test(entry.path))
      .map((entry) => entry.path);
  const canvas = screens(/^design\/canvas\//u);
  const scopes: [string[], string[]][] = [
    [["design.css"], [...screens(/^design\//u), ...library]],
    [["design-components.css", "design-component-details.css"], library],
    [["design-library.css"], library],
    [
      ["design-preview.css", "design-shots.css", "design-canvas.css"],
      [...canvas, ...library],
    ],
    [CANVAS_ROUTE_SHEETS, canvas],
  ];
  const violations = variants === 75 ? [] : [`${variants} saved variants`];
  for (const [sheets, expected] of scopes)
    for (const sheet of sheets) {
      const actual = [...(linked.get(sheet) ?? [])];
      const extra = actual.filter((entry) => !expected.includes(entry));
      const missing = expected.filter((entry) => !actual.includes(entry));
      if (extra.length || missing.length)
        violations.push(
          `${sheet}: ${extra.length} extra (${extra.slice(0, 3).join(", ")}), ${missing.length} missing (${missing.slice(0, 3).join(", ")})`,
        );
    }
  return violations;
}
