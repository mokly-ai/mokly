import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { options } from "../scripts/large/options.js";

import {
  areaPaths,
  counts,
  stylesheetRules,
} from "./fixtures/large/dimensions.js";
import { generateLargeFixture, largeSize } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("large fixture validates dimensions and retains default route scale", () => {
  assert.deepEqual(largeSize({}), {
    areas: 30,
    screens: 40,
    rows: 12,
    stylesheets: 4,
    stylesheetShare: 0.5,
  });
  assert.deepEqual(counts(largeSize({})), { routes: 1620, documents: 5850 });
  for (const field of ["areas", "screens", "rows"])
    for (const value of [0, -1, 1.5, NaN, Infinity])
      assert.throws(() => largeSize({ [field]: value }), /positive integer/);
  assert.throws(() => largeSize({ screens: 1 }), /at least two/);
  for (const value of [-1, 1.5, NaN, Infinity])
    assert.throws(
      () => largeSize({ stylesheets: value }),
      /non-negative integer/,
    );
  for (const value of [-0.1, 1.1, NaN, Infinity])
    assert.throws(
      () => largeSize({ stylesheetShare: value }),
      /between 0 and 1/,
    );
  for (const args of [
    ["--stylesheets", "-1"],
    ["--stylesheets", "1.5"],
    ["--stylesheets"],
    ["--stylesheet-share", "1.1"],
    ["--stylesheet-share", "-0.1"],
    ["--stylesheet-share"],
  ])
    assert.throws(
      () => options(["generate", ...args]),
      /needs a value|non-negative integer|between 0 and 1/,
    );
});

test("folder membership and flow tails remain valid at each group boundary", () => {
  for (const count of [10, 11, 20, 21]) {
    const { screens, flows } = areaPaths("area-1", count);
    assert.equal(new Set(screens).size, count);
    assert.equal(flows.length, Math.ceil(count / 10));
    assert.ok(
      flows.every(
        (group) =>
          group.length >= 2 && group.every((entry) => screens.includes(entry)),
      ),
    );
    assert.equal(screens[0], "area-1/screens/activity-group-1/screen-1");
    if (count > 10)
      assert.equal(screens[10], "area-1/screens/activity-group-2/screen-11");
    if (count % 10 === 1)
      assert.deepEqual(flows.at(-1), [screens.at(-1), screens[0]]);
  }
});

test("stylesheet selection includes only the configured leading share", () => {
  for (const dimensions of [
    { stylesheets: 0 },
    { stylesheetShare: 0 },
    { stylesheetShare: 1 },
    { stylesheetShare: 0.34 },
  ]) {
    const size = largeSize({ areas: 1, screens: 3, ...dimensions });
    const rules = stylesheetRules(size);
    const shared = rules
      .flatMap((rule) => rule.stylesheets)
      .filter((file) => file.includes("shared-"));
    assert.equal(
      shared.length,
      size.stylesheets * size.stylesheetShare === 0 ? 0 : size.stylesheets,
    );
    if (shared.length) {
      const numbers = rules[0]!.match
        .match(/screen-\{(.*?)\}/)![1]!
        .split(",")
        .map(Number);
      assert.deepEqual(
        numbers,
        Array.from(
          { length: Math.ceil(3 * size.stylesheetShare) },
          (_, i) => i + 1,
        ),
      );
    }
  }
});

test("both generators protect existing files and emit individual definitions", async (t) => {
  for (const variant of ["html", "react"] as const) {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/large-generator-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const fixture = await generateLargeFixture(
      root,
      { areas: 1, screens: 3, rows: 1 },
      variant,
    );
    assert.deepEqual(
      { routes: fixture.routes, documents: fixture.documents },
      { routes: 14, documents: 47 },
    );
    const config = JSON.parse(await fs.readFile(fixture.configPath, "utf8"));
    assert.equal(
      config.renderer,
      variant === "react" ? "renderer.tsx" : undefined,
    );
    assert.equal(
      (await fs.readdir(path.join(root, "assets"))).filter((name) =>
        name.startsWith("shared-"),
      ).length,
      4,
    );
    if (variant === "react") {
      const module = await fs.readFile(
        path.join(root, "specs/area-1/catalogue.mockup.tsx"),
        "utf8",
      );
      assert.equal(module.match(/export const /g)?.length, 7);
      assert.ok(!module.includes("export const mockups"));
    }
    const before = await fs.readFile(fixture.configPath);
    await assert.rejects(generateLargeFixture(root, {}), /empty directory/);
    assert.deepEqual(await fs.readFile(fixture.configPath), before);
  }
});

test("zero shared stylesheets creates no files or shared selections", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-zero-styles-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await generateLargeFixture(root, {
    areas: 1,
    screens: 2,
    rows: 1,
    stylesheets: 0,
  });
  assert.deepEqual(
    (await fs.readdir(path.join(root, "assets"))).filter((name) =>
      name.startsWith("shared-"),
    ),
    [],
  );
  const config = await fs.readFile(fixture.configPath, "utf8");
  assert.ok(!config.includes("shared-"));
});
