import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverUnitFiles,
  nodeShardFiles,
} from "../scripts/verification/evidence.mjs";
import { discoverBrowserTests } from "../scripts/verification/playwright.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

test("the current unit inventory is partitioned exactly once across four shards", async () => {
  const files = await discoverUnitFiles(repositoryRoot);
  const assignments = [1, 2, 3, 4].map((index) =>
    nodeShardFiles(files, { index, total: 4 }),
  );
  assert.ok(assignments.every((group) => group.length > 0));
  assert.equal(new Set(assignments.flat()).size, files.length);
  assert.deepEqual(assignments.flat().sort(), files);
});

test("the current Playwright projects cover every file and test exactly once", async () => {
  const complete = await discoverBrowserTests(repositoryRoot);
  const full = await discoverBrowserTests(repositoryRoot, {
    project: "chromium",
  });
  const hydration = await discoverBrowserTests(repositoryRoot, {
    project: "hydration",
  });
  const groups = [];
  for (const index of [1, 2, 3, 4])
    groups.push(
      await discoverBrowserTests(repositoryRoot, {
        project: "chromium",
        shard: { index, total: 4 },
      }),
    );
  assert.ok(groups.every((group) => group.tests.length > 0));
  assert.deepEqual(groups.flatMap((group) => group.files).sort(), full.files);
  assert.deepEqual(
    groups.flatMap((group) => group.tests.map((item) => item.id)).sort(),
    full.tests.map((item) => item.id).sort(),
  );
  assert.equal(
    new Set(groups.flatMap((group) => group.tests.map((item) => item.id))).size,
    full.tests.length,
  );
  assert.deepEqual([...full.files, ...hydration.files].sort(), complete.files);
  assert.deepEqual(
    [...full.tests, ...hydration.tests].map((item) => item.id).sort(),
    complete.tests.map((item) => item.id).sort(),
  );
});
