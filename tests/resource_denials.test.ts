import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { stylesheetsFor } from "../dist/build/render.js";
import { ComponentValidationError } from "../dist/components/data.js";
import type { ComponentViewRecord } from "../dist/components/manifest_types.js";
import { validateComponentResources } from "../dist/components/output_validation.js";
import { loadConfig } from "../dist/config/load.js";
import { MoklyError } from "../dist/errors.js";
import { assembleExport } from "../dist/export/site.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
} from "../dist/review/assets.js";
import type { BaselineReader } from "../dist/review/git.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const baseline: BaselineReader = {
  fileExists: async () => true,
  fileKind: async () => "regular",
  readFile: async () => "private",
  readFileBytes: async () => Buffer.from("private"),
};

for (const [name, cause] of [
  ["private/theme.css", /authored source root.*entriesDir/],
  ["theme.source.html", /reserved source basename/],
  ["helper.css", /authoring input.*sourceFiles/],
  ["README.css", /matches public exclusion.*\*\*\/README\.\*.*publicExclude/],
] as const) {
  test(`resource validation and Review retain the protection cause for ${name}`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const entriesDir = path.join(fixture.mockupsDir, "private");
    await fs.mkdir(entriesDir);
    await fs.writeFile(path.join(fixture.mockupsDir, name), "private");
    const config = {
      ...(await loadConfig(fixture.root)),
      entriesDir,
      sourceFiles: ["mockups/helper.css"],
      stylesheets: [{ match: "**", stylesheets: [name] }],
    };
    const route = "screens/home.mobile.html";
    const view: ComponentViewRecord = {
      viewport: "mobile",
      colorScheme: "light",
      instances: [],
      slots: [],
      ranges: [],
      styles: [],
      resources: [{ path: name, componentIds: [] }],
    };
    const check = (error: Error): boolean => {
      assert.match(error.message, cause);
      assert.ok(error.message.includes(name));
      return true;
    };
    for (const validate of [
      () => stylesheetsFor(route, route, "light", config),
      () => validateComponentResources(new Map([[route, view]]), config),
    ])
      assert.throws(validate, (error: Error) => {
        assert.ok(error.message.includes(route));
        return check(error);
      });
    for (const reader of [
      new FileSystemReviewAssetReader(config),
      new GitReviewAssetReader(config, baseline, "baseline", "mockups"),
      new CompiledReviewAssetReader(config, new Map([[name, "private"]])),
    ])
      await assert.rejects(reader.read(name), check);
  });
}

test("export comparison reports its excluded snapshot resource and matched glob", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.throws(
    () =>
      assembleExport(
        config,
        compilation,
        compilation.manifest,
        {
          files: new Map([["snapshots/before/README.css", "private"]]),
          result: {
            baseCommit: "a".repeat(40),
            baseRef: "main",
            changedPaths: [],
            ignoredImpact: [],
            screens: [],
            schemaVersion: 2,
            sharedImpact: [],
          },
        },
        new Map(),
        [],
      ),
    (error: Error) => {
      assert.match(
        error.message,
        /private export resource.*snapshots\/before\/README.css/,
      );
      assert.match(
        error.message,
        /matches public exclusion.*\*\*\/README\.\*.*publicExclude/,
      );
      return true;
    },
  );
});

test("unresolvable resource aliases retain typed errors and the referring route", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.symlink("missing.css", path.join(fixture.mockupsDir, "alias.css"));
  const config = {
    ...(await loadConfig(fixture.root)),
    stylesheets: [{ match: "**", stylesheets: ["alias.css"] }],
  };
  const route = "screens/home.mobile.html";
  const view: ComponentViewRecord = {
    viewport: "mobile",
    colorScheme: "light",
    instances: [],
    slots: [],
    ranges: [],
    styles: [],
    resources: [{ path: "alias.css", componentIds: [] }],
  };
  for (const [validate, errorType] of [
    [() => stylesheetsFor(route, route, "light", config), MoklyError],
    [
      () => validateComponentResources(new Map([[route, view]]), config),
      ComponentValidationError,
    ],
  ] as const)
    assert.throws(validate, (error: unknown) => {
      assert.ok(error instanceof errorType);
      if (error instanceof MoklyError)
        assert.equal(error.code, "build-invalid");
      else assert.equal(error.path, route);
      assert.ok(error.message.includes(route));
      assert.match(
        error.message,
        /alias\.css.*could not resolve|could not resolve.*alias\.css/,
      );
      return true;
    });
});
