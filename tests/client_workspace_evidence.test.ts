import assert from "node:assert/strict";
import test from "node:test";

import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import {
  entry,
  loaded,
  record,
  renderEvidence,
  view,
} from "./helpers/workspace_evidence.js";

const SHARED = "static/shared.css";
const TOKENS = "static/tokens.css";

test("the inspector lists changed files, applying styles, then exclusions", () => {
  const home = entry(
    "screen",
    "home",
    "Home",
    [{ kind: "dependency", path: SHARED }, { kind: "material" }],
    [
      view("mobile", "changed", [record(SHARED, ".auth")]),
      view("desktop", "unchanged", [record(TOKENS, "", "excluded")]),
    ],
  );
  const markup = renderEvidence(
    {
      base: "main",
      status: "Changed",
      components: [],
      comparisonEligible: true,
      comparisons: true,
      entry: { path: "home", kind: "screen", route: "home/index.html" },
      inputChanges: [],
      relatedComponents: [],
      usedBy: [],
      affected: [],
      removed: false,
      variants: [],
      views: [],
    } as unknown as WorkspaceData,
    undefined,
    loaded(home),
  );

  assert.equal(
    markup,
    '<section class="mbk-comparison-evidence" data-workspace-evidence="">' +
      "<h3>Comparison details</h3>" +
      "<p>Compared with the branch point on main.</p>" +
      "<p>Rendered content changed.</p>" +
      "<p>Changes to these files may affect this screen:</p>" +
      `<ul class="mbk-evidence-files"><li>${SHARED}` +
      "<p>Changed styles that apply to this screen:</p>" +
      '<ul><li><code class="mbk-code">.auth</code></li></ul>' +
      "</li></ul>" +
      "<p>This stylesheet changed, but none of the changed styles apply to this screen.</p>" +
      "<p>Examined and excluded:</p>" +
      `<ul><li>${TOKENS}</li></ul>` +
      "</section>",
  );
});

test("the terminal line names the screen or the variant it compared", () => {
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

  const screen = renderEvidence({
    ...unmodified,
    entry: { path: "home", kind: "screen", route: "home/index.html" },
  } as unknown as WorkspaceData);
  assert.match(screen, /<p>No changes to this screen\.<\/p><\/section>$/);

  const component = renderEvidence(
    {
      ...unmodified,
      entry: { path: "badge", kind: "component", route: "badge/index.html" },
    } as unknown as WorkspaceData,
    "default",
  );
  assert.match(component, /<p>No changes to this variant\.<\/p><\/section>$/);
});
