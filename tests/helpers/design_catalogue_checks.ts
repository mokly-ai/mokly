import fs from "node:fs";
import path from "node:path";

import type { CatalogueNode } from "../../packages/viewer/src/generated/catalogue/CatalogueNode.js";

import {
  DUAL_SCHEME,
  INVENTORY,
  SHARED_COMPONENTS,
} from "./design_expectations.js";
import { stylesheets, withAncestors } from "./design_rules.js";
import { repositoryRoot } from "./fixture.js";
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
 * Every shared component has its page, exactly its saved variants in order,
 * and a real design-screen consumer in each viewport, direct or composed.
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
    if (!parents.some((entry) => entry.path === parent)) {
      violations.push(`${parent} has no page`);
      continue;
    }
    const saved = components
      .filter((entry) => entry.variantOf === parent)
      .map((entry) => entry.path.slice(parent.length + 1));
    if (saved.join() !== variants.join())
      violations.push(`${parent} saves ${saved.join(", ")}`);
    const workspace = catalogue.details.get(parent)!.workspace;
    if (!workspace) {
      violations.push(`${parent} has no proven usage lists`);
      continue;
    }
    const consumers = workspace.usedBy.filter(
      (use) => !use.entryPath.startsWith(LIBRARY),
    );
    for (const viewport of VIEWPORTS)
      if (!consumers.some((use) => use.viewport === viewport))
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
 * Each design screen is linked from another design artboard, or is one of
 * the frozen tree-only screens; the catalogue tree lists every one.
 */
export function reachabilityViolations(catalogue: ServedCatalogue): string[] {
  const screens = catalogue.index.screens
    .map((entry) => entry.path)
    .filter((screen) => screen.startsWith("design/"));
  const inbound = new Set<string>();
  for (const view of catalogue.views)
    if (view.path.startsWith("design/"))
      for (const [element] of withAncestors(view.document)) {
        const target = attribute(element, "data-mokly-link")?.split("#")[0];
        if (target && target !== view.path) inbound.add(target);
      }
  const tree = new Set(treeEntries(catalogue.index.tree));
  return screens.flatMap((screen) => [
    ...(!inbound.has(screen) && !INVENTORY.treeOnly.includes(screen)
      ? [`${screen} has no inbound design link`]
      : []),
    ...(inbound.has(screen) && INVENTORY.treeOnly.includes(screen)
      ? [`${screen} is linked, so it is no longer tree-only`]
      : []),
    ...(tree.has(screen) ? [] : [`${screen} is not in the catalogue tree`]),
  ]);
}

/**
 * The shared design sheets keep their route scopes: the component design
 * sheets link from the fifty `design/components/**` screens, the controls
 * sheet from its twenty entries, the library sheet from no screen, the
 * inspector and workspace sheets from every design screen, and every shared
 * sheet from the library pages and their 69 saved variants.
 */
export function scopeViolations(catalogue: ServedCatalogue): string[] {
  const linked = new Map<string, Set<string>>();
  for (const view of catalogue.views)
    if (view.path.startsWith("design/"))
      for (const sheet of stylesheets(view))
        if (!sheet.startsWith("design-library/"))
          linked.set(sheet, (linked.get(sheet) ?? new Set()).add(view.path));
  const entries = designEntries(catalogue);
  const library = entries.filter((entry) => entry.path.startsWith(LIBRARY));
  const variants = library.filter((entry) => entry.variantOf).length;
  const screens = (pattern: RegExp) =>
    entries
      .filter((entry) => entry.kind === "screen" && pattern.test(entry.path))
      .map((entry) => entry.path);
  const scopes: [string[], string[]][] = [
    [
      [
        "design-components.css",
        "design-component-inspection.css",
        "design-component-details.css",
        "design-component-view.css",
      ],
      screens(/^design\/components\//u),
    ],
    [
      ["design-component-controls.css"],
      screens(/^design\/components\/controls\//u),
    ],
    [["design-library.css"], []],
    [
      [
        "design.css",
        "design-stage.css",
        "design-component-inspector.css",
        "design-component-workspace.css",
      ],
      screens(/^design\//u),
    ],
  ];
  const violations = variants === 69 ? [] : [`${variants} saved variants`];
  for (const [sheets, scope] of scopes)
    for (const sheet of sheets) {
      const expected = [...scope, ...library.map((entry) => entry.path)];
      const actual = [...(linked.get(sheet) ?? [])];
      const extra = actual.filter((entry) => !expected.includes(entry));
      const missing = expected.filter((entry) => !actual.includes(entry));
      if (extra.length || missing.length)
        violations.push(
          `${sheet}: ${extra.length} extra (${extra.slice(0, 3).join(", ")}), ${missing.length} missing (${missing.slice(0, 3).join(", ")})`,
        );
    }
  const pins = [
    screens(/^design\/components\//u).length,
    screens(/^design\/components\/controls\//u).length,
  ];
  if (pins.join() !== "50,20") violations.push(`scopes pin ${pins.join(", ")}`);
  return violations;
}

/**
 * Composition outside the library uses the registered components: no module
 * imports a library implementation, and none redraws a library root.
 */
export function bypassViolations(): string[] {
  const root = path.join(repositoryRoot, "examples/basic/specs/design");
  const roots =
    /className=["'](mbk-topbar|mbk-screen-head|mbk-appearance|mbk-tag-picker|ce-view-controls|ce-inspector|mbk-meta-row|mbk-empty|flow-step|phone-frame|browser-frame|mbk-cmp-toolbar|mbk-nav-head)["']/u;
  return fs
    .readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/u.test(file) && !file.startsWith("library/"))
    .flatMap((file) => {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      return [
        ...(/from ["'][^"']*\.view\.js["']/u.test(source)
          ? [`${file} imports a library implementation`]
          : []),
        ...(roots.test(source) ? [`${file} redraws a library root`] : []),
      ];
    });
}
