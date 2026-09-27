import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeHierarchy } from "../packages/viewer/dist/registry/hierarchy.js";
import type {
  ManifestEntry,
  ManifestScreen,
} from "../packages/viewer/dist/registry/types.js";
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
import { designDocument } from "./helpers/design_catalogue.js";
import {
  filterTargets,
  rowIcon,
  rowLabel,
  rowLabels,
  variantToggles,
} from "./helpers/design_rows.js";

const removedRoute = "screens/welcome.variants/save-failed.html";
const common = {
  dependencies: [],
  description: "Fixture",
  navPath: [],
  relatedDocs: [],
  sourcePath: "fixture.mockup.tsx",
};

function screen(
  id: string,
  title: string,
  route: string,
  variantOf?: string,
): ManifestScreen {
  return {
    ...common,
    id,
    title,
    kind: "screen",
    route,
    fragments: { desktop: `${route}.desktop`, mobile: `${route}.mobile` },
    useCaseIds: [],
    viewports: ["mobile", "desktop"],
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
      ...common,
      id: "example",
      title: "Example",
      kind: "collection",
      childIds: ["screens"],
    },
    {
      ...common,
      id: "screens",
      title: "Screens",
      kind: "collection",
      childIds: ["workspace"],
    },
    screen("workspace", "Workspace", "screens/workspace.html"),
    screen(
      "welcome",
      "Welcome",
      "screens/workspace.variants/welcome.html",
      "workspace",
    ),
  ];
  const { hierarchy, issues } = analyzeHierarchy(entries);
  assert.deepEqual(issues, []);
  const [pages] = buildNavSections(hierarchy, [
    {
      entryId: "welcome-error",
      entryKind: "screen",
      key: `removed:${removedRoute}`,
      kind: "leaf",
      label: "Save failed · Removed",
      route: removedRoute,
      variantOf: "welcome",
    },
  ]);
  assert.ok(pages);
  assert.equal(pages.id, "pages");
  const context: ShellContext = {
    base: "",
    changedRoutes: [removedRoute],
    changesStatus: "ready",
    updateVersion: 0,
  };
  const expected = visibleRows(pages.children, context);
  assert.deepEqual(expected, ["Save failed · Removed"]);

  const { document } = await designDocument(
    "design-browse-variant-reparented",
    "desktop",
  );
  assert.deepEqual(rowLabels(document), expected);
  assert.equal(variantToggles(document).length, 0);
  assert.equal(rowIcon(document, "Save failed · Removed")[0], "mbk-nav-ico");
  const removed = byClass(document, "mbk-nav-row").find(
    (row) => rowLabel(row) === "Save failed · Removed",
  );
  assert.equal(attribute(removed!, "class"), "mbk-nav-row active");
  assert.deepEqual(filterTargets(document), [["All", "design-browse-home"]]);
  assert.match(
    textContent(document),
    /this removed state stays as one flat Changes row instead of nesting a second variant level/,
  );
  assert.doesNotMatch(
    textContent(document),
    /keeps its recorded details under the screen it belonged to/,
  );
});
