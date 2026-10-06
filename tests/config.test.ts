import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { BuildWarning } from "../dist/build/warnings.js";
import { discoverConfig, loadConfig } from "../dist/config/load.js";
import { validateRelativeRoute } from "../dist/config/paths.js";
import { resolveConfig } from "../dist/config/validate.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("config discovery walks upward from nested workspace directories", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const nested = path.join(fixture.root, "packages", "app", "src");
  await fs.promises.mkdir(nested, { recursive: true });
  await fs.promises.writeFile(
    path.join(fixture.root, "package.json"),
    `${JSON.stringify({ private: true, workspaces: ["packages/*"] })}\n`,
  );
  assert.equal(discoverConfig(nested), fixture.configPath);
  const config = await loadConfig(nested);
  assert.equal(config.repoRoot, fixture.root);
  assert.equal(config.roots[0]?.dir, fixture.entriesDir);
});

test("route-like config values normalize to platform-independent POSIX paths", () => {
  assert.equal(
    validateRelativeRoute("home\\index.html", "test route"),
    "home/index.html",
  );
});

test("config resolves the scoped API without changing its filename", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const source = `import { defineConfig } from "@mokly/mokly";
export default defineConfig({ repoRoot: ".", roots: [{ dir: "entries" }], mockupsDir: "mockups" });
`;
  await fs.promises.writeFile(fixture.configPath, source);
  const config = await loadConfig(fixture.root);
  assert.equal(config.configPath, fixture.configPath);
  assert.equal(path.basename(config.configPath), "mokly.config.ts");
  await fs.promises.writeFile(
    fixture.configPath,
    source.replace("@mokly/mokly", "mokly"),
  );
  await assert.rejects(loadConfig(fixture.root), /Could not resolve "mokly"/);
});

test("review.sharedImpact warns and is ignored even when undefined", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  for (const value of ['["notes.md"]', "undefined"]) {
    const source = await fs.promises.readFile(fixture.configPath, "utf8");
    await fs.promises.writeFile(
      fixture.configPath,
      source.replace(
        'outDir: ".review"',
        `outDir: ".review", sharedImpact: ${value}`,
      ),
    );
    const emitted: BuildWarning[] = [];
    const config = await loadConfig(fixture.root, undefined, (warning) =>
      emitted.push(warning),
    );
    assert.deepEqual(config.warnings, [
      {
        code: "removed-shared-impact",
        context: [fixture.configPath],
        message:
          "review.sharedImpact has been removed; ignoring it. Delete the field.",
      },
    ]);
    assert.deepEqual(emitted, config.warnings);
    await fs.promises.writeFile(fixture.configPath, source);
  }
});

test("explicit config loading is independent of the executing package directory", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const unrelatedCwd = path.join(fixture.root, "npm-cache", "_npx", "hash");
  await fs.promises.mkdir(unrelatedCwd, { recursive: true });
  const config = await loadConfig(
    unrelatedCwd,
    path.relative(unrelatedCwd, fixture.configPath),
  );
  assert.equal(config.mockupsDir, fixture.mockupsDir);
});

test("colorSchemes defaults to light and normalizes order", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const input = {
    roots: [{ dir: "entries" }],
    mockupsDir: "mockups",
    repoRoot: ".",
  };

  assert.deepEqual(resolveConfig(input, fixture.configPath).colorSchemes, [
    "light",
  ]);
  assert.deepEqual(
    resolveConfig(
      { ...input, colorSchemes: ["dark", "light"] },
      fixture.configPath,
    ).colorSchemes,
    ["light", "dark"],
  );
});

test("colorSchemes rejects invalid sets", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const input = {
    roots: [{ dir: "entries" }],
    mockupsDir: "mockups",
    repoRoot: ".",
  };
  for (const [colorSchemes, message] of [
    [[], "colorSchemes must be a non-empty array"],
    [["dark"], 'colorSchemes must include "light"'],
    [["light", "light"], "duplicate colorSchemes value: light"],
    [["light", "sepia"], "colorSchemes contains an unknown value: sepia"],
  ] as const) {
    assert.throws(
      () => resolveConfig({ ...input, colorSchemes }, fixture.configPath),
      (error: Error & { code?: string }) =>
        error.code === "config-invalid" && error.message.includes(message),
    );
  }
});

test("scheme-specific stylesheet lists validate like shared stylesheets", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const input = {
    roots: [{ dir: "entries" }],
    mockupsDir: "mockups",
    repoRoot: ".",
  };
  const stylesheets = [
    {
      darkStylesheets: ["dark.css", "https://example.test/dark.css"],
      lightStylesheets: ["light.css", "http://example.test/light.css"],
      match: "**/*.html",
      stylesheets: ["shared.css"],
    },
  ];
  assert.deepEqual(
    resolveConfig({ ...input, stylesheets }, fixture.configPath).stylesheets,
    stylesheets,
  );

  for (const invalid of [
    { ...stylesheets[0], darkStylesheets: "dark.css" },
    { ...stylesheets[0], lightStylesheets: [""] },
    { ...stylesheets[0], darkStylesheets: ["../dark.css"] },
  ]) {
    assert.throws(
      () =>
        resolveConfig({ ...input, stylesheets: [invalid] }, fixture.configPath),
      (error: Error & { code?: string }) => error.code === "config-invalid",
    );
  }
});
