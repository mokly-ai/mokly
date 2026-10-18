import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import { timingOutput } from "../packages/mokly/src/sidecar/timing-output.js";

test("timing records start a line after partial consumer strings and buffers", () => {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  const timing = timingOutput(stream);
  timing("first\n");
  stream.write("progress\r");
  timing("second\n");
  stream.write(Buffer.from("partial"));
  stream.write("");
  timing("third\n");
  stream.write("complete\n");
  timing("fourth\n");
  stream.write("Cg==", "base64");
  timing("fifth\n");
  stream.write(new DataView(Uint8Array.from([120, 10]).buffer));
  timing("sixth\n");
  stream.write(new Uint16Array(Uint8Array.from([10, 120]).buffer));
  timing("seventh\n");
  assert.deepEqual(chunks, [
    "first\n",
    "progress\r",
    "\nsecond\n",
    "partial",
    "",
    "\nthird\n",
    "complete\n",
    "fourth\n",
    "\n",
    "fifth\n",
    "x\n",
    "sixth\n",
    "\nx",
    "\nseventh\n",
  ]);
});

test("stderr tracking keeps backpressure and every callback form", async () => {
  let finish: ((error?: Error | null) => void) | undefined;
  const stream = new Writable({
    highWaterMark: 1,
    write(_chunk, _encoding, callback) {
      finish = callback;
    },
  });
  timingOutput(stream);
  for (const form of ["callback", "encoded", "undefined"] as const) {
    let done!: () => void;
    const completed = new Promise<void>((resolve) => {
      done = resolve;
    });
    const accepted =
      form === "encoded"
        ? stream.write("x", "utf8", done)
        : form === "undefined"
          ? stream.write("x", undefined, done)
          : stream.write("x", done);
    assert.equal(accepted, false);
    assert.ok(finish);
    finish();
    await completed;
  }
});
