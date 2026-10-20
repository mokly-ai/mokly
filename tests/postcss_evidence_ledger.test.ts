import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
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
    const measure = (size: number, separator: string) => {
      calls = 0;
      for (let index = 0; index < size; index++)
        observeBytes(
          `/inputs/${size}/${index}.txt`,
          Buffer.alloc(32 * 1024, index),
        );
      const prefix = path.resolve(`/inputs/${size}`) + separator;
      const reads = readEvidence([]).reads.filter((read) =>
        read.path.startsWith(prefix),
      );
      assert.equal(reads.length, size);
      assert.ok(reads.every((read) => read.digest.length === 64));
      return { calls, bytes: Buffer.byteLength(JSON.stringify(reads)) };
    };
    const check = (label: string, separator: string) => {
      const small = measure(4, separator);
      const large = measure(16, separator);
      assert.ok(small.calls > 0 && small.bytes > 0);
      assert.equal(large.calls, small.calls * 4);
      assert.ok(large.bytes <= small.bytes * 4.5);
      context.diagnostic(
        `${label}: hash calls: ${small.calls} / ${large.calls}; encoded evidence bytes: ${small.bytes} / ${large.bytes}`,
      );
    };
    check("native paths", path.sep);
    context.mock.method(path, "resolve", path.win32.resolve);
    check("Windows paths", path.win32.sep);
    observeBytes("/inputs/repeated.txt", Buffer.from("old"));
    observeBytes("/inputs/repeated.txt", Buffer.from("old"));
    observeBytes("/inputs/repeated.txt", Buffer.from("new"));
    const result = readEvidence([]);
    assert.equal(
      result.reads.filter(
        (read) => read.path === path.resolve("/inputs/repeated.txt"),
      ).length,
      2,
    );
    assert.equal(result.coverage, "incomplete");
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
