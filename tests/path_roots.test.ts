import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { resolveConfig } from "../dist/config/validate.js";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

test("default roots discover specs and render Markdown while retaining protected sources", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/account/page.mockup.ts": pageSource(),
      "specs/account/README.md": "# Account",
    },
    '{mockupsDir:"generated",generatedOutput:"committed"}',
  );
  t.after(fixture.remove);
  const config = await fixture.config();
  assert.equal(config.roots[0]?.dir, path.join(fixture.root, "specs"));
  assert.deepEqual(config.roots[0]?.files, ["**/*.mockup.{ts,tsx}", "**/*.md"]);
  const built = await fixture.compile();
  assert.deepEqual(
    built.manifest.entries.map((entry) => entry.path),
    ["account", "account/page"],
  );
  assert.ok(built.manifest.sourceFiles.includes("specs/account/README.md"));
});

test("roots support prefixes, arbitrary glob-selected modules, and transparent directories", async (t) => {
  const fixture = await pathFixture(
    {
      "src/account/__mockups__/page.stories.ts": pageSource(),
      "src/account/not-selected.ts": "throw new Error('not selected')",
    },
    '{mockupsDir:"generated",roots:[{dir:"src",files:["**/*.stories.ts"],path:"Specs",transparent:["__mockups__"]}],generatedOutput:"committed"}',
  );
  t.after(fixture.remove);
  assert.deepEqual(
    (await fixture.compile()).manifest.entries.map((entry) => entry.path),
    ["Specs/account/page"],
  );
});

test("root validation rejects unknown config fields and invalid per-root values", async (t) => {
  const fixture = await pathFixture({ "specs/page.mockup.ts": pageSource() });
  t.after(fixture.remove);
  const configPath = path.join(fixture.root, "mokly.config.ts");
  for (const key of ["entries", "entriesDir", "unexpected"])
    assert.throws(
      () =>
        resolveConfig(
          { mockupsDir: "generated", [key]: undefined },
          configPath,
        ),
      new RegExp(`unknown configuration field: ${key}`),
    );
  for (const root of [
    { dir: "specs", files: null },
    { dir: "specs", transparent: null },
    { dir: "missing" },
    { dir: "specs", files: [] },
    { dir: "specs", files: ["../bad"] },
    { dir: "specs", files: ["**/*.ts", "**/*.ts"] },
    { dir: "specs", path: "con" },
    { dir: "specs", transparent: ["bad.name"] },
  ])
    assert.throws(
      () =>
        resolveConfig({ mockupsDir: "generated", roots: [root] }, configPath),
      /config-invalid.*roots\[0\]/,
    );
  assert.throws(
    () =>
      resolveConfig(
        {
          mockupsDir: "generated",
          roots: [{ dir: "specs" }, { dir: "specs" }],
        },
        configPath,
      ),
    /roots\[1\].dir/,
  );
  assert.throws(
    () =>
      resolveConfig(
        { mockupsDir: "specs", roots: [{ dir: "specs" }] },
        configPath,
      ),
    /must not equal mockupsDir/,
  );
  await fs.mkdir(path.join(fixture.root, "empty"));
  assert.throws(
    () =>
      resolveConfig(
        { mockupsDir: "generated", roots: [{ dir: "empty" }] },
        configPath,
      ),
    /root matches no file: empty/,
  );
});

test("failed candidate discovery cannot mutate the accepted config inventory", async (t) => {
  const fixture = await pathFixture({
    "specs/account/item.mockup.ts": pageSource(),
  });
  t.after(fixture.remove);
  const config = await fixture.config();
  const before = structuredClone({
    folders: config.folderRecords,
    files: config.resolvedFiles,
  });
  await fixture.write("specs/account/_folder.json", '{"hidden":true}');
  await fixture.write("specs/account/item.mockup.ts", "this is not a module");
  const { compileCatalogue } = await import("../dist/build/compile.js");
  await assert.rejects(compileCatalogue(config));
  assert.deepEqual(
    { folders: config.folderRecords, files: config.resolvedFiles },
    before,
  );
});

