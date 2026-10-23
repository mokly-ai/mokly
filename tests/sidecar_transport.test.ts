import assert from "node:assert/strict";
import test from "node:test";

import { jsonText } from "../packages/mokly/src/sidecar/json.js";
import { requestId } from "../packages/mokly/src/sidecar/request-id.js";
import { request } from "../packages/mokly/src/sidecar/requests.js";
import {
  encodeFrame,
  encodeResponse,
  frames,
} from "../packages/mokly/src/sidecar/transport.js";

async function* chunks(...values: Uint8Array[]) {
  yield* values;
}
async function decode(input: Uint8Array[], limit?: number) {
  const result: unknown[] = [];
  for await (const value of frames(chunks(...input), limit)) result.push(value);
  return result;
}

test("transport keeps negative zero data", async () => {
  const encoded = encodeFrame({ id: 1, props: { value: -0 } });
  assert.match(encoded, /"value":-0/);
  const [frame] = await decode([Buffer.from(encoded)]);
  assert.ok(Object.is((frame as { props: { value: number } }).props.value, -0));
});

test("opaque u64 ids keep their JSON digits", async () => {
  const maximum = "18446744073709551615";
  const [frame] = await decode([
    Buffer.from(`{"params":{"id":17},"id":${maximum},"method":"hello"}\n`),
  ]);
  assert.equal(requestId(frame), maximum);
  assert.equal(
    encodeResponse(maximum, { result: null }),
    `{"id":${maximum},"result":null}\n`,
  );
  const [overflow] = await decode([
    Buffer.from('{"id":18446744073709551616}\n'),
  ]);
  assert.equal(requestId(overflow), undefined);
  const [fraction] = await decode([Buffer.from('{"id":1.0}\n')]);
  assert.equal(requestId(fraction), undefined);
  await assert.rejects(
    decode([Buffer.from('{"id":1,"id":2}\n')]),
    /JSON|duplicate/,
  );
});

test("sidecar framing counts UTF-8 JSON bytes and accepts split characters", async () => {
  const body = Buffer.from('{"value":"é"}\n');
  const index = body.indexOf(0xc3);
  assert.deepEqual(
    await decode([body.subarray(0, index + 1), body.subarray(index + 1)]),
    [{ value: "é" }],
  );
  const limit = body.length - 1;
  assert.deepEqual(await decode([body], limit), [{ value: "é" }]);
  await assert.rejects(decode([body], limit - 1), /exceeds/);
  await assert.rejects(decode([Buffer.alloc(limit + 1, 32)], limit), /exceeds/);
  assert.equal(encodeFrame({ value: "é" }, limit), body.toString());
  assert.throws(() => encodeFrame({ value: "é" }, limit - 1), /exceeds/);
});

test("sidecar framing rejects invalid UTF-8, JSON and incomplete EOF", async () => {
  await assert.rejects(decode([Buffer.from([0xff, 10])]), /UTF-8/);
  await assert.rejects(decode([Buffer.from("no\n")]), /JSON/);
  await assert.rejects(decode([Buffer.from("{}")]), /unterminated/);
  await assert.rejects(decode([Buffer.from("\n")]), /JSON/);
  assert.deepEqual(await decode([Buffer.from("{}\n{}\n")]), [{}, {}]);
});

test("wire object keys use UTF-16 order even for integer-shaped names", () => {
  assert.equal(
    jsonText({ "2": ["number", "2"], "10": ["number", "10"] }),
    '{"10":["number","10"],"2":["number","2"]}',
  );
});

test("evaluation digests belong only to bundle requests", () => {
  for (const method of ["renderScreen", "renderComponent"]) {
    const params = {
      generation: "generation",
      handle: "entry#screen",
      entry: { path: "screen", title: "Screen" },
      props: {},
      viewport: "desktop",
      colorScheme: "light",
      ...(method === "renderComponent"
        ? { slots: {}, ignoreScope: "enabled" }
        : {}),
    };
    assert.equal(request({ id: 1, method, params }).method, method);
    assert.throws(
      () =>
        request({ id: 2, method, params: { ...params, evaluation: "digest" } }),
      /invalid params/,
    );
  }
});
