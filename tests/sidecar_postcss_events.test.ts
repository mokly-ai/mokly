import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { observePostcssProcess } from "../packages/mokly/dist/sidecar/postcss.js";

for (const events of [
  ["error"],
  ["exit"],
  ["error", "exit"],
  ["exit", "error"],
]) {
  test(`PostCSS counts one process lifetime for ${events.join(" then ")}`, () => {
    const child = new EventEmitter();
    const operations: string[] = [];
    let closed = 0;
    observePostcssProcess(
      child,
      () => closed++,
      (event) => operations.push(event),
    );
    assert.deepEqual(operations, ["postcss-start"]);
    for (const event of events) child.emit(event, new Error("fixture"));
    assert.deepEqual(operations, ["postcss-start", "postcss-stop"]);
    assert.equal(closed, 1);
  });
}
