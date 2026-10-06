import assert from "node:assert/strict";
import { test } from "node:test";

import { parse, serializeOuter } from "parse5";

import { homePage as renderHomePage } from "../packages/mokly/dist/server/pages.js";
import { analyzeHierarchy } from "../packages/viewer/dist/registry/hierarchy.js";
import type {
  ManifestEntry,
  ManifestScreen,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import {
  navLeafVisible,
  navNodeVisible,
} from "../packages/viewer/dist/shell/nav_model.js";
import {
  buildNavSections,
  type NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";
import { defaultSelection } from "../packages/viewer/dist/viewer/selection.js";

import { attribute, byClass, textContent } from "./helpers/design_catalogue.js";
import {
  designCatalogue,
  designDocument,
  elements,
} from "./helpers/design_catalogue.js";
import {
  filterTargets,
  rowIcon,
  rowLabel,
  rowLabels,
  variantToggles,
} from "./helpers/design_rows.js";
import { publicShellContext } from "./helpers/public_shell.js";

const common = {
  colorSchemes: ["light"] as const,
  declaredDependencies: [],
  description: "Fixture",

  relatedDocs: [],
  sourcePath: "fixture.mockup.tsx",
};

function screen(id: string, title: string, variantOf?: string): ManifestScreen {
  return {
    ...common,
    path: id,
    title,
    kind: "screen",
    useCasePaths: [],
    ...(variantOf === undefined ? {} : { variantOf }),
  };
}

function visibleRows(
  nodes: readonly NavNode[],
  context: ShellContext,
): string[] {
  const changes = { ...defaultSelection, view: "changes" as const };
  return nodes.flatMap((node): string[] => {
    if (!navNodeVisible(node, changes, context)) return [];
    if (node.kind === "group")
      return [node.label, ...visibleRows(node.children, context)];
    return [
      node.label,
      ...(node.variants ?? [])
        .filter((variant) => navLeafVisible(variant, changes, context))
        .map((variant) => variant.label),
    ];
  });
}

test("reparented mockup shows the runtime's Changes-visible rows", async () => {
  const entries: ManifestEntry[] = [
    {
      ...screen("workspace", "Workspace"),
    },
    {
      ...screen("welcome", "Welcome", "workspace"),
    },
  ];
  const { hierarchy } = analyzeHierarchy(entries);
  const [specs] = buildNavSections(hierarchy, [
    {
      entryId: "welcome-error",
      entryKind: "screen",
      key: "removed:welcome-error",
      kind: "leaf",
      label: "Save failed · Removed",
      title: "Save failed",
      parentId: "welcome",
    },
  ]);
  assert.ok(specs);
  assert.equal(specs.id, "specs");
  const context: ShellContext = {
    base: "",
    changedEntries: ["welcome-error"],
    changesStatus: "ready",
    updateVersion: 0,
  };
  const expected = visibleRows(specs.children, context);
  assert.deepEqual(expected, ["Save failed · Removed"]);

  const { document } = await designDocument(
    "design/browse/variants/variant-reparented",
    "desktop",
  );
  assert.deepEqual(rowLabels(document), expected);
  assert.equal(variantToggles(document).length, 0);
  assert.equal(rowIcon(document, "Save failed · Removed")[0], "mbk-nav-ico");
  const removed = byClass(document, "mbk-nav-row").find(
    (row) => rowLabel(row) === "Save failed · Removed",
  );
  assert.equal(attribute(removed!, "class"), "mbk-nav-row active");
  assert.deepEqual(filterTargets(document), [
    ["All", "design/browse/views/home"],
  ]);
  assert.match(
    textContent(document),
    /this removed state stays as one flat Changes row instead of nesting a second variant level/,
  );
  assert.doesNotMatch(
    textContent(document),
    /keeps its recorded details under the screen it belonged to/,
  );
});

test("component mockup rows and glyph match the runtime Components branch", async () => {
  const compilation = await designCatalogue;
  const catalogue = createCatalogue(compilation.manifest);
  const runtime = parse(
    renderHomePage(
      catalogue,
      publicShellContext(catalogue, { base: "", updateVersion: 0 }),
    ),
  );
  const mockup = await designDocument("design/components/overview", "desktop");
  const section = (document: typeof runtime) => {
    const found = byClass(document, "mbk-nav-section").find(
      (candidate) => attribute(candidate, "data-nav-section") === "components",
    );
    assert.ok(found);
    return found;
  };
  const runtimeSection = section(runtime);
  const mockupSection = section(mockup.document);
  const ids = new Set([
    "example/components/action",
    "example/components/action/default",
    "example/components/action/disabled",
    "example/components/action/secondary",
    "example/components/toolbar",
    "example/components/toolbar/default",
  ]);
  const runtimeLabels = byClass(runtimeSection, "mbk-nav-row")
    .filter(
      (row) =>
        ["Example", "Components"].includes(rowLabel(row)) ||
        ids.has(attribute(row, "data-entry-id") ?? ""),
    )
    .map(rowLabel);
  assert.deepEqual(runtimeLabels, rowLabels(mockupSection).slice(0, 8));

  const runtimeVariant = byClass(runtimeSection, "mbk-nav-row").find(
    (row) =>
      attribute(row, "data-entry-id") === "example/components/action/default",
  );
  assert.ok(runtimeVariant);
  const runtimeWrapper = byClass(runtimeVariant, "mbk-nav-ico")[0];
  assert.ok(runtimeWrapper);
  const runtimeSvg = elements(
    runtimeWrapper,
    (element) => element.tagName === "svg",
  )[0];
  assert.ok(runtimeSvg);
  const [mockupClass, mockupSvg] = rowIcon(mockupSection, "Default");
  assert.equal(attribute(runtimeWrapper, "class"), mockupClass);
  assert.equal(serializeOuter(runtimeSvg), mockupSvg);
});
