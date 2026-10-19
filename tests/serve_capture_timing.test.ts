import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { completed, serve } from "./helpers/mokly_serve.js";
import { fixture } from "./helpers/static_changes.js";
import { timings } from "./helpers/static_timings.js";

test(
  "Serve reports base capture counts beneath its Changes classification",
  { timeout: 120_000 },
  async (context) => {
    const { root } = await fixture();
    const running = serve(context, root, false, ["--debug-timings"]);
    try {
      const url = await running.ready();
      const { index } = await completed(url, context.signal, "home");
      assert.equal(index.changesStatus, "ready");
      await running.wait(
        "stderr",
        /^\[mokly:timing\] (?=.*"event":"end")(?=.*"stage":"changes.classify").+$/mu,
      );
      const records = timings(running.output.stderr).filter(
        (record) => record.role === "core",
      );
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
      assert.equal(captured[2]!.status, "ok");
      const parent = records.find(
        (record) => record.event === "start" && record.id === counts.parentId,
      );
      assert.equal(parent?.stage, "review.compare-views");
      const classification = records.find(
        (record) => record.event === "start" && record.id === parent?.parentId,
      );
      assert.equal(classification?.stage, "changes.classify");
      for (const record of captured) {
        assert.equal(record.parentId, parent!.id);
        assert.equal(record.session, classification!.session);
      }
    } finally {
      await running.close();
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
