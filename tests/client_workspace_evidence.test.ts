import assert from "node:assert/strict";
import test from "node:test";

import { renderWorkspaceEvidence } from "../packages/viewer/dist/client/workspace_evidence.js";
import { mergeWorkspaceEvidence } from "../packages/viewer/dist/client/workspace_updates.js";
import { applyViewEvidence } from "../packages/viewer/dist/client/workspace_views.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import { FakeNode } from "./helpers/fake_dom.js";
import type { FakeMarkupElement } from "./helpers/fake_markup.js";
import { FakeMarkupDocument, fakeMarkup } from "./helpers/fake_markup.js";

const SHARED = "mockups/shared.css";
const TOKENS = "mockups/tokens.css";

test("the inspector lists changed files, applying styles, then exclusions", () => {
  const { node, panel } = fakePanel();

  renderWorkspaceEvidence(
    panel as unknown as HTMLElement,
    {
      base: "main",
      status: "Changed",
      change: {
        kind: "screen",
        after: { id: "home", route: "screens/home.html", title: "Home" },
        reasons: [
          { kind: "material" },
          {
            kind: "dependency",
            path: SHARED,
            analysis: { status: "matched", selectors: [".auth"] },
          },
        ],
      },
      comparison: {
        dependencies: [],
        id: "home",
        route: "screens/home.html",
        sharedImpact: [SHARED],
        state: "changed",
        title: "Home",
        views: [
          {
            colorScheme: "light",
            ignoredIds: [],
            state: "changed",
            viewport: "mobile",
            reasons: [
              {
                kind: "dependency",
                path: SHARED,
                analysis: { status: "matched", selectors: [".auth"] },
              },
            ],
          },
          {
            colorScheme: "light",
            ignoredIds: [],
            state: "unchanged",
            viewport: "desktop",
            excludedResources: [{ path: TOKENS, reason: "no-matching-rule" }],
          },
        ],
      },
      components: [],
      comparisonEligible: true,
      comparisons: true,
      entry: { id: "home", kind: "screen", route: "screens/home.html" },
      inputChanges: [],
      relatedComponents: [],
      usedBy: [],
      affected: [],
      removed: false,
      variants: [],
      views: [],
    } as unknown as WorkspaceData,
  );

  assert.equal(
    fakeMarkup(node),
    "<h3>Comparison details</h3>" +
      "<p>Compared with the branch point on main.</p>" +
      "<p>Rendered content changed.</p>" +
      "<p>Changes to these files may affect this screen:</p>" +
      `<ul><li>${SHARED}</li></ul>` +
      "<p>Changed styles that apply to this screen:</p>" +
      '<ul><li><code class="mbk-code">.auth</code></li></ul>' +
      "<p>This stylesheet changed, but none of the changed styles apply to this screen.</p>" +
      "<p>Examined and excluded:</p>" +
      `<ul><li>${TOKENS}</li></ul>`,
  );
  assert.equal(node.hidden, false);
});

test("the terminal line names the screen or the saved view it compared", () => {
  const unmodified = {
    base: "main",
    status: "Unmodified",
    components: [],
    comparisonEligible: false,
    comparisons: true,
    inputChanges: [],
    relatedComponents: [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  };

  const screen = fakePanel();
  renderWorkspaceEvidence(
    screen.panel as unknown as HTMLElement,
    {
      ...unmodified,
      entry: { id: "home", kind: "screen", route: "screens/home.html" },
    } as unknown as WorkspaceData,
  );
  assert.match(fakeMarkup(screen.node), /<p>No changes to this screen\.<\/p>$/);

  const component = fakePanel();
  renderWorkspaceEvidence(
    component.panel as unknown as HTMLElement,
    {
      ...unmodified,
      entry: { id: "badge", kind: "component", route: "components/badge.html" },
    } as unknown as WorkspaceData,
    "default",
  );
  assert.match(
    fakeMarkup(component.node),
    /<p>No changes to this saved view\.<\/p>$/,
  );
});

test("a merged snapshot moves the view marks and the changed-views row", () => {
  const workspace = fakeWorkspace();
  const data = {
    base: "main",
    changedViews: [],
    components: [],
    comparisonEligible: false,
    comparisons: true,
    entry: { id: "home", kind: "screen", route: "screens/home.html" },
    inputChanges: [],
    relatedComponents: [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  } as unknown as WorkspaceData;

  applyViewEvidence(workspace.root, data, "both", "light");
  assert.equal(workspace.dot("scheme").hidden, true);
  assert.equal(workspace.row.hidden, true);
  assert.equal(
    workspace.control("scheme").getAttribute("aria-describedby"),
    null,
  );

  mergeWorkspaceEvidence(data, {
    ...data,
    status: "Changed",
    changedViews: [
      { viewport: "mobile", colorScheme: "dark" },
      { viewport: "desktop", colorScheme: "dark" },
    ],
  } as unknown as WorkspaceData);
  applyViewEvidence(workspace.root, data, "both", "light");

  assert.equal(workspace.dot("scheme").hidden, false);
  assert.equal(workspace.text("scheme").hidden, false);
  assert.equal(
    workspace.control("scheme").getAttribute("aria-describedby"),
    "mb-view-changed-scheme",
  );
  assert.equal(workspace.dot("viewport").hidden, true);
  assert.equal(workspace.row.hidden, false);
  assert.equal(workspace.value.textContent, "Mobile · Dark, Desktop · Dark");

  applyViewEvidence(workspace.root, data, "mobile", "dark");
  assert.equal(workspace.dot("scheme").hidden, true);
  assert.equal(workspace.dot("viewport").hidden, false);
  assert.equal(
    workspace.control("viewport").getAttribute("aria-describedby"),
    "mb-view-changed-viewport",
  );
  assert.equal(workspace.row.hidden, false);
});

function fakeWorkspace() {
  const dots = {
    scheme: new FakeNode("span", { "data-view-changed": "scheme" }),
    viewport: new FakeNode("span", { "data-view-changed": "viewport" }),
  };
  const texts = {
    scheme: new FakeNode("span", { "data-view-changed-text": "scheme" }),
    viewport: new FakeNode("span", { "data-view-changed-text": "viewport" }),
  };
  const controls = {
    scheme: new FakeNode("button", { "data-workspace-scheme": "" }),
    viewport: new FakeNode("select", { "data-workspace-viewport": "" }),
  };
  const value = new FakeNode("span", {
    "data-workspace-changed-views-value": "",
  });
  const row = new FakeNode("div", {
    "data-workspace-changed-views": "",
  }).append(value);
  const root = new FakeNode("section", { "data-workspace": "" }).append(
    new FakeNode("label").append(
      controls.viewport,
      dots.viewport,
      texts.viewport,
    ),
    controls.scheme.append(dots.scheme, texts.scheme),
    row,
  );
  return {
    control: (kind: "scheme" | "viewport") => controls[kind],
    dot: (kind: "scheme" | "viewport") => dots[kind],
    root: root as unknown as HTMLElement,
    row,
    text: (kind: "scheme" | "viewport") => texts[kind],
    value,
  };
}

function fakePanel(): { node: FakeMarkupElement; panel: Element } {
  const node = new FakeMarkupDocument().createElement("section");
  return { node, panel: node as unknown as Element };
}
