import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { build, fixture } from "./helpers/static_changes.js";
import { timings } from "./helpers/static_timings.js";

test(
  "base capture timings report bounded retention and encoded payload bytes",
  { timeout: 120_000 },
  async (context) => {
    const { root } = await fixture();
    try {
      const result = await build(
        root,
        ["--debug-timings"],
        "rich",
        context.signal,
      );
      const records = timings(result.stderr);
      const captured = records.filter(
        (record) => record.stage === "review.capture-side",
      );
      assert.deepEqual(
        captured.map((record) => record.event),
        ["start", "counts", "end"],
      );
      const counts = captured[1]!;
      assert.equal(counts.views, 6);
      assert.equal(counts.uncapturedViews, 0);
      assert.ok(counts.encodedBytes! > 0);
      assert.ok(counts.retainedBytes! >= counts.encodedBytes!);
      assert.ok(counts.retainedBytes! <= 256 * 1024 * 1024);
      assert.equal(captured[2]!.status, "ok");
      assert.equal(captured[0]!.views, undefined);
      assert.equal(captured[0]!.uncapturedViews, undefined);
      assert.equal(captured[2]!.uncapturedViews, undefined);
      assert.equal(captured[0]!.retainedBytes, undefined);
      assert.equal(captured[0]!.encodedBytes, undefined);
      const parent = records.find(
        (record) => record.event === "start" && record.id === counts.parentId,
      );
      assert.equal(parent!.stage, "review.base-tree");
      for (const record of captured) {
        assert.equal(record.role, "core");
        assert.equal(record.session, parent!.session);
        assert.equal(record.parentId, parent!.id);
        assert.equal("path" in record, false);
        assert.equal("props" in record, false);
      }
      const validation = records.find(
        (record) =>
          record.stage === "review.capture-validate" &&
          record.event === "start",
      );
      assert.ok(validation);
      for (const [stage, count] of [
        ["review.capture-validate", 1],
        ["review.capture-document", 6],
        ["review.capture-encode", 6],
        ["review.capture-closure", 6],
      ] as const) {
        const ended = records.filter(
          (record) => record.stage === stage && record.event === "end",
        );
        assert.equal(ended.length, count, stage);
        for (const record of ended) {
          assert.equal(record.status, "ok");
          assert.equal(
            record.parentId,
            stage === "review.capture-validate" ? counts.id : validation.id,
          );
          assert.equal(record.session, counts.session);
          assert.equal("path" in record, false);
          assert.equal("props" in record, false);
        }
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
