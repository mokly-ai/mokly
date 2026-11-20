import assert from "node:assert/strict";
import test from "node:test";

import { pageAt } from "../src/docs/pages.js";
import {
  AUDITED,
  CATEGORIES,
  THRESHOLDS,
  VIEWPORTS,
  budgetTable,
  measurementWithRetry,
  shortfalls,
} from "../src/lighthouse.js";
import { PAGE_METADATA } from "../src/metadata.js";
import { SITE_PATHS } from "../src/navigation.js";

const PASSING = {
  accessibility: 1,
  "best-practices": 1,
  performance: 1,
  seo: 1,
};

test("the budget audits the contracted pages at both viewports", () => {
  assert.deepEqual(
    [...AUDITED],
    [
      SITE_PATHS.home,
      SITE_PATHS.docs,
      "/docs/authoring/config/",
      "/docs/cli/serve/",
      SITE_PATHS.changelog,
      SITE_PATHS.terms,
    ],
  );
  for (const route of AUDITED) {
    assert.ok(
      route === SITE_PATHS.home || pageAt(route) || route in PAGE_METADATA,
      `${route} is not a published route`,
    );
  }
  assert.deepEqual(
    VIEWPORTS.map((viewport) => viewport.width),
    [390, 1440],
  );
  assert.deepEqual(
    VIEWPORTS.map((viewport) => viewport.throttling.cpuSlowdownMultiplier),
    [1, 1],
  );
  assert.deepEqual(CATEGORIES, [
    "accessibility",
    "best-practices",
    "performance",
    "seo",
  ]);
});

test("a failed measurement is retried once", async () => {
  const attempts = [
    { route: "/", scores: { ...PASSING, performance: 0.89 }, viewport: "390" },
    { route: "/", scores: PASSING, viewport: "390" },
  ];
  let calls = 0;
  const measurement = await measurementWithRetry(async () => {
    const attempt = attempts[calls];
    calls += 1;
    assert.ok(attempt);
    return attempt;
  });
  assert.equal(calls, 2);
  assert.deepEqual(measurement, attempts[1]);
});

test("a passing measurement is never repeated", async () => {
  let calls = 0;
  const measurement = await measurementWithRetry(async () => {
    calls += 1;
    return { route: "/", scores: PASSING, viewport: "1440" };
  });
  assert.equal(calls, 1);
  assert.deepEqual(shortfalls(measurement), []);
});

test("the retry remains a hard gate when its score still fails", async () => {
  let calls = 0;
  const measurement = await measurementWithRetry(async () => {
    calls += 1;
    return {
      route: "/",
      scores: { ...PASSING, accessibility: 0.99 },
      viewport: "390",
    };
  });
  assert.equal(calls, 2);
  assert.deepEqual(shortfalls(measurement), ["accessibility"]);
});

test("the budget requires perfect accessibility and 0.95 for other scores", () => {
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
