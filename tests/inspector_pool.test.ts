import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { inspectorPool } from "../packages/viewer/scripts/inspector-pool.mjs";

function execute(source: string): string {
  const context = { result: "", window: {}, document: {} };
  vm.runInNewContext(source, context);
  return context.result;
}

for (const [name, source] of [
  [
    "receivers, optional chains and shorthand fields",
    `
    const requestId = 9;
    const data = { requestId, read() { return this.requestId; } };
    const absent = null;
    const values = [];
    for (let n = 0; n < 4; n++) values.push(data.requestId, data?.requestId, data.read(), absent?.requestId);
    const { requestId: copied } = data;
    globalThis.result = JSON.stringify({ values, requestId, copied });
  `,
  ],
  [
    "quoted fields, property names and native shorthand",
    `
    const data = { "requestId": 5, "nonce": "nonce" };
    const { requestId } = data;
    const values = [data.requestId, data.requestId, data.requestId, data.requestId, requestId];
    const native = { Object, JSON, Array };
    globalThis.result = JSON.stringify({ values, names: Object.keys(native), nonce: data.nonce });
  `,
  ],
  [
    "strict directives and property accessors",
    `
    "use strict";
    const data = { get requestId() { return 3; } };
    function strict() { return this === undefined; }
    function nested() { "use strict"; return strict(); }
    function another() { "use strict"; return nested(); }
    const values = [data.requestId, data.requestId, data.requestId, data.requestId];
    globalThis.result = JSON.stringify({ strict: another(), values });
  `,
  ],
  [
    "object rest and array bindings",
    `
    const data = { requestId: 1, nonce: 2 };
    const { ...requestId } = data;
    const [nonce] = [3];
    globalThis.result = JSON.stringify([data.requestId, data.requestId, data.requestId, data.requestId, requestId, nonce]);
  `,
  ],
  [
    "unpooled optional chains and native-named properties",
    `
    const absent = null;
    const item = { Math() { return 4; }, get Array() { return 5; } };
    globalThis.result = JSON.stringify([absent?.x, item.Math(), item.Array]);
  `,
  ],
  [
    "pooled delimiter characters",
    `globalThis.result = JSON.stringify([
      "a|value", "a|value", "a|value", "a|value", "a|value", "a|value", "a|value",
      "a\\0value", "a\\0value", "a\\0value", "a\\0value", "a\\0value", "a\\0value", "a\\0value",
    ]);`,
  ],
] as const)
  test(`inspector pooling preserves ${name}`, () => {
    assert.equal(execute(inspectorPool(source)), execute(source));
  });

test("inspector pooling rejects a collision with its generated identifiers", () => {
  assert.throws(
    () => inspectorPool("const __inspectorPoolNative0 = 1;"),
    /Reserved inspector/,
  );
});

for (const source of [
  "function run(Math) { return Math.min(1, 2); }",
  "const Array = { isArray() {} }; Array.isArray();",
  "const { value: JSON } = input;",
  "const [Object] = input;",
  "try {} catch (window) {}",
])
  test(`inspector pooling rejects native shadowing: ${source}`, () => {
    assert.throws(() => inspectorPool(source), /shadow/);
  });
