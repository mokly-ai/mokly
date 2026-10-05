import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import { normalizeSourceFiles } from "../dist/build/source_inventory.js";
import { loadConfig } from "../dist/config/load.js";
import { resolveConfig } from "../dist/config/validate.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("reserved configuration rejects only deliberate generated-directory targets", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const common = { mockupsDir: "mockups", repoRoot: "." };
  const invalid = [
    [
      { roots: [{ dir: ".", files: ["mockups/mokly-generated/**/*.tsx"] }] },
      "roots[0].files must not select mokly-generated/: mockups/mokly-generated/**/*.tsx; narrow the file glob to authored files",
    ],
    [
      {
        roots: [
          { dir: ".", files: ["mockups/mokly-generated/styles/**/*.tsx"] },
        ],
      },
      "roots[0].files must not select mokly-generated/: mockups/mokly-generated/styles/**/*.tsx; narrow the file glob to authored files",
    ],
    [
      { roots: [{ dir: "mockups/mokly-generated" }] },
      "roots[0].dir must not select mokly-generated/: mockups/mokly-generated; choose a directory of authored entry modules",
    ],
    [
      { roots: [{ dir: "mockups/mokly-generated/children" }] },
      "roots[0].dir must not select mokly-generated/: mockups/mokly-generated/children; choose a directory of authored entry modules",
    ],
    [
      {
        roots: [{ dir: "entries" }],
        stylesheets: [
          { match: "**", stylesheets: ["mokly-generated/styles/a.css"] },
        ],
      },
      "stylesheets[0].stylesheets must not reference mokly-generated/: mokly-generated/styles/a.css; link imported CSS through the renderer instead",
    ],
    [
      {
        roots: [{ dir: "entries" }],
        stylesheets: [
          {
            match: "**",
            stylesheets: [],
            lightStylesheets: ["mokly-generated/styles/a.css"],
          },
        ],
      },
      "stylesheets[0].lightStylesheets must not reference mokly-generated/: mokly-generated/styles/a.css; link imported CSS through the renderer instead",
    ],
    [
      {
        roots: [{ dir: "entries" }],
        stylesheets: [
          {
            match: "**",
            stylesheets: [],
            darkStylesheets: ["mokly-generated/styles/a.css"],
          },
        ],
      },
      "stylesheets[0].darkStylesheets must not reference mokly-generated/: mokly-generated/styles/a.css; link imported CSS through the renderer instead",
    ],
    [
      {
        roots: [{ dir: "entries" }],
        review: { outDir: "mockups/mokly-generated" },
      },
      "review.outDir must not be at or inside mokly-generated/; choose a separate artifact directory",
    ],
    [
      {
        roots: [{ dir: "entries" }],
        review: { outDir: "mockups/mokly-generated/reviews" },
      },
      "review.outDir must not be at or inside mokly-generated/; choose a separate artifact directory",
    ],
    [
      { roots: [{ dir: "entries" }], publicExclude: ["mokly-generated/**"] },
      "publicExclude must not start with mokly-generated/: mokly-generated/**; narrow the exclusion to consumer-owned paths",
    ],
    [
      {
        roots: [{ dir: "entries" }],
        publicExclude: ["{public,mokly-generated}/**"],
      },
      "publicExclude must not start with mokly-generated/: {public,mokly-generated}/**; narrow the exclusion to consumer-owned paths",
    ],
  ] as const;
  for (const [value, message] of invalid)
    assert.throws(
      () => resolveConfig({ ...common, ...value }, fixture.configPath),
      (error: Error & { code?: string }) =>
        error.code === "config-invalid" &&
        error.message === `[mokly/config-invalid] ${message}`,
      message,
    );
  for (const publicExclude of [
    ["**/*.psd"],
    ["**/drafts/**"],
    ["**/mokly-generated/**"],
  ])
    assert.deepEqual(
      resolveConfig(
        { ...common, roots: [{ dir: "entries" }], publicExclude },
        fixture.configPath,
      ).publicExclude.slice(-1),
      publicExclude,
    );
});

test("broad entry glob skips generated tree while discovering co-located entries", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.mockupsDir, "mokly-generated", "styles"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(
      fixture.mockupsDir,
      "mokly-generated",
      "styles",
      "private.mockup.tsx",
    ),
    "export const mockups = [];",
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "actual.mockup.tsx"),
    validEntrySource(),
  );
  await fs.writeFile(
    fixture.configPath,
    'export default { roots: [{ dir: ".", files: ["mockups/**/*.mockup.tsx"] }], mockupsDir: "mockups", repoRoot: ".", review: { outDir: ".review" } };\n',
  );
  assert.deepEqual((await loadConfig(fixture.root)).entryModules, [
    path.join(fixture.mockupsDir, "actual.mockup.tsx"),
  ]);
});

