import assert from "node:assert/strict";
import test from "node:test";

import { renderWorkspaceEvidence } from "../packages/viewer/dist/client/workspace_evidence.js";
import { mergeWorkspaceEvidence } from "../packages/viewer/dist/client/workspace_updates.js";
import { applyViewEvidence } from "../packages/viewer/dist/client/workspace_views.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import type { FakeMarkupElement } from "./helpers/fake_markup.js";
import { FakeMarkupDocument, fakeMarkup } from "./helpers/fake_markup.js";
import { fakeStatusWorkspace } from "./helpers/workspace_status_dom.js";

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
    viewStates: {},
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
  const workspace = fakeStatusWorkspace();
  const data = {
    base: "main",
    changedViews: { default: [], disabled: [] },
    components: [],
    comparisonEligible: false,
    comparisons: true,
    entry: { id: "action", kind: "component", route: "components/action.html" },
    inputChanges: [],
    relatedComponents: [],
    status: "Changed",
    usedBy: [],
    affected: [],
    removed: false,
    variants: [
      {
        value: { id: "default" },
        removed: false,
        comparisonEligible: false,
        status: "Unmodified",
      },
      {
        value: { id: "disabled" },
        removed: false,
        comparisonEligible: true,
        status: "Changed",
      },
    ],
    viewStates: {
      default: [
        { viewport: "mobile", colorScheme: "light", state: "unchanged" },
        { viewport: "desktop", colorScheme: "light", state: "unchanged" },
      ],
    },
    views: [],
  } as unknown as WorkspaceData;

  applyViewEvidence(workspace.root, data, "both", "light", "default");
  assertShown(workspace, "Unmodified", true);
  assert.equal(workspace.dot("scheme").hidden, true);
  assert.equal(workspace.row.hidden, true);
  assert.equal(
    workspace.control("scheme").getAttribute("aria-describedby"),
    null,
  );

  mergeWorkspaceEvidence(data, {
    ...data,
    status: "Changed",
    changedViews: {
      default: [],
      disabled: [
        { viewport: "mobile", colorScheme: "dark" },
        { viewport: "desktop", colorScheme: "dark" },
      ],
    },
    viewStates: {
      default: [
        { viewport: "mobile", colorScheme: "light", state: "unchanged" },
        { viewport: "mobile", colorScheme: "dark", state: "unchanged" },
        { viewport: "desktop", colorScheme: "light", state: "unchanged" },
        { viewport: "desktop", colorScheme: "dark", state: "unchanged" },
      ],
      disabled: [
        { viewport: "mobile", colorScheme: "light", state: "unchanged" },
        { viewport: "mobile", colorScheme: "dark", state: "changed" },
        { viewport: "desktop", colorScheme: "light", state: "unchanged" },
        { viewport: "desktop", colorScheme: "dark", state: "changed" },
      ],
    },
  } as unknown as WorkspaceData);
  assert.deepEqual(data.viewStates.disabled, [
    { viewport: "mobile", colorScheme: "light", state: "unchanged" },
    { viewport: "mobile", colorScheme: "dark", state: "changed" },
    { viewport: "desktop", colorScheme: "light", state: "unchanged" },
    { viewport: "desktop", colorScheme: "dark", state: "changed" },
  ]);
  applyViewEvidence(workspace.root, data, "both", "light", "default");

  assert.equal(workspace.dot("scheme").hidden, true);
  assert.equal(workspace.row.hidden, true);

  applyViewEvidence(workspace.root, data, "both", "light", "disabled");

  assertShown(workspace, "Unmodified", true);
  assert.equal(workspace.dot("scheme").hidden, false);
  assert.equal(workspace.text("scheme").hidden, false);
  assert.equal(
    workspace.control("scheme").getAttribute("aria-describedby"),
    "mb-view-changed-scheme",
  );
  assert.equal(workspace.dot("viewport").hidden, true);
  assert.equal(workspace.row.hidden, false);
  assert.equal(workspace.value.textContent, "Mobile · Dark, Desktop · Dark");

  applyViewEvidence(workspace.root, data, "mobile", "dark", "disabled");
  assertShown(workspace, "Changed", false);
  assert.equal(workspace.dot("scheme").hidden, true);
  assert.equal(workspace.dot("viewport").hidden, false);
  assert.equal(
    workspace.control("viewport").getAttribute("aria-describedby"),
    "mb-view-changed-viewport",
  );
  assert.equal(workspace.row.hidden, false);

  workspace.current.setAttribute("aria-pressed", "false");
  workspace.side.setAttribute("aria-pressed", "true");
  applyViewEvidence(workspace.root, data, "mobile", "dark", "default");
  assertShown(workspace, "Unmodified", true);
  assert.equal(workspace.current.getAttribute("aria-pressed"), "true");
  assert.equal(workspace.side.getAttribute("aria-pressed"), "false");
  assert.equal(workspace.dot("viewport").hidden, true);
  assert.equal(workspace.row.hidden, true);
});

function assertShown(
  workspace: ReturnType<typeof fakeStatusWorkspace>,
  status: "Changed" | "Unmodified",
  toolbarHidden: boolean,
): void {
  assert.equal(workspace.status.textContent, status);
  assert.equal(workspace.status.getAttribute("data-status"), status);
  assert.equal(workspace.status.hidden, false);
  assert.equal(workspace.toolbar.hidden, toolbarHidden);
}

function fakePanel(): { node: FakeMarkupElement; panel: Element } {
  const node = new FakeMarkupDocument().createElement("section");
  return { node, panel: node as unknown as Element };
}
