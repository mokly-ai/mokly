import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AUDITED,
  CATEGORIES,
  THRESHOLDS,
  VIEWPORTS,
  budgetTable,
  shortfalls,
} from "../src/lighthouse.js";
import { SITE_PATHS } from "../src/navigation.js";
import { repositoryPath } from "../src/workspace.js";

const PASSING = {
  accessibility: 1,
  "best-practices": 1,
  performance: 1,
  seo: 1,
};

test("the budget audits the contracted pages at both viewports", () => {
  assert.deepEqual(
    [...AUDITED],
    [SITE_PATHS.home, SITE_PATHS.docs, SITE_PATHS.changelog, SITE_PATHS.terms],
  );
  assert.deepEqual(
    VIEWPORTS.map((viewport) => viewport.width),
    [390, 1440],
  );
  assert.deepEqual(CATEGORIES, [
    "accessibility",
    "best-practices",
    "performance",
    "seo",
  ]);
});

test("the thresholds match the delivery contract", () => {
  const contract = readFileSync(
    repositoryPath("docs", "protocol", "site-delivery.md"),
    "utf8",
  );
  assert.match(
    contract,
    /performance ≥ 0\.95, *\n?accessibility = 1\.0, best practices ≥ 0\.95, SEO ≥ 0\.95/,
  );
  assert.deepEqual(THRESHOLDS, {
    accessibility: 1,
    "best-practices": 0.95,
    performance: 0.95,
    seo: 0.95,
  });
});

test("a score under its threshold is reported, and an equal score is not", () => {
  assert.deepEqual(
    shortfalls({ route: "/", scores: PASSING, viewport: "390" }),
    [],
  );
  assert.deepEqual(
    shortfalls({
      route: "/",
      scores: { ...PASSING, accessibility: 0.99, performance: 0.95 },
      viewport: "390",
    }),
    ["accessibility"],
  );
  assert.deepEqual(
    shortfalls({ route: "/", scores: {}, viewport: "390" }),
    CATEGORIES,
  );
});

test("the printed table names every row and every shortfall", () => {
  const table = budgetTable([
    { route: "/", scores: PASSING, viewport: "390" },
    {
      route: "/docs/",
      scores: { ...PASSING, performance: 0.4 },
      viewport: "1440",
    },
  ]);
  assert.equal(table.length, 4);
  assert.match(table[0] ?? "", /^route +viewport +accessibility/);
  assert.match(table[2] ?? "", /^\/ +390 +1\.00 +1\.00 +1\.00 +1\.00 +pass$/);
  assert.match(table[3] ?? "", /0\.40.+fail \(performance\)$/);
});