test("generated asset routes accept every documented extension", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  for (const extension of [
    "avif",
    "bmp",
    "gif",
    "ico",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "webp",
    "eot",
    "otf",
    "ttf",
    "woff",
    "woff2",
  ])
    assert.doesNotThrow(() =>
      validateGeneratedOutputPaths(
        [`mokly-generated/assets/img/example.${extension}`],
        config,
      ),
    );
});

test("source aliases inside reserved output name their offending logical path", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const reserved = path.join(fixture.mockupsDir, "mokly-generated");
  await fs.mkdir(reserved);
  await fs.symlink(fixture.entryPath, path.join(reserved, "alias.tsx"));
  assert.throws(
    () =>
      normalizeSourceFiles(
        [path.join(reserved, "alias.tsx")],
        fixture.root,
        fixture.mockupsDir,
      ),
    /authoring input is inside mokly-generated\/: mockups\/mokly-generated\/alias.tsx; move authored sources outside Mokly's output directory/,
  );
});

test("source inventory rejects generated files and physical aliases", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const reserved = path.join(fixture.mockupsDir, "mokly-generated");
  await fs.mkdir(reserved);
  await fs.writeFile(path.join(reserved, "input.css"), "x");
  await fs.symlink(
    path.join(reserved, "input.css"),
    path.join(fixture.root, "alias.css"),
  );
  for (const candidate of [
    path.join(reserved, "input.css"),
    path.join(fixture.root, "alias.css"),
  ])
    assert.throws(
      () => normalizeSourceFiles([candidate], fixture.root, fixture.mockupsDir),
      (error: Error & { code?: string }) =>
        error.code === "build-invalid" &&
        error.message ===
          "[mokly/build-invalid] authoring input is inside mokly-generated/: mockups/mokly-generated/input.css; move authored sources outside Mokly's output directory",
    );
});

test("configured paths cannot alias the reserved directory", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const reserved = path.join(fixture.mockupsDir, "mokly-generated");
  await fs.mkdir(path.join(reserved, "styles"), { recursive: true });
  await fs.writeFile(path.join(reserved, "styles", "theme.css"), "body {}");
  await fs.symlink(reserved, path.join(fixture.root, "alias"));
  await fs.symlink(
    path.join(reserved, "styles", "theme.css"),
    path.join(fixture.mockupsDir, "alias.css"),
  );
  const common = { repoRoot: ".", mockupsDir: "mockups" };
  for (const [value, message] of [
    [
      { roots: [{ dir: "alias" }] },
      "roots[0].dir must not select mokly-generated/: alias; choose a directory of authored entry modules",
    ],
    [
      { roots: [{ dir: ".", files: ["alias/**/*.tsx"] }] },
      "roots[0].files must not select mokly-generated/: alias/**/*.tsx; narrow the file glob to authored files",
    ],
    [
      { roots: [{ dir: "entries" }], review: { outDir: "alias" } },
      "review.outDir must not be at or inside mokly-generated/; choose a separate artifact directory",
    ],
    [
      {
        roots: [{ dir: "entries" }],
        stylesheets: [{ match: "**", stylesheets: ["alias.css"] }],
      },
      "stylesheets[0].stylesheets must not reference mokly-generated/: alias.css; link imported CSS through the renderer instead",
    ],
  ] as const) {
    assert.throws(
      () => resolveConfig({ ...common, ...value }, fixture.configPath),
      (error: Error & { code?: string }) =>
        error.code === "config-invalid" &&
        error.message === `[mokly/config-invalid] ${message}`,
      message,
    );
  }
});

test("Build reports reserved symlinks before inventorying another reserved source", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const reserved = path.join(fixture.mockupsDir, "mokly-generated", "styles");
  await fs.mkdir(reserved, { recursive: true });
  await fs.writeFile(path.join(reserved, "authored.css"), "body {}");
  await fs.symlink("missing.css", path.join(reserved, "a-symlink.css"));
  await fs.appendFile(
    fixture.entryPath,
    '\nimport "../mockups/mokly-generated/styles/authored.css";\n',
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /mokly-generated\/ contains a symlink or non-regular entry: mockups\/mokly-generated\/styles\/a-symlink.css; delete it before building or checking/,
  );
});
