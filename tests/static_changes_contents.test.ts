import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { EntryDetailV2 } from "../packages/viewer/src/generated/catalogue/EntryDetailV2.js";
import type { ReviewResultV8 } from "../packages/viewer/src/generated/catalogue/ReviewResultV8.js";

import { build, fixture, json } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { checkIdentity } from "./helpers/static_identity.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test(
  "static comparisons retain removed records evidence and isolated before and after resources",
  { timeout: 120_000 },
  async () => {
    const { root, base } = await fixture();
    try {
      const ready = await build(root);
      assert.ok(ready.index.comparisonUrl);
      const prefix = path.posix.dirname(ready.index.comparisonUrl);
      const generation = path.posix.basename(prefix);
      const review = await json<ReviewResultV8>(
        ready.output,
        ready.index.comparisonUrl,
      );
      assert.equal(review.schemaVersion, 8);
      assert.deepEqual(
        [
          ...ready.index.screens,
          ...ready.index.components,
          ...ready.index.pages,
          ...ready.index.documents,
          ...ready.index.useCases,
          ...ready.index.removedEntries.map((record) => record.entry),
        ]
          .filter(
            (entry) =>
              entry.changes.status === "ready" && entry.changes.included,
          )
          .map((entry) => entry.path)
          .sort(),
        ["home", "old", "old-note", "retired"],
      );
      assert.equal(ready.index.base, "fixture-base");
      assert.equal(review.baseCommit, base);
      const output = await files(ready.output);
      assert.equal(output.has(`${prefix}/snapshot.json`), false);
      await checkIdentity(
        ready.output,
        ready.index.comparisonUrl,
        ready.index.deploymentId,
      );
      assert.match(
        output
          .get(
            `${prefix}/snapshots/before/mokly-generated/home/index.desktop.html`,
          )!
          .toString(),
        /Before/u,
      );
      assert.match(
        output
          .get(
            `${prefix}/snapshots/after/mokly-generated/home/index.desktop.html`,
          )!
          .toString(),
        /After/u,
      );
      assert.match(
        output.get(`${prefix}/snapshots/before/logo.svg`)!.toString(),
        /Before asset/u,
      );
      assert.match(
        output.get(`${prefix}/snapshots/after/logo.svg`)!.toString(),
        /After asset/u,
      );
      const detail = await json<EntryDetailV2>(
        ready.output,
        "mokly-viewer/entries/home.json",
      );
      assert.equal(detail.deploymentId, ready.index.deploymentId);
      assert.deepEqual(
        detail.reasons,
        review.entries.find((entry) => entry.path === "home")!.reasons,
      );
      for (const view of detail.views)
        assert.ok(
          view.resourceEvidence!.resources.some(
            (entry) => entry.path === "static/logo.svg",
          ),
        );
      assert.deepEqual(
        ready.index.removedEntries.map((entry) => entry.entry.path).sort(),
        ["old", "old-note", "retired"],
      );
      for (const removed of ready.index.removedEntries) {
        assert.ok(output.has(`view/${removed.entry.path}/index.html`));
        const historical = await json<EntryDetailV2>(
          ready.output,
          `${prefix}/entries/${removed.entry.path}.json`,
        );
        assert.equal(historical.generation, generation);
        assert.equal(historical.entry.snapshotId, removed.snapshotId);
        assert.equal(historical.deploymentId, undefined);
        assert.equal(historical.revision, undefined);
        assert.deepEqual(historical.reasons, [{ kind: "removed" }]);
        assert.equal(removed.preview!.kind, removed.entry.kind);
        if (removed.entry.kind !== "screen")
          assert.ok(
            output.has(`${prefix}/previews/${removed.entry.path}/index.json`),
          );
      }
      await fs.rm(path.join(root, "specs"), { recursive: true });
      await fs.rm(path.join(root, "logo.svg"));
      assert.deepEqual(await files(ready.output), output);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "build review timing spans descend from the one output transaction and pin the base once",
  { timeout: 120_000 },
  async () => {
    const { root } = await fixture();
    try {
      const result = await command(root, "build", [
        "--out=.context/site",
        "--debug-timings",
      ]).result;
      assert.equal(result.code, 0, result.stderr);
      const starts = timings(result.stderr).filter(
        (record) => record.event === "start",
      );
      const writes = starts.filter((record) => record.stage === "output.write");
      assert.equal(writes.length, 1);
      assert.equal(
        starts.filter((record) => record.stage === "review.base-commit").length,
        1,
      );
      for (const stage of [
        "review.base-commit",
        "changes.classify",
        "review.base-tree",
        "review.compare-views",
        "review.resource-graph",
        "review.capture",
      ]) {
        const records = starts.filter((record) => record.stage === stage);
        assert.ok(records.length > 0, stage);
        for (const record of records) {
          let parent = record.parentId;
          while (parent && parent !== writes[0]!.id)
            parent = starts.find((record) => record.id === parent)?.parentId;
          assert.equal(parent, writes[0]!.id, stage);
        }
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