test("review output cannot overlap the directory of a matched Markdown input", async (t) => {
  const fixture = await pathFixture(
    { "specs/README.md": "# Specs", "screens/item.mockup.ts": pageSource() },
    '{mockupsDir:"generated",roots:[{dir:"specs"},{dir:"screens"}],review:{outDir:"specs/.review"},generatedOutput:"committed"}',
  );
  t.after(fixture.remove);
  await assert.rejects(fixture.config(), /review.outDir must not overlap/);
});

for (const extension of ["mockup.ts", "md"])
  test(`a file selected by two roots fails before bundling: ${extension}`, async (t) => {
    const fixture = await pathFixture(
      {
        [`src/feature/item.${extension}`]:
          extension === "md" ? "# Item" : pageSource(),
      },
      '{mockupsDir:"generated",roots:[{dir:"src"},{dir:"src/feature"}],generatedOutput:"committed"}',
    );
    t.after(fixture.remove);
    await assert.rejects(
      fixture.config(),
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          `[mokly/config-invalid] file src/feature/item.${extension} is matched by roots[0] and roots[1]`,
    );
  });

test("overlapping root directories with disjoint globs retain the actual matching root", async (t) => {
  const fixture = await pathFixture(
    {
      "src/feature/item.mockup.ts": pageSource(),
      "src/feature/other.other.ts": pageSource(),
    },
    '{mockupsDir:"generated",roots:[{dir:"src",files:["**/*.mockup.ts"],path:"one"},{dir:"src/feature",files:["*.other.ts"],path:"two"}],generatedOutput:"committed"}',
  );
  t.after(fixture.remove);
  assert.deepEqual(
    (await fixture.compile()).manifest.entries.map((entry) => entry.path),
    ["one/feature/item", "two/other"],
  );
});

test("folder exclusions also exclude new watch candidates without hiding imported sources", async (t) => {
  const fixture = await pathFixture({
    "specs/account/_folder.json": '{"exclude":["drafts/**"]}',
    "specs/account/item.mockup.ts": pageSource(),
  });
  t.after(fixture.remove);
  const config = await fixture.config();
  const { isEntryGlobCandidate } =
    await import("../dist/server/watch_paths.js");
  assert.equal(
    isEntryGlobCandidate(
      path.join(fixture.root, "specs/account/drafts/new.mockup.ts"),
      config,
    ),
    false,
  );
  assert.equal(
    isEntryGlobCandidate(
      path.join(fixture.root, "specs/account/new.mockup.ts"),
      config,
    ),
    true,
  );
  assert.equal(
    isEntryGlobCandidate(
      path.join(fixture.root, "specs/account/_folder.json"),
      config,
    ),
    true,
  );
});

test("watch exclusions belong to their root and imported excluded modules remain inputs", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/account/_folder.json": '{"exclude":["drafts/**"]}',
      "specs/account/item.mockup.ts":
        pageSource() + "\nimport './drafts/helper';",
      "specs/account/drafts/helper.ts": 'export const text="Draft";',
      "specs/account/drafts/child.mockup.ts": pageSource(),
    },
    '{mockupsDir:"generated",roots:[{dir:"specs",files:["account/*.mockup.ts"]},{dir:"specs/account/drafts",path:"drafts"}],generatedOutput:"committed"}',
  );
  t.after(fixture.remove);
  const config = await fixture.config();
  const { isEntryGlobCandidate } =
    await import("../dist/server/watch_paths.js");
  const child = path.join(fixture.root, "specs/account/drafts/next.mockup.ts");
  assert.equal(isEntryGlobCandidate(child, config), true);
  assert.equal(
    isEntryGlobCandidate(child, { ...config, roots: config.roots.slice(0, 1) }),
    false,
  );
  const compiled = await fixture.compile();
  assert.ok(
    compiled.manifest.sourceFiles.includes("specs/account/drafts/helper.ts"),
  );
  const { classifyWatchPath } = await import("../dist/server/watch_events.js");
  assert.equal(
    classifyWatchPath(
      {
        path: path.join(fixture.root, "specs/account/drafts/helper.ts"),
        kind: "change",
      },
      { ...config, sourceFiles: compiled.manifest.sourceFiles },
    ),
    "rebuild",
  );
});
