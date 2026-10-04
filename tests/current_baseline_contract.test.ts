import assert from "node:assert/strict";
import test from "node:test";

import { isIncompatibleEarlierBaseline } from "../dist/baseline/compatibility.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { comparisonStylesheetMaterial } from "../dist/components/comparison_stylesheets.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import type { BaselineReader } from "../dist/review/git.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { earlierV8Manifest } from "./helpers/current_baseline_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const current = () => ({
  schemaVersion: 8,
  generatedBy: "mokly",
  sourceFiles: [],
  entries: [],
});

test("comparison requires explicit provenance on a present private usage record", () => {
  const html = "<html><body>Page</body></html>";
  const usage = {
    viewport: "mobile" as const,
    colorScheme: "light" as const,
    instances: [],
    slots: [],
    ranges: [],
    styles: [],
    resources: [],
  };
  assert.throws(
    () => comparisonStylesheetMaterial(html, usage),
    /provenance|inserted/,
  );
  assert.equal(
    comparisonStylesheetMaterial(html, { ...usage, insertedStylesheets: [] })
      .html,
    html,
  );
  assert.equal(comparisonStylesheetMaterial(html, undefined).html, html);
});

for (const version of [3, 4, 5, 6, 7])
  test(`baseline v${version} is incompatible without metadata conversion`, () => {
    assert.throws(
      () => parseHistoricalManifest({ ...current(), schemaVersion: version }),
      isIncompatibleEarlierBaseline,
    );
  });

test("current v8 uses the same validation at both manifest boundaries", () => {
  assert.deepEqual(
    parseHistoricalManifest(current()),
    parseManifest(current()),
  );
  for (const schemaVersion of [9, 8.5, 7.5, "7", null]) {
    assert.throws(
      () => parseHistoricalManifest({ ...current(), schemaVersion }),
      { code: "manifest-invalid" },
    );
  }
});

for (const shape of [
  "missing root",
  "missing provenance",
  "CSS owners",
] as const)
  test(`earlier v8 with ${shape} is invalid at both boundaries`, async (context) => {
    const fixture = await createFixture(componentEntrySource());
    context.after(() => removeFixture(fixture));
    const { manifest } = await compileCatalogue(await loadConfig(fixture.root));
    const invalid = earlierV8Manifest(manifest, shape);
    assert.throws(() => parseHistoricalManifest(invalid));
    assert.throws(() => parseManifest(invalid));
    assert.deepEqual(parseHistoricalManifest(manifest), manifest);
  });

for (const filename of ["mokabook-manifest.json", "mockbook-manifest.json"])
  test(`${filename} is a sentinel and its contents are never read`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const reads: string[] = [];
    const reader: BaselineReader = {
      fileExists: async (_commit, route) => route === `mockups/${filename}`,
      fileKind: async () => "regular",
      readFile: async (_commit, route) => {
        reads.push(route);
        return JSON.stringify(current());
      },
      readFileBytes: async () => {
        assert.fail("no resource read is allowed");
      },
    };
    await assert.rejects(
      readBaseManifest(reader, "base", config),
      isIncompatibleEarlierBaseline,
    );
    assert.deepEqual(reads, []);
  });

test("invalid canonical v8 never falls back to a former filename", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const reads: string[] = [];
  const reader: BaselineReader = {
    fileExists: async () => true,
    fileKind: async () => "regular",
    readFile: async (_commit, route) => {
      reads.push(route);
      return JSON.stringify({ ...current(), sourceFiles: null });
    },
    readFileBytes: async () => {
      assert.fail("no resource read is allowed");
    },
  };
  await assert.rejects(readBaseManifest(reader, "base", config), {
    code: "manifest-invalid",
  });
  assert.deepEqual(reads, ["mockups/mokly-manifest.json"]);
});
