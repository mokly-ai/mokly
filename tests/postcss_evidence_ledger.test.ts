import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";

import {
  observeBytes,
  readEvidence,
} from "../packages/mokly/src/sidecar/postcss-evidence.js";

test("PostCSS hashing scales with observed reads and storage retains only distinct digests", (context) => {
  const original = crypto.createHash;
  let calls = 0;
  context.mock.method(
    crypto,
    "createHash",
    (...args: Parameters<typeof original>) => {
      calls++;
      return original(...args);
    },
  );
  syncBuiltinESMExports();
  try {
    const measure = (size: number) => {
      calls = 0;
      for (let index = 0; index < size; index++)
        observeBytes(
          `/inputs/${size}/${index}.txt`,
          Buffer.alloc(32 * 1024, index),
        );
      const reads = readEvidence([]).reads.filter((read) =>
        read.path.includes(`/inputs/${size}/`),
      );
      assert.equal(reads.length, size);
      assert.ok(reads.every((read) => read.digest.length === 64));
      return { calls, bytes: Buffer.byteLength(JSON.stringify(reads)) };
    };
    const small = measure(4);
    const large = measure(16);
    assert.ok(small.calls > 0 && small.bytes > 0);
    assert.equal(large.calls, small.calls * 4);
    assert.ok(large.bytes <= small.bytes * 4.5);
    observeBytes("/inputs/repeated.txt", Buffer.from("old"));
    observeBytes("/inputs/repeated.txt", Buffer.from("old"));
    observeBytes("/inputs/repeated.txt", Buffer.from("new"));
    const result = readEvidence([]);
    assert.equal(
      result.reads.filter((read) => read.path.endsWith("/repeated.txt")).length,
      2,
    );
    assert.equal(result.coverage, "incomplete");
    context.diagnostic(
      `hash calls: ${small.calls} / ${large.calls}; encoded evidence bytes: ${small.bytes} / ${large.bytes}`,
    );
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
