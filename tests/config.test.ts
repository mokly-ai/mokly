import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

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
  assert.equal(config.entriesDir, fixture.entriesDir);
});

test("route-like config values normalize to platform-independent POSIX paths", () => {
  assert.equal(
    validateRelativeRoute("screens\\home.html", "test route"),
    "screens/home.html",
  );
});

test("config resolves the scoped API without changing its filename", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const source = `import { defineConfig } from "@mokly/mokly";
export default defineConfig({ repoRoot: ".", entriesDir: "entries", mockupsDir: "mockups" });
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
    const config = await loadConfig(fixture.root);
    assert.deepEqual(config.warnings, [
      {
        code: "removed-shared-impact",
        context: [fixture.configPath],
        message:
          "review.sharedImpact has been removed; ignoring it. Delete the field.",
      },
    ]);
    assert.equal(Object.hasOwn(config.review, "sharedImpact"), false);
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
    entriesDir: "entries",
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
    entriesDir: "entries",
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
    entriesDir: "entries",
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

test("stylesheet rules reject paths linked twice in one fragment", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const input = {
    entriesDir: "entries",
    mockupsDir: "mockups",
    repoRoot: ".",
  };

  for (const [stylesheets, message] of [
    [
      [{ match: "**/*.html", stylesheets: ["shared.css", "shared.css"] }],
      "duplicate stylesheet path in stylesheets[0].stylesheets: shared.css",
    ],
    [
      [
        {
          darkStylesheets: ["dark.css", "dark.css"],
          match: "**/*.html",
          stylesheets: ["shared.css"],
        },
      ],
      "duplicate stylesheet path in stylesheets[0].darkStylesheets: dark.css",
    ],
    [
      [
        {
          darkStylesheets: ["shared.css"],
          match: "**/*.html",
          stylesheets: ["shared.css"],
        },
      ],
      "duplicate stylesheet path in stylesheets[0].darkStylesheets: shared.css",
    ],
    [
      [
        { match: "design/**", stylesheets: ["design.css"] },
        {
          lightStylesheets: ["light.css", "light.css"],
          match: "**/*.html",
          stylesheets: ["design.css"],
        },
      ],
      "duplicate stylesheet path in stylesheets[1].lightStylesheets: light.css",
    ],
  ] as const) {
    assert.throws(
      () => resolveConfig({ ...input, stylesheets }, fixture.configPath),
      (error: Error & { code?: string }) =>
        error.code === "config-invalid" && error.message.includes(message),
    );
  }

  const reused = [
    { match: "design/**", stylesheets: ["design.css"] },
    {
      darkStylesheets: ["theme.css"],
      lightStylesheets: ["theme.css"],
      match: "**/*.html",
      stylesheets: ["design.css"],
    },
  ];
  assert.deepEqual(
    resolveConfig({ ...input, stylesheets: reused }, fixture.configPath)
      .stylesheets,
    reused,
  );
});

test("missing config reports every attempted filename", () => {
  const root = path.join("/", "definitely-missing-mokly-config");
  assert.throws(() => discoverConfig(root), /mokly\.config\.ts/);
});

test("config discovery does not accept the former package filename", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.rename(
    fixture.configPath,
    path.join(fixture.root, "mokabook.config.ts"),
  );

  assert.throws(
    () => discoverConfig(fixture.root),
    (error: Error) =>
      error.message.includes("no Mokly config found") &&
      !error.message.includes("mokabook.config.ts"),
  );
});

test("config rejects traversal and overlapping roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { entriesDir: "../outside", mockupsDir: "mockups", repoRoot: "." };\n`,
  );
  await assert.rejects(() => loadConfig(fixture.root), /outside repoRoot/);
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { entriesDir: "mockups", mockupsDir: "mockups", repoRoot: "." };\n`,
  );
  await assert.rejects(
    () => loadConfig(fixture.root),
    /must not equal mockupsDir/,
  );
});

test("config rejects an output root symlink outside repoRoot", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const outside = `${fixture.root}-outside-output`;
  context.after(() =>
    fs.promises.rm(outside, { force: true, recursive: true }),
  );
  await fs.promises.mkdir(outside);
  await fs.promises.rm(fixture.mockupsDir, { recursive: true });
  await fs.promises.symlink(outside, fixture.mockupsDir);

  await assert.rejects(
    () => loadConfig(fixture.root),
    /mockupsDir resolves outside repoRoot through a symlink/,
  );
});

test("config rejects Review output through an external symlink", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const outside = `${fixture.root}-outside-review`;
  context.after(() =>
    fs.promises.rm(outside, { force: true, recursive: true }),
  );
  await fs.promises.mkdir(outside);
  await fs.promises.symlink(outside, path.join(fixture.root, "review-link"));
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entriesDir: "entries", mockupsDir: "mockups", repoRoot: ".", review: { outDir: "review-link/artifact" } };\n',
  );

  await assert.rejects(
    () => loadConfig(fixture.root),
    /review.outDir resolves outside repoRoot through a symlink/,
  );
});
