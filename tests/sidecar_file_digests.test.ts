import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import type { TestContext } from "node:test";

import {
  everyInput,
  fileDigest,
} from "../packages/mokly/src/sidecar/file-digests.js";

let cooperativeClock = 1_000_000;

function synchronousReads(context: TestContext) {
  context.mock.method(fs.promises, "open", () => {
    assert.fail("digest reads must use the synchronous filesystem boundary");
  });
  context.mock.method(fs, "openSync", () => 17);
  context.mock.method(fs, "fstatSync", () => ({
    isFile: () => true,
    isDirectory: () => false,
  }));
  context.mock.method(fs, "readSync", () => 0);
  return context.mock.method(fs, "closeSync", () => undefined);
}

test("digests reject FIFO handles through nonblocking opens", async (context) => {
  const close = synchronousReads(context);
  context.mock.method(fs, "openSync", (file: string, flags: number) => {
    assert.equal(file, "fifo");
    assert.equal(flags, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    return 17;
  });
  context.mock.method(fs, "fstatSync", () => ({
    isFile: () => false,
    isDirectory: () => false,
  }));
  await assert.rejects(fileDigest("fifo"), { message: "not a regular file" });
  assert.equal(close.mock.callCount(), 1);
});

test("digests preserve missing results and close handles after read failures", async (context) => {
  const close = synchronousReads(context);
  let phase = "";
  let failure = Object.assign(new Error("missing"), { code: "ENOENT" });
  context.mock.method(fs, "openSync", () => {
    if (phase === "open") throw failure;
    return 17;
  });
  context.mock.method(fs, "fstatSync", () => {
    if (phase === "stat") throw failure;
    return { isFile: () => true, isDirectory: () => false };
  });
  context.mock.method(fs, "readSync", () => {
    if (phase === "read") throw failure;
    return 0;
  });
  for (const code of ["ENOENT", "ENOTDIR"]) {
    phase = "open";
    failure = Object.assign(new Error(code), { code });
    assert.equal(await fileDigest("candidate"), null);
  }
  assert.equal(close.mock.callCount(), 0);
  for (const operation of ["open", "stat", "read"]) {
    phase = operation;
    failure = Object.assign(new Error(operation), { code: "EACCES" });
    const before = close.mock.callCount();
    await assert.rejects(fileDigest("candidate"), (error) => error === failure);
    assert.equal(close.mock.callCount() - before, operation === "open" ? 0 : 1);
  }
  phase = "";
  const closeFailure = Object.assign(new Error("close"), { code: "EIO" });
  context.mock.method(fs, "closeSync", () => {
    throw closeFailure;
  });
  await assert.rejects(
    fileDigest("candidate"),
    (error) => error === closeFailure,
  );
});

test("large digests reuse one bounded buffer and hash every byte", async (context) => {
  const close = synchronousReads(context);
  const buffers = new Set<Buffer>();
  const lengths: number[] = [];
  let remaining = 131_089;
  context.mock.method(
    fs,
    "readSync",
    (
      handle: number,
      buffer: Buffer,
      offset: number,
      length: number,
      position: null,
    ) => {
      assert.equal(handle, 17);
      assert.equal(offset, 0);
      assert.equal(length, 65_536);
      assert.equal(position, null);
      buffers.add(buffer);
      const read = Math.min(remaining, length);
      buffer.fill(97, 0, read);
      remaining -= read;
      lengths.push(read);
      return read;
    },
  );
  assert.equal(
    await fileDigest("large"),
    "c5e33faedb41ecc23507197af1d853212ff36641279638ebc1288c90f417404f",
  );
  assert.deepEqual(lengths, [65_536, 65_536, 17, 0]);
  assert.equal(buffers.size, 1);
  assert.equal([...buffers][0]!.byteLength, 65_536);
  assert.equal(close.mock.callCount(), 1);
});

test("concurrent large digests yield without mixing their bytes", async (context) => {
  synchronousReads(context);
  let completed = 0;
  let completedAtCallback = -1;
  let scheduled = false;
  let observe: () => void = () => assert.fail("callback was not initialized");
  const callback = new Promise<void>((resolve) => {
    observe = resolve;
  });
  const remaining = new Map([
    [17, 131_089],
    [18, 131_089],
  ]);
  const buffers = new Set<Buffer>();
  context.mock.method(performance, "now", () => cooperativeClock);
  context.mock.method(fs, "openSync", (file: string) =>
    file === "a" ? 17 : 18,
  );
  context.mock.method(fs, "readSync", (handle: number, buffer: Buffer) => {
    const read = Math.min(remaining.get(handle)!, buffer.length);
    buffer.fill(handle === 17 ? 97 : 98, 0, read);
    remaining.set(handle, remaining.get(handle)! - read);
    buffers.add(buffer);
    cooperativeClock += 100;
    if (!scheduled) {
      scheduled = true;
      setImmediate(() => {
        completedAtCallback = completed;
        observe();
      });
    }
    return read;
  });
  const jobs = Promise.all(
    ["a", "b"].map(async (file) => {
      const digest = await fileDigest(file);
      completed += 1;
      return digest;
    }),
  );
  const [digests] = await Promise.all([jobs, callback]);
  assert.deepEqual(digests, [
    "c5e33faedb41ecc23507197af1d853212ff36641279638ebc1288c90f417404f",
    "15541f0282b109050eff0622058eeeb0c9e7f32afcbbd67bd26ea08352c1dce9",
  ]);
  assert.equal(completedAtCallback, 0);
  assert.equal(buffers.size, 1);
});

test("input workers allow queued callbacks before all checks finish", async (context) => {
  const events: string[] = [];
  let checked = 0;
  let completedBeforeCallback = 0;
  context.mock.method(performance, "now", () => cooperativeClock);
  let observe: () => void = () => assert.fail("callback was not initialized");
  const callback = new Promise<void>((resolve) => {
    observe = resolve;
  });
  const job = everyInput(
    Array.from({ length: 40 }, (_, index) => index),
    async () => {
      checked += 1;
      cooperativeClock += 100;
      if (checked === 1)
        setImmediate(() => {
          completedBeforeCallback = checked;
          events.push("callback");
          observe();
        });
      return true;
    },
  ).then((result) => {
    events.push("finished");
    return result;
  });
  await callback;
  assert.equal(await job, true);
  assert.ok(completedBeforeCallback < 40);
  assert.deepEqual(events, ["callback", "finished"]);
});
