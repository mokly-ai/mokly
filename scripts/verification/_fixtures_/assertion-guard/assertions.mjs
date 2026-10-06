/** All assertion import forms and test-context assertions must count. */
import legacy from "assert";
import bareStrict from "assert/strict";
import nodeLegacy from "node:assert";
import strict, { equal } from "node:assert/strict";
import test from "node:test";

test("strict method", () => strict.equal(1, 1));
test("bare strict method", () => bareStrict.equal(1, 1));
test("bare legacy stays loose", () => legacy.equal(1, "1"));
test("node legacy stays loose", () => nodeLegacy.equal(1, "1"));
test("legacy strict property", () => nodeLegacy.strict.equal(1, 1));
test("named export", () => equal(1, 1));
test("direct assertion", () => strict(true));
test("context assertion", (context) => context.assert.equal(1, 1));
test("awaited rejects", async () => {
  await strict.rejects(Promise.reject(new Error("expected")), /expected/);
});
test("match", () => strict.match("mokly", /mokly/));
test("doesNotMatch", () => strict.doesNotMatch("mokly", /other/));
