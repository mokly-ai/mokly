import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";

import type { PostcssEvidence } from "../packages/mokly/src/generated/sidecar/PostcssEvidence.js";
import {
  beginReadEvidenceGeneration,
  initializeReadEvidenceGeneration,
  ledgerMembers,
  observeBytes,
  preloadedObserver,
  readEvidence,
} from "../packages/mokly/src/sidecar/postcss-evidence.js";
import type { Ledger } from "../packages/mokly/src/sidecar/postcss-evidence.js";

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

test("PostCSS read evidence stays bounded to one simulated generation", (context) => {
  const generationFiles = (generation: number) =>
    Array.from({ length: 4 }, (_, read) =>
      path.resolve(`/inputs/generation-${generation}/read-${read}.txt`),
    );
  const measure = (generations: number): number => {
    for (let generation = 0; generation < generations; generation++) {
      beginReadEvidenceGeneration(`generation-${generation}`);
      for (const [read, file] of generationFiles(generation).entries())
        observeBytes(file, Buffer.from(`${generation}:${read}`));
    }
    return readEvidence([]).reads.length;
  };

  for (const resolve of [path.resolve, path.win32.resolve]) {
    context.mock.method(path, "resolve", resolve);
    const small = measure(4);
    const large = measure(16);
    assert.equal(small, 4);
    assert.equal(large, 4);
    assert.ok(small > 0);
    assert.ok(large <= small * 4.5);
    assert.deepEqual(
      readEvidence([]).reads.map((read) => read.path),
      generationFiles(15),
    );
    context.mock.restoreAll();
  }
});

test("every ledger function reaches a shared ledger", (context) => {
  const key = Symbol.for("mokly.postcss.ledger");
  const calls: string[] = [];
  const shared: PostcssEvidence = {
    coverage: "incomplete",
    modules: [],
    reads: [],
  };
  const fake: Ledger = {
    readEvidence: (loaded) => {
      calls.push(`readEvidence ${[...loaded].join(" ")}`);
      return shared;
    },
    resetGeneration: (generation) => {
      calls.push(`resetGeneration ${generation}`);
    },
    initializeGeneration: (generation) => {
      calls.push(`initializeGeneration ${generation}`);
    },
  };
  // Each case calls the worker's entry point for one ledger function.
  const cases: { [Member in keyof Ledger]: () => void } = {
    readEvidence: () => {
      assert.equal(preloadedObserver(), fake.readEvidence);
      assert.equal(readEvidence([path.resolve("/loaded.css")]), shared);
    },
    resetGeneration: () => beginReadEvidenceGeneration("generation-2"),
    initializeGeneration: () =>
      initializeReadEvidenceGeneration("generation-1"),
  };
  assert.deepEqual(Object.keys(cases).sort(), [...ledgerMembers].sort());
  Object.defineProperty(globalThis, key, { value: fake, configurable: true });
  context.after(() => Reflect.deleteProperty(globalThis, key));
  for (const member of ledgerMembers) {
    calls.length = 0;
    cases[member]();
    assert.ok(calls.length > 0, `${member} must reach the shared ledger`);
    assert.ok(
      calls.every((call) => call.startsWith(`${member} `)),
      `${member} must call only its own shared function: ${calls.join("; ")}`,
    );
  }
  assert.equal(Reflect.deleteProperty(globalThis, key), true);
  assert.equal(preloadedObserver(), undefined);
});
