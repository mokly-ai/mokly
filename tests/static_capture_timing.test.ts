import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { build, fixture } from "./helpers/static_changes.js";
import { timings } from "./helpers/static_timings.js";

test(
  "build capture timings report bounded retention for both sides",
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
      const captures = records.filter(
        (record) => record.stage === "review.capture-side",
      );
      const bySide = (side: "base" | "head") =>
        captures.filter((record) => record.side === side);
      const classify = records.find(
        (record) =>
          record.stage === "changes.classify" && record.event === "start",
      );
      assert.ok(classify);
      const head = bySide("head");
      const base = bySide("base");
      for (const [side, sideRecords, expectedParent, expectedViews] of [
        ["head", head, "output.write", 2],
        ["base", base, "review.base-tree", 6],
      ] as const) {
        assert.deepEqual(
          sideRecords.map((record) => record.event),
          ["start", "counts", "end"],
          side,
        );
        const start = sideRecords[0]!;
        const counts = sideRecords[1]!;
        const parent = records.find(
          (record) => record.event === "start" && record.id === start.parentId,
        );
        assert.equal(parent?.stage, expectedParent, side);
        assert.equal(counts.views, expectedViews);
        assert.equal(counts.uncapturedViews, 0);
        assert.ok(counts.encodedBytes! > 0);
        assert.ok(counts.retainedBytes! >= counts.encodedBytes!);
        assert.ok(counts.retainedBytes! <= 256 * 1024 * 1024);
        assert.equal(sideRecords[2]!.status, "ok");
        assert.equal(start.views, undefined);
        assert.equal(start.uncapturedViews, undefined);
        assert.equal(sideRecords[2]!.uncapturedViews, undefined);
        assert.equal(start.retainedBytes, undefined);
        assert.equal(start.encodedBytes, undefined);
        assert.equal(
          records.findIndex(
            (record) => record.event === "start" && record.id === start.id,
          ) < records.findIndex((record) => record.id === classify.id),
          side === "head",
        );
        for (const record of sideRecords) {
          assert.equal(record.role, "core");
          assert.equal(record.session, parent?.session);
          assert.equal(record.parentId, parent?.id);
          assert.equal("path" in record, false);
          assert.equal("props" in record, false);
        }
        const validation = records.find(
          (record) =>
            record.stage === "review.capture-validate" &&
            record.event === "start" &&
            record.parentId === start.id,
        );
        assert.ok(validation, side);
        const validationId = validation.id;
        for (const [stage, count] of [
          ["review.capture-validate", 1],
          ["review.capture-document", expectedViews],
          ["review.capture-encode", expectedViews],
          ["review.capture-closure", expectedViews],
        ] as const) {
          const ended = records.filter(
            (record) =>
              record.stage === stage &&
              record.event === "end" &&
              (stage === "review.capture-validate"
                ? record.id === validationId
                : record.parentId === validationId),
          );
          assert.equal(ended.length, count, `${side} ${stage}`);
          for (const record of ended) {
            assert.equal(record.status, "ok");
            assert.equal(record.session, counts.session);
            assert.equal("path" in record, false);
            assert.equal("props" in record, false);
          }
        }
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
