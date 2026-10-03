import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { discoverConfig, loadConfig } from "../dist/config/load.js";
import { resolveConfig } from "../dist/config/validate.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

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
