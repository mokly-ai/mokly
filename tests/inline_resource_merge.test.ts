import assert from "node:assert/strict";
import test from "node:test";

import { discoverInlineResourceOwners } from "../src/review/component_inline_resources.js";
import { ownedResourceReasons } from "../src/review/component_resource_attribution.js";
import { ComponentMaterialReader } from "../src/review/component_resources.js";
import { mapUsagePaths } from "../src/review/moves/identity.js";

import {
  analyzeInline,
  html,
  instance,
  markedRange,
  range,
  view,
} from "./helpers/inline_styles.js";

const action = instance(1, "action");
const usage = {
  ...view({
    instances: [action],
    ranges: [range(0, { kind: "instance", instanceKey: action.key })],
  }),
  styles: [],
  resources: [{ path: "asset.svg", componentIds: ["action"] }],
  insertedStylesheets: [],
};

test("move normalization maps explicit resource owners without changing their paths", () => {
  const mapped = mapUsagePaths(usage, (id) => `new/${id}`);
  assert.deepEqual(mapped.resources, [
    { path: "asset.svg", componentIds: ["new/action"] },
  ]);
  assert.deepEqual(usage.resources, [
    { path: "asset.svg", componentIds: ["action"] },
  ]);
});

test("inline owner traversal follows CSS to assets but never owns CSS", async () => {
  const body = markedRange(0, '<button class="target">Action</button>');
  const source = (color: string) =>
    html(
      `<style>.target{color:${color};background:url("../owned.css")}</style>`,
      body,
    );
  const { result } = analyzeInline({
    before: source("red"),
    after: source("blue"),
    beforeUsage: usage,
    afterUsage: usage,
  });
  const reader = new ComponentMaterialReader({
    read: async (path) =>
      Buffer.from(
        path === "owned.css"
          ? '.target{background:url("asset.svg")}'
          : "<svg></svg>",
      ),
  });
  const side = { path: "home/index.html", reader };
  const owners = await discoverInlineResourceOwners(
    result,
    side,
    side,
    "mockups",
    true,
  );
  assert.deepEqual(
    [...owners].map(([path, ids]) => [path, [...ids]]),
    [["mockups/asset.svg", ["action"]]],
  );
});

test("non-CSS reasons union explicit and inferred owners and exclude CSS", () => {
  const pane = instance(2, "pane");
  const recorded = { ...usage, instances: [action, pane] };
  const reasons = ownedResourceReasons(
    [
      { kind: "dependency", path: "mockups/asset.svg" },
      { kind: "dependency", path: "mockups/owned.css" },
    ],
    "mockups",
    new Map([
      ["mockups/asset.svg", new Set(["pane"])],
      ["mockups/owned.css", new Set(["pane"])],
    ]),
    recorded,
    recorded,
  );
  assert.deepEqual(reasons.map(({ componentId }) => componentId).sort(), [
    "action",
    "pane",
  ]);
  assert.ok(reasons.every(({ reason }) => reason.path === "mockups/asset.svg"));
});
