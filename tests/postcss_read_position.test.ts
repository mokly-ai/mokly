import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { readEvidence } from "../packages/mokly/src/sidecar/postcss-evidence.js";
import {
  begin,
  closed,
  finish,
  opened,
} from "../packages/mokly/src/sidecar/postcss-read-position.js";

test("ambiguous sequential reads never guess offsets and descriptor reuse starts a new generation", () => {
  const first = path.resolve("/inputs/concurrent.txt");
  const second = path.resolve("/inputs/reused.txt");
  opened(50, first, () => undefined);
  const a = begin(50, null);
  const b = begin(50, null);
  finish(b, Buffer.from("second"));
  finish(a, Buffer.from("first"));
  finish(begin(50, null), Buffer.from("unknown-position"));
  assert.deepEqual(
    readEvidence([]).reads.filter((read) => read.path === first),
    [],
  );
  finish(begin(50, 4), Buffer.from("known-position"));
  const pending = begin(50, 0);
  closed(50);
  opened(50, second, () => undefined);
  finish(pending, Buffer.from("old-generation"));
  finish(begin(50, null), Buffer.from("new"));
  closed(50);
  const result = readEvidence([]);
  assert.equal(result.reads.filter((read) => read.path === first).length, 1);
  assert.ok(
    result.reads.some(
      (read) =>
        read.path === second &&
        read.kind === "byte-range" &&
        read.offset === 0 &&
        read.length === 3,
    ),
  );
  assert.equal(result.coverage, "incomplete");
});

test("bigint sentinels advance the cursor and unproven positions invalidate it", () => {
  const file = path.resolve("/inputs/positions.txt");
  opened(51, file, () => undefined);
  finish(begin(51, -1n), Buffer.from("a"));
  finish(begin(51, null), Buffer.from("b"));
  finish(begin(51, NaN), Buffer.from("c"));
  finish(begin(51, null), Buffer.from("d"));
  finish(begin(51, 5), Buffer.from("f"));
  closed(51);
  assert.deepEqual(
    readEvidence([])
      .reads.filter((read) => read.path === file)
      .map((read) =>
        read.kind === "byte-range" ? [read.offset, read.digest] : undefined,
      ),
    [
      [0, createHash("sha256").update("a").digest("hex")],
      [1, createHash("sha256").update("b").digest("hex")],
      [5, createHash("sha256").update("f").digest("hex")],
    ],
  );
});
