import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { benchmark } from "../scripts/large/benchmark.js";
import { prepareFixture } from "../scripts/large/setup.js";

import { repositoryRoot } from "./helpers/fixture.js";

test(
  "large Changes delivers ready indexes and reviews on both variants",
  {
    timeout: 300_000,
  },
  async (t) => {
    for (const variant of ["html", "react"] as const) {
      const root = await fs.mkdtemp(
        path.join(repositoryRoot, ".context/large-changes-"),
      );
      t.after(() => fs.rm(root, { recursive: true, force: true }));
      const fixture = await prepareFixture(
        repositoryRoot,
        { areas: 1, screens: 2, rows: 1, stylesheets: 1 },
        variant,
        "workspace",
        root,
      );
      const report = await benchmark(fixture, ["changes"], 1, {
        memoryStopKiB: 0,
      });
      assert.equal(report.results.length, 2);
      for (const result of report.results) {
        assert.ok("status" in result && result.status === "measured");
        assert.ok(
          "review" in result &&
            typeof result.review === "object" &&
            result.review,
        );
        assert.ok("baseCommit" in result.review);
        assert.equal(result.review.baseCommit, fixture.baseline);
        assert.ok("included" in result.review && result.review.included === 0);
        assert.ok("affected" in result.review && result.review.affected === 0);
        assert.ok(
          "basePreparation" in result &&
            typeof result.basePreparation === "object" &&
            result.basePreparation,
        );
        assert.ok("cacheDirectory" in result.basePreparation);
        if (variant === "react")
          assert.equal(typeof result.basePreparation.cacheDirectory, "string");
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
    }
  },
);
