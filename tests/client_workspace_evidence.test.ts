import assert from "node:assert/strict";
import test from "node:test";

import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import {
  entry,
  record,
  renderEvidence,
  view,
} from "./helpers/workspace_evidence.js";

const SHARED = "static/shared.css";
const TOKENS = "static/tokens.css";

test("the inspector lists changed files, applying styles, then exclusions", () => {
  const reasons = [
    { kind: "dependency", path: SHARED },
    { kind: "material" },
  ] as const;
  const home = entry("screen", "home", reasons, [
    view("mobile", "changed", [record(SHARED, ".auth")]),
    view("desktop", "unchanged", [record(TOKENS, "", "excluded")]),
  ]);
  const markup = renderEvidence(
    {
      base: "main",
      status: "Changed",
      components: [],
      comparisonEligible: true,
      comparisons: true,
      entry: { path: "home", kind: "screen", route: "home/index.html" },
      inputChanges: [],
      // The routed detail's direct reasons reach Details with the record.
      reasons,
      relatedComponents: [],
      usedBy: [],
      affected: [],
      removed: false,
      variants: [],
      views: [],
    } as unknown as WorkspaceData,
    undefined,
    home,
  );

  assert.equal(
    markup,
    '<section class="mbk-comparison-evidence mbk-reset" data-workspace-evidence="">' +
      '<h3 class="mbk-reset">Comparison details</h3>' +
      '<p class="mbk-reset">Compared with the branch point on main.</p>' +
      '<p class="mbk-reset">Rendered content changed.</p>' +
      '<p class="mbk-reset">Changes to these files may affect this screen:</p>' +
      `<ul class="mbk-evidence-files mbk-reset"><li class="mbk-reset">${SHARED}` +
      '<p class="mbk-reset">Changed styles that apply to this screen:</p>' +
      '<ul class="mbk-reset"><li class="mbk-reset"><code class="mbk-code mbk-reset">.auth</code></li></ul>' +
      "</li></ul>" +
      '<p class="mbk-reset">This stylesheet changed, but none of the changed styles apply to this screen.</p>' +
      '<p class="mbk-reset">Examined and excluded:</p>' +
      `<ul class="mbk-reset"><li class="mbk-reset">${TOKENS}</li></ul>` +
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
  assert.match(
    screen,
    /<p class="mbk-reset">No changes to this screen\.<\/p><\/section>$/,
  );

  const component = renderEvidence(
    {
      ...unmodified,
      entry: { path: "badge", kind: "component", route: "badge/index.html" },
    } as unknown as WorkspaceData,
    "default",
  );
  assert.match(
    component,
    /<p class="mbk-reset">No changes to this variant\.<\/p><\/section>$/,
  );
});
