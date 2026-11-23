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
      const starts = records.filter(
        (record) => record.role === "core" && record.event === "start",
      );
      const byId = new Map(
        starts.map((record) => [`${record.session}:${record.id}`, record]),
      );
      const baseCapture = base[0]!;
      const basePreparation = byId.get(
        `${baseCapture.session}:${baseCapture.parentId}`,
      );
      assert.ok(basePreparation);
      assert.equal(basePreparation.stage, "review.base-tree");
      assert.equal(basePreparation.session, classify.session);
      assert.equal(basePreparation.parentId, classify.id);
      const preparationStart = records.indexOf(basePreparation);
      const preparationEnd = records.findIndex(
        (record) =>
          record.event === "end" &&
          record.session === basePreparation.session &&
          record.id === basePreparation.id,
      );
      assert.ok(preparationEnd > preparationStart);
      const documents = starts.filter(
        (record) => record.stage === "render.document",
      );
      assert.ok(documents.length > 0, "core document renders were recorded");
      const jobs = documents.map((document) => {
        const ancestors: string[] = [];
        let parentId = document.parentId;
        while (parentId !== undefined) {
          const parent = byId.get(`${document.session}:${parentId}`);
          assert.ok(parent, `missing parent of render.document ${document.id}`);
          ancestors.push(parent.stage);
          parentId = parent.parentId;
        }
        return {
          document,
          ancestors,
          earlyBase:
            document.session === basePreparation.session &&
            document.parentId === basePreparation.id,
        };
      });
      for (const { document, ancestors } of jobs.filter(
        (job) => !job.earlyBase,
      )) {
        assert.ok(
          ancestors.includes("review.capture-side"),
          `render.document ${document.id} must have a review.capture-side ancestor: ${ancestors.join(" -> ")}`,
        );
      }
      for (const { document } of jobs.filter((job) => job.earlyBase)) {
        const documentStart = records.indexOf(document);
        const documentEnd = records.findIndex(
          (record) =>
            record.event === "end" &&
            record.session === document.session &&
            record.id === document.id,
        );
        assert.ok(preparationStart < documentStart);
        assert.ok(documentEnd > documentStart);
        assert.ok(documentEnd < preparationEnd);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
