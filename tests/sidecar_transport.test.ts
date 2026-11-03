import assert from "node:assert/strict";
import test from "node:test";

import { jsonText } from "../packages/mokly/src/sidecar/json.js";
import {
  encodeFrame,
  frames,
} from "../packages/mokly/src/sidecar/transport.js";

async function* chunks(...values: Uint8Array[]) {
  yield* values;
}
async function decode(input: Uint8Array[]) {
  const result: unknown[] = [];
  for await (const value of frames(chunks(...input))) result.push(value);
  return result;
}

test("transport keeps negative zero data", async () => {
  const encoded = encodeFrame({ id: 1, props: { value: -0 } });
  assert.match(encoded, /"value":-0/);
  const [frame] = await decode([Buffer.from(encoded)]);
  assert.ok(Object.is((frame as { props: { value: number } }).props.value, -0));
});

test("sidecar framing accepts split characters and caps outbound UTF-8 bytes", async () => {
  const body = Buffer.from('{"value":"é"}\n');
  const index = body.indexOf(0xc3);
  assert.deepEqual(
    await decode([body.subarray(0, index + 1), body.subarray(index + 1)]),
    [{ value: "é" }],
  );
  const limit = body.length - 1;
  assert.deepEqual(await decode([body]), [{ value: "é" }]);
  assert.equal(encodeFrame({ value: "é" }, limit), body.toString());
  assert.throws(() => encodeFrame({ value: "é" }, limit - 1), /exceeds/);
});

test("sidecar framing rejects invalid JSON and splits newline frames", async () => {
  await assert.rejects(decode([Buffer.from("no\n")]), /JSON/);
  await assert.rejects(decode([Buffer.from("\n")]), /JSON/);
  assert.deepEqual(await decode([Buffer.from("{}\n{}\n")]), [{}, {}]);
});

test("wire object keys use UTF-16 order even for integer-shaped names", () => {
  assert.equal(
    jsonText({ "2": ["number", "2"], "10": ["number", "10"] }),
    '{"10":["number","10"],"2":["number","2"]}',
  );
});
