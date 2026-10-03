import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { componentCssDocuments } from "../dist/review/css/containment.js";
import { CssResourceAnalysis } from "../dist/review/css/resource_analysis.js";
import { selectedComponentResult } from "../dist/review/selection_result.js";

import {
  changedIds,
  cssMembershipFixture,
  membershipSource,
} from "./helpers/css_membership_fixture.js";

test("equal changes in distinct generated entry bundles share component proof", async (t) => {
  const { result } = await cssMembershipFixture(t, {
    delivery: "javascript",
    separateRoots: true,
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  assert.deepEqual(changedIds(result), ["action", "action-default"]);
  const own = result.components.find((entry) => entry.id === "action")!
    .variants[0]!.views[0]!.reasons![0]!;
  const screen = result.screens[0]!.views[0]!.reasons![0]!;
  assert.notEqual(own.path, screen.path);
  assert.deepEqual(own.analysis!.rules, screen.analysis!.rules);
  const selected = selectedComponentResult(result, { id: "checkout" });
  assert.deepEqual(
    selected.screens[0]!.views[0]!.reasons,
    result.screens[0]!.views[0]!.reasons,
  );
});

test("duplicates aggregate one identity while retaining matches from each condition", () => {
  const analyzer = new CssResourceAnalysis();
  const evidence = analyzer.analyze(
    [
      {
        path: "shared.css",
        before: ".a{color:red}@media(width>10px){.a{color:red}}",
        after: ".a{color:blue}@media(width>10px){.a{color:blue}}",
      },
    ],
    [{ after: parse('<p class="a">Text</p>') }],
  );
  assert.equal(evidence.reasons![0]!.analysis!.rules.length, 1);
  assert.deepEqual(evidence.reasons![0]!.analysis!.pageEvidence, {
    selectors: [".a"],
  });
});

test("equal after declarations do not combine different before sides", () => {
  const analyzer = new CssResourceAnalysis();
  const usage = {
    viewport: "mobile" as const,
    colorScheme: "light" as const,
    instances: [],
    slots: [],
    styles: [],
    resources: [],
    ranges: [{ id: "r-0", target: { kind: "root" as const } }],
  };
  const html =
    '<html><body><!--mokly-component:start:r-0--><b class="a">Text</b><!--mokly-component:end:r-0--></body></html>';
  analyzer.analyze(
    [{ path: "own.css", before: ".a{color:red}", after: ".a{color:blue}" }],
    [componentCssDocuments(html, html, "own.html", usage, usage, "action")],
  );
  const other = analyzer.analyze(
    [
      {
        path: "consumer.css",
        before: ".a{color:green}",
        after: ".a{color:blue}",
      },
    ],
    [{ after: parse('<b class="a">Text</b>') }],
  );
  analyzer.attribution.freeze();
  const reason = analyzer.attribution.project(other.reasons![0]!, "page")!;
  assert.deepEqual(reason.analysis!.rules[0]!.changedComponentIds, []);
  assert.deepEqual(reason.analysis!.pageEvidence, { selectors: [".a"] });
});

test("added and removed stylesheet rules have distinct keys and test both document sides", () => {
  const analyzer = new CssResourceAnalysis();
  const document = parse('<b class="a">Text</b>');
  const evidence = analyzer.analyze(
    [
      { path: "added.css", after: ".a{color:red}" },
      { path: "removed.css", before: ".a{color:red}" },
    ],
    [{ before: document }],
  );
  const reasons = evidence.reasons!;
  assert.equal(reasons.length, 2);
  assert.notEqual(
    reasons[0]!.analysis!.rules[0]!.ruleKey,
    reasons[1]!.analysis!.rules[0]!.ruleKey,
  );
  for (const reason of reasons)
    assert.deepEqual(reason.analysis!.pageEvidence, { selectors: [".a"] });
});

test("added and removed saved views retain CSS proof only from their existing side", async (t) => {
  const { result } = await cssMembershipFixture(t, {
    before: ".action{color:red}",
    after: ".action{color:blue}",
    afterSource: membershipSource.replace("action-default", "action-new"),
  });
  const variants = result.components.find(
    (entry) => entry.id === "action",
  )!.variants;
  for (const variant of variants)
    for (const view of variant.views) {
      assert.equal(
        view.state,
        variant.id === "action-new" ? "added" : "removed",
      );
      assert.equal(view.material, true);
      assert.deepEqual(
        view.reasons![0]!.analysis!.rules[0]!.changedComponentIds,
        ["action"],
      );
    }
});
