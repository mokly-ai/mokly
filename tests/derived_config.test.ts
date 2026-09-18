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

test("the example rebuilds derived baselines with its own package tooling", async () => {
  const configPath = path.join(
    repositoryRoot,
    "examples/basic/mokly.config.ts",
  );
  const config = await loadConfig(repositoryRoot, configPath);
  assert.equal(config.generatedOutput, "derived");
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
  assert.throws(
    () =>
      resolveConfig(
        {
          entriesDir: "entries",
          mockupsDir: "generated",
          repoRoot: "../..",
          generatedOutput: "committed",
          review: { baselineBuild: recipe },
        },
        configPath,
      ),
    { code: "config-invalid" },
  );
});

test("generated output defaults to derived and derives exact default argv", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const derived = resolveConfig(input, fixture.configPath);
  assert.equal(derived.generatedOutput, "derived");
  assert.deepEqual(derived.review.baselineBuild, [
    ["npm", "ci"],
    ["npx", "--no-install", "mokly", "build", "--config", "mokly.config.ts"],
  ]);
  const committed = resolveConfig(
    { ...input, generatedOutput: "committed" },
    fixture.configPath,
  );
  assert.equal(committed.generatedOutput, "committed");
  assert.equal(committed.review.baselineBuild, undefined);
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
          generatedOutput: "derived",
          review: { baselineBuild: commands },
        },
        fixture.configPath,
      ).review.baselineBuild,
      commands,
    );
  }
});

test("generated output rejects unknown modes and malformed or committed commands", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  for (const generatedOutput of ["rebuilt", "", null, false, 1])
    assert.throws(
      () => resolveConfig({ ...input, generatedOutput }, fixture.configPath),
      { code: "config-invalid" },
    );
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
          { ...input, generatedOutput: "derived", review: { baselineBuild } },
          fixture.configPath,
        ),
      { code: "config-invalid" },
    );
  assert.throws(
    () =>
      resolveConfig(
        {
          ...input,
          generatedOutput: "committed",
          review: { baselineBuild: [] },
        },
        fixture.configPath,
      ),
    { code: "config-invalid" },
  );
});

test("only derived output may be absent and its projected root stays confined", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const missing = { ...input, mockupsDir: "new/nested/output" };
  assert.equal(
    resolveConfig(missing, fixture.configPath).mockupsDir,
    path.join(fixture.root, missing.mockupsDir),
  );
  assert.throws(
    () =>
      resolveConfig(
        { ...missing, generatedOutput: "committed" },
        fixture.configPath,
      ),
    { code: "config-invalid" },
  );
  await fs.symlink(
    path.dirname(fixture.root),
    path.join(fixture.root, "outside"),
  );
  assert.throws(
    () =>
      resolveConfig(
        { ...input, mockupsDir: "outside/missing", generatedOutput: "derived" },
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

test("derived missing roots still report dangling links and file ancestors as config errors", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.symlink("absent", path.join(fixture.root, "dangling"));
  for (const mockupsDir of ["dangling/output", "notes.md/output"])
    assert.throws(
      () =>
        resolveConfig(
          { ...input, mockupsDir, generatedOutput: "derived" },
          fixture.configPath,
        ),
      { code: "config-invalid" },
    );
});
