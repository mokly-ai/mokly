import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { executeMatrix } from "../scripts/large/matrix.mjs";
import { sampleOutcome } from "../scripts/large/outcomes.mjs";
import { browseMembership } from "../scripts/large/sample.mjs";
import {
  classificationScenarios,
  prepareClassificationScenario,
  restoreFixtureSetup,
  selectScenarios,
} from "../scripts/large/scenarios.mjs";
import { prepareFixture } from "../scripts/large/setup.mjs";

import { largeSize } from "./fixtures/large/generate.js";
import { fixtureSetupTree } from "./helpers/file_tree.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("CLI rejects missing, unknown and non-benchmark scenario filters before preparation", async () => {
  const execute = promisify(execFile);
  for (const args of [
    ["benchmark", "--scenario"],
    ["benchmark", "--scenario", "--inline-styles"],
    ["benchmark", "--scenario", "unknown"],
    ["serve", "--scenario", "no-changes"],
    ["generate", "--scenario", "no-changes"],
  ])
    await assert.rejects(
      execute(process.execPath, ["scripts/large/cli.mjs", ...args], {
        cwd: repositoryRoot,
      }),
      (error: Error & { stderr?: string }) =>
        /benchmark-only filter|Unknown classification scenario/.test(
          error.stderr ?? "",
        ),
    );
});

test("scenario filters are exact, deduplicated and ordered before any scenario edit", () => {
  assert.deepEqual(
    selectScenarios(["linked-stylesheet", "no-changes", "no-changes"]).map(
      ({ name }) => name,
    ),
    ["no-changes", "linked-stylesheet"],
  );
  assert.deepEqual(selectScenarios(), classificationScenarios);
  assert.throws(() => selectScenarios(["unknown"]), /Unknown/);
  assert.throws(() => selectScenarios([""]), /Unknown/);
  assert.deepEqual(
    browseMembership(
      '<div data-changes-status="ready"><a data-changed="true" data-entry-id="two" data-route="screens/two.html"></a><a data-changed-variants="true" data-entry-id="one"></a></div>',
    ),
    { changedIds: ["two"], changedRoutes: ["screens/two.html"] },
  );
  assert.throws(
    () => browseMembership('<div data-changes-status="pending"></div>'),
    /not complete/,
  );
});

test(
  "a failed matrix retains every cold/warm sample and restores real generated setup source and outputs",
  { timeout: 120_000 },
  async (testContext) => {
    const size = largeSize({
      areas: 1,
      screens: 2,
      rows: 2,
      stylesheets: 1,
      stylesheetShare: 0.38,
    });
    const fixture = await prepareFixture(repositoryRoot, size, false);
    testContext.after(async () => {
      await fs.rm(fixture.root, { recursive: true, force: true });
      await fs.rm(
        path.join(repositoryRoot, ".context/large-1-2-2-1-0.38.json"),
        { force: true },
      );
    });
    const renderer = path.join(fixture.root, "renderer.tsx");
    const stylesheet = path.join(fixture.root, "mockups/assets/shared-1.css");
    const setup = await fixtureSetupTree(fixture.root);
    const record = await fs.readFile(
      path.join(fixture.root, ".mokly-large-fixture.json"),
      "utf8",
    );
    let closed = false;
    const definitions = classificationScenarios.filter(
      ({ name }) => name !== "linked-stylesheet",
    );
    const matrix = await executeMatrix(definitions, {
      prepare: async (scenario) => {
        await prepareClassificationScenario(
          repositoryRoot,
          fixture,
          scenario.name,
        );
      },
      sample: async (scenario, state) => {
        const source = await fs.readFile(renderer, "utf8");
        const css = await fs.readFile(stylesheet, "utf8");
        assert.equal(
          source.includes('"rgba(4,5,6,1.00)"'),
          scenario.name === "component-style",
        );
        assert.equal(
          source.includes('"screen-edit"'),
          scenario.name === "screen-markup",
        );
        assert.equal(
          css.includes(".scale-unrelated-rule"),
          scenario.name === "linked-stylesheet",
        );
        throw new Error(`Recorded ${scenario.name}/${state} failure`);
      },
      close: async () => {
        closed = true;
      },
      restore: async () => {
        assert.ok(closed);
        await restoreFixtureSetup(repositoryRoot, fixture);
      },
    });
    assert.equal(matrix.runs.length, 6);
    assert.ok(matrix.runs.every(({ outcome }) => outcome === "error"));
    for (const run of matrix.runs)
      assert.equal(run.error, `Recorded ${run.scenario}/${run.state} failure`);
    assert.equal(matrix.restorationError, undefined);
    assert.deepEqual(await fixtureSetupTree(fixture.root), setup);
    assert.equal(
      await fs.readFile(
        path.join(fixture.root, ".mokly-large-fixture.json"),
        "utf8",
      ),
      record,
    );
    const before = await fs.readFile(
      path.join(fixture.root, "mockups/screens/area-1-screen-1.desktop.html"),
      "utf8",
    );
    await restoreFixtureSetup(repositoryRoot, fixture);
    assert.equal(
      await fs.readFile(
        path.join(fixture.root, "mockups/screens/area-1-screen-1.desktop.html"),
        "utf8",
      ),
      before,
    );
  },
);

test("restoration errors fail without discarding recorded sample errors", async () => {
  const scenario = classificationScenarios[0]!;
  const matrix = await executeMatrix([scenario], {
    prepare: async () => {},
    sample: async (_scenario, state) =>
      sampleOutcome([], {
        scenario: scenario.name,
        state,
        expectedChangedIds: [],
        expectedChangedRoutes: [],
        error: "Worker did not start",
      }),
    close: async () => {},
    restore: async () => {
      throw new Error("Restore failed");
    },
  });
  assert.equal(matrix.runs.length, 2);
  assert.equal(matrix.restorationError, "Restore failed");
});
