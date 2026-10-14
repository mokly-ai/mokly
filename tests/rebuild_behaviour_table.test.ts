import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  behaviourTable,
  readScenario,
} from "../scripts/rebuild/behaviour-table.mjs";

import { axes, scenarioFixture } from "./helpers/rebuild_scenario.js";

test("legacy capture keeps entry kinds, removals, states, and reasons", () => {
  const table = behaviourTable(scenarioFixture());
  assert.deepEqual(
    table.entries.map(({ kind, path, removed }) => [kind, path, removed]),
    [
      ["component", "action", false],
      ["document", "guide", false],
      ["page", "handbook", false],
      ["screen", "start", false],
      ["use-case", "tour", false],
      ["screen", "old", true],
    ].sort((a, b) =>
      JSON.stringify({ kind: a[0], path: a[1], removed: a[2] }) <
      JSON.stringify({ kind: b[0], path: b[1], removed: b[2] })
        ? -1
        : 1,
    ),
  );
  assert.ok(
    table.changes.some(
      (change) =>
        change.path === "start" &&
        change.state === "changed" &&
        JSON.stringify(change.reasons) === '[{"kind":"material"}]',
    ),
  );
  assert.ok(table.changes.some((change) => change.path === "guide"));
  assert.ok(table.changes.some((change) => change.path === "handbook"));
  assert.ok(
    table.changes.some(
      (change) => change.path === "old" && change.state === "removed",
    ),
  );
  assert.equal(JSON.stringify(table).includes("ignored-deployment"), false);
  assert.equal(JSON.stringify(table).includes("ignored-digest"), false);
});

test("legacy view evidence keeps ignored regions, matched rules, and exclusions", () => {
  const table = behaviourTable(scenarioFixture());
  const view = table.views.find((item) => item.path === "start");
  assert.deepEqual(view, {
    kind: "screen",
    path: "start",
    ...axes,
    state: "ignored-only",
    ignoredIds: ["clock"],
    kept: [
      {
        resource: "theme.css",
        ruleKey: "rule-1",
        status: "matched",
        selectors: [".start"],
        components: ["action"],
        pageSelectors: [],
      },
    ],
    excluded: [{ resource: "unused.css", reason: "no-matching-rule" }],
  });
  assert.deepEqual(table.resourceClosures, [
    {
      kind: "screen",
      path: "start",
      ...axes,
      resources: ["mark.svg", "theme.css"],
    },
  ]);
  assert.deepEqual(table.affectedConsumers, [
    {
      component: "action",
      consumer: { kind: "screen", path: "start" },
      evidence: [
        {
          side: "after",
          kind: "screen",
          path: "start",
          ...axes,
          via: [{ depth: 0, componentId: "action", instanceKey: "primary" }],
        },
      ],
    },
  ]);
});

test("component variants and unresolved resource evidence stay per view", () => {
  const input = scenarioFixture();
  const table = behaviourTable({
    ...input,
    review: {
      ...input.review,
      components: [
        {
          path: "action",
          state: "changed",
          variants: [
            {
              path: "action/primary",
              state: "changed",
              views: [
                {
                  ...axes,
                  state: "changed",
                  reasons: [
                    { kind: "dependency", path: "icon.svg" },
                    {
                      kind: "dependency",
                      path: "theme.css",
                      analysis: { status: "unresolved", selectors: [] },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  const variant = table.views.find((view) => view.path === "action/primary");
  assert.equal(variant?.kind, "component");
  assert.deepEqual(variant?.kept, [
    { resource: "icon.svg", selectors: [], status: "resource" },
    { resource: "theme.css", selectors: [], status: "unresolved" },
  ]);
});

test("table is byte-identical after input set order and deployment ids change", () => {
  const input = scenarioFixture();
  const first = JSON.stringify(behaviourTable(input));
  input.catalogue.deploymentId = "another-id";
  input.inventory.files.reverse();
  input.closures[0]!.resources.reverse();
  input.inventory.files.push(input.inventory.files[0]!);
  assert.equal(JSON.stringify(behaviourTable(input)), first);
});

test("partial captures report missing outputs and reject unsupported versions", () => {
  const table = behaviourTable({});
  assert.deepEqual(table.availability, {
    catalogue: false,
    review: false,
    inventory: false,
    closures: false,
  });
  assert.deepEqual(table.entries, []);
  for (const [name, input] of Object.entries({
    catalogue: { schemaVersion: 7 },
    review: { schemaVersion: 8 },
    inventory: { schemaVersion: 4 },
  }))
    assert.throws(
      () => behaviourTable({ [name]: input }),
      /Unsupported .* version/,
    );
});

test("capture CLI integration reads JSON and writes a reproducible table", async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-behaviour-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const input = scenarioFixture();
  for (const [name, value] of [
    ["catalogue", input.catalogue],
    ["review", input.review],
    ["export-inventory", input.inventory],
    ["resource-closures", input.closures],
  ] as const)
    await fs.writeFile(
      path.join(directory, `${name}.json`),
      JSON.stringify(value),
    );
  const script = path.resolve(
    import.meta.dirname,
    "../scripts/rebuild/behaviour-table.mjs",
  );
  execFileSync(process.execPath, [script, directory]);
  const actual = JSON.parse(
    await fs.readFile(path.join(directory, "behaviour-table.json"), "utf8"),
  );
  assert.deepEqual(actual, behaviourTable(await readScenario(directory)));
  await fs.writeFile(path.join(directory, "review.json"), "invalid JSON");
  await assert.rejects(readScenario(directory), SyntaxError);
});

test("moved base resource closures keep the entry kind and the before side", () => {
  const input = scenarioFixture();
  const table = behaviourTable({
    ...input,
    catalogue: {
      ...input.catalogue,
      screens: [
        { kind: "screen", path: "new-start", previousPath: "old-start" },
      ],
    },
    closures: [
      { path: "old-start", side: "before", ...axes, resources: ["base.css"] },
    ],
  });
  assert.deepEqual(table.resourceClosures, [
    {
      kind: "screen",
      path: "old-start",
      side: "before",
      ...axes,
      resources: ["base.css"],
    },
  ]);
});
