import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { resolveConfig } from "../dist/config/validate.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

const input = { entriesDir: "entries", mockupsDir: "mockups" };

test("the example configures historical build tooling", async () => {
  const configPath = path.join(
    repositoryRoot,
    "examples/basic/mokly.config.ts",
  );
  const config = await loadConfig(repositoryRoot, configPath);
  const recipe = [
    ["npm", "ci"],
    ["npm", "run", "build"],
    ["npm", "run", "example:build"],
  ];
  assert.deepEqual(config.review.baselineBuild, recipe);
  assert.deepEqual(
    resolveConfig(
      {
        entriesDir: "entries",
        mockupsDir: "generated",
        repoRoot: "../..",
        review: { baselineBuild: recipe },
      },
      configPath,
    ).review.baselineBuild,
    recipe,
  );
});

test("baseline build defaults to exact argv without an output mode", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const resolved = resolveConfig(input, fixture.configPath);
  assert.deepEqual(resolved.review.baselineBuild, [
    ["npm", "ci"],
    ["npx", "--no-install", "mokly", "build", "--config", "mokly.config.ts"],
  ]);
  const configPath = path.join(fixture.root, "config", "catalogue.ts");
  const nested = resolveConfig(
    {
      entriesDir: "../entries",
      mockupsDir: "../mockups",
      repoRoot: "..",
    },
    configPath,
  );
  assert.deepEqual(nested.review.baselineBuild, [
    ["npm", "ci"],
    [
      "npx",
      "--no-install",
      "mokly",
      "build",
      "--config",
      "config/catalogue.ts",
    ],
  ]);
  for (const commands of [[], [["node", "build.mjs", ""]]]) {
    assert.deepEqual(
      resolveConfig(
        {
          ...input,
          review: { baselineBuild: commands },
        },
        fixture.configPath,
      ).review.baselineBuild,
      commands,
    );
  }
});

test("removed output mode is rejected with actionable guidance", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  assert.throws(
    () =>
      resolveConfig(
        { ...input, generatedOutput: "committed" },
        fixture.configPath,
      ),
    /generatedOutput was removed; use Git tracking for check and run mokly build to write output/,
  );
  assert.throws(
    () =>
      resolveConfig(
        { ...input, publicExclude: ["internal/**"] },
        fixture.configPath,
      ),
    /publicExclude was removed; remove it; only referenced authored assets are public/,
  );
});

test("baseline build rejects malformed commands", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  for (const baselineBuild of [
    null,
    "npm ci",
    [[]],
    [[""]],
    [[" "]],
    [["node", 1]],
    [["node", "\0"]],
    ["npm", "ci"],
  ])
    assert.throws(
      () =>
        resolveConfig(
          { ...input, review: { baselineBuild } },
          fixture.configPath,
        ),
      { code: "config-invalid" },
    );
});

test("output may be absent and its projected root stays confined", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const missing = { ...input, mockupsDir: "new/nested/output" };
  assert.equal(
    resolveConfig(missing, fixture.configPath).mockupsDir,
    path.join(fixture.root, missing.mockupsDir),
  );
  await fs.symlink(
    path.dirname(fixture.root),
    path.join(fixture.root, "outside"),
  );
  assert.throws(
    () =>
      resolveConfig(
        { ...input, mockupsDir: "outside/missing" },
        fixture.configPath,
      ),
    { code: "config-invalid" },
  );
});

test("cache paths and physical aliases cannot be configured as catalogue roots", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.root, ".mokly-cache"));
  await fs.symlink(".mokly-cache", path.join(fixture.root, "cache-alias"));
  for (const root of [".mokly-cache", "cache-alias"])
    for (const field of ["entriesDir", "mockupsDir", "outDir"])
      assert.throws(
        () =>
          resolveConfig(
            {
              ...input,
              ...(field === "outDir"
                ? { review: { outDir: root } }
                : { [field]: root }),
            },
            fixture.configPath,
          ),
        { code: "config-invalid" },
      );
});

test("missing roots report dangling links and file ancestors as config errors", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.symlink("absent", path.join(fixture.root, "dangling"));
  for (const mockupsDir of ["dangling/output", "notes.md/output"])
    assert.throws(
      () => resolveConfig({ ...input, mockupsDir }, fixture.configPath),
      { code: "config-invalid" },
    );
});
