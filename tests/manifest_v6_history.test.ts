import assert from "node:assert/strict";
import test from "node:test";

import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";
import { compareReview } from "../dist/review/compare.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

for (const mode of ["committed", "derived"] as const) {
  test(`v5 author dependencies do not produce Changes against v6 in ${mode} mode`, async (context) => {
    const fixture = await componentReviewFixture(context, (source) => source);
    const v5 = {
      ...fixture.before.manifest,
      schemaVersion: 5,
      entries: fixture.before.manifest.entries.map((entry) => ({
        ...entry,
        dependencies: [entry.sourcePath],
        declaredDependencies: [entry.sourcePath],
        ...(entry.kind === "component"
          ? { ownedDependencies: [entry.sourcePath] }
          : {}),
      })),
    };
    assert.equal(fixture.after.manifest.schemaVersion, 6);
    assert.throws(() => parseManifest(v5), /schema version 6/);
    const normalized = parseHistoricalManifest(v5);
    for (const entry of normalized.entries) {
      assert.equal("dependencies" in entry, false);
      assert.equal("declaredDependencies" in entry, false);
      assert.equal("ownedDependencies" in entry, false);
    }
    const git = {
      ...fixture.git,
      reader: {
        ...fixture.git.reader,
        readFile: async (commit: string, route: string) =>
          route.endsWith("/mokly-manifest.json")
            ? JSON.stringify(v5)
            : fixture.git.reader.readFile(commit, route),
        readFileBytes: async (commit: string, route: string) =>
          route.endsWith("/mokly-manifest.json")
            ? Buffer.from(JSON.stringify(v5))
            : fixture.git.reader.readFileBytes(commit, route),
        fileExists: async (commit: string, route: string) =>
          route.endsWith("/mokly-manifest.json") ||
          fixture.git.reader.fileExists(commit, route),
      },
    };
    const { result } = await compareReview(
      fixture.after,
      { ...fixture.config, generatedOutput: mode },
      git,
      "main",
    );
    assert.equal(result.schemaVersion, 3);
    if (result.schemaVersion !== 3)
      assert.fail("expected component comparison");
    assert.deepEqual(result.changes, []);
  });
}
