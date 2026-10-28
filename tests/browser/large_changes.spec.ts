import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { benchmark } from "../../scripts/large/benchmark.js";
import { prepareFixture } from "../../scripts/large/setup.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";

for (const variant of ["html", "react"] as const) {
  test(`large changes delivers browser evidence for ${variant}`, async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/large-changes-"),
    );
    try {
      const fixture = await prepareFixture(
        repositoryRoot,
        { areas: 1, screens: 2, rows: 1, stylesheets: 1 },
        variant,
        "workspace",
        root,
      );
      const report = await benchmark(fixture, ["changes"], 1, {
        memoryStopKiB: 0,
        browser,
      });
      assert.equal(report.results.length, 2);
      const cacheDirectories: string[] = [];
      for (const result of report.results) {
        assert.ok("status" in result && result.status === "measured");
        assert.ok(
          "summary" in result &&
            typeof result.summary === "object" &&
            result.summary,
        );
        assert.ok("baseCommit" in result.summary);
        assert.equal(result.summary.baseCommit, fixture.baseline);
        assert.ok(
          "included" in result.summary && result.summary.included === 0,
        );
        assert.ok(
          "basePreparation" in result &&
            typeof result.basePreparation === "object" &&
            result.basePreparation,
        );
        assert.ok("cacheDirectory" in result.basePreparation);
        if (variant === "react") {
          assert.equal(typeof result.basePreparation.cacheDirectory, "string");
          const directory = result.basePreparation.cacheDirectory;
          assert.ok(typeof directory === "string");
          cacheDirectories.push(directory);
          const sourceEntries = await fs.readdir(
            path.join(directory, "sources/entries"),
          );
          assert.equal(sourceEntries.length, 1);
          const sourceKey = sourceEntries[0];
          assert.ok(sourceKey);
          assert.match(sourceKey, /^[a-f0-9]{64}$/u);
          await fs.access(
            path.join(
              directory,
              "sources/entries",
              sourceKey,
              "data/mokly.config.json",
            ),
          );
        }
        assert.ok("comparison" in result && Array.isArray(result.comparison));
        assert.equal(result.comparison.length, 1);
        assert.ok(
          "publication" in result &&
            typeof result.publication === "object" &&
            result.publication,
        );
        assert.ok("revision" in result.publication && "revision" in result);
        assert.equal(result.publication.revision, result.revision);
      }
      if (variant === "react")
        assert.equal(cacheDirectories[0], cacheDirectories[1]);
      for (const state of ["cold", "warm"]) {
        const log = await fs.readFile(
          path.join(root, `.context/changes-${state}.log`),
          "utf8",
        );
        assert.match(log, /Mokly listening/);
      }
      await assert.rejects(fs.access(path.join(root, "mokly-static")), {
        code: "ENOENT",
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
}
