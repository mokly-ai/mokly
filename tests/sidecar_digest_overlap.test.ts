import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as immediate } from "node:timers/promises";

import { currentFileInputs } from "../packages/mokly/src/sidecar/file-digests.js";

import { controlledReads } from "./helpers/sidecar_digest_overlap.js";

const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const hello =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

test("reuse overlaps four first reads and reuses their bounded buffers", async (context) => {
  const names = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  const files = Object.fromEntries(
    names.map((name, index) => [name, { bytes: index % 2 ? "hello" : "abc" }]),
  );
  const inputs = Object.fromEntries(
    names.map((name, index) => [name, index % 2 ? hello : abc]),
  );
  const io = controlledReads(context, files);
  const job = currentFileInputs(inputs);
  for (const count of [4, 4, 1]) {
    assert.equal(io.waiting.length, count);
    assert.equal(io.buffers.size, 4);
    const reads = io.waiting.splice(0);
    for (const read of reads) read.complete();
    await immediate();
  }
  assert.equal(await job, true);
  assert.deepEqual(io.opened, names);
  assert.equal(io.closed.length, 9);
  assert.equal(io.buffers.size, 4);
  assert.equal(io.waiting.length, 0);
});

test("reuse continues short first reads to actual EOF regardless of stat size", async (context) => {
  const io = controlledReads(context, {
    growing: { bytes: "abc", firstLength: 1, statSize: 1 },
    shrinking: { bytes: "hello", firstLength: 2, statSize: 99 },
    empty: { bytes: "", statSize: 12 },
  });
  const job = currentFileInputs({
    growing: abc,
    shrinking: hello,
    empty: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  });
  assert.equal(io.waiting.length, 3);
  for (const read of io.waiting.splice(0)) read.complete();
  assert.equal(await job, true);
  assert.deepEqual(Object.fromEntries(io.lengths), {
    growing: [1, 2, 0],
    shrinking: [2, 3, 0],
    empty: [0],
  });
  assert.equal(io.closed.length, 3);
});

test("a failed first read closes its handle and waits for the other active reads", async (context) => {
  const io = controlledReads(
    context,
    Object.fromEntries(
      ["bad", "one", "two", "three", "unstarted"].map((name) => [
        name,
        { bytes: "abc" },
      ]),
    ),
  );
  let settled = false;
  const job = currentFileInputs({
    bad: abc,
    one: abc,
    two: abc,
    three: abc,
    unstarted: abc,
  }).then((result) => {
    settled = true;
    return result;
  });
  assert.equal(io.waiting.length, 4);
  io.waiting
    .shift()!
    .complete(Object.assign(new Error("read denied"), { code: "EACCES" }));
  await immediate();
  assert.deepEqual(io.closed, [1]);
  assert.equal(settled, false);
  assert.equal(io.waiting.length, 3);
  assert.deepEqual(io.opened, ["bad", "one", "two", "three"]);
  for (const read of io.waiting.splice(0)) read.complete();
  assert.equal(await job, false);
  assert.deepEqual(io.closed, [1, 2, 3, 4]);
  assert.deepEqual(io.opened, ["bad", "one", "two", "three"]);
});
