import assert from "node:assert/strict";
import test from "node:test";

import { behaviourTable } from "../scripts/rebuild/behaviour-table.mjs";
import { adaptLegacyScenario } from "../scripts/rebuild/legacy-adapter.mjs";

import { scenarioFixture } from "./helpers/rebuild_scenario.js";

test("inventory drops shell and generation paths and keeps both resource sides", () => {
  const input = scenarioFixture();
  input.inventory.files = [
    { path: "mokly-viewer/client/inspector.js", sha256: "hash", size: 5 },
    {
      path: "static/mokly-generated/start/index.desktop.light.html",
      sha256: "hash",
      size: 5,
    },
    { path: "static/mokly-generated/images/mark.svg", sha256: "hash", size: 5 },
    {
      path: "mokly-viewer/diffs/generations/hash/snapshots/before/theme.css",
      sha256: "hash",
      size: 5,
    },
  ];
  assert.deepEqual(
    behaviourTable(input, adaptLegacyScenario).exportedResources,
    [
      { side: "before", path: "theme.css" },
      { side: "after", path: "images/mark.svg" },
    ].sort((left, right) => (left.path < right.path ? -1 : 1)),
  );
});

test("CSS evidence maps component and entry owners without copying source fields", () => {
  const input = scenarioFixture();
  const rule =
    input.review.screens[0]!.views[0]!.reasons[0]!.analysis.rules[0]!;
  rule.pageSelectors = [".start"];
  const table = behaviourTable(input, adaptLegacyScenario);
  const kept = table.views.find((view) => view.path === "start")!.kept[0]!;
  assert.deepEqual(kept.owners, [
    { kind: "component", path: "action", selectors: [] },
    { kind: "screen", path: "start", selectors: [".start"] },
  ]);
  assert.equal(kept.key, '["theme.css",[".start"]]');
  assert.equal(kept.status, "applies");
});
