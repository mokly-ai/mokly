/** Guard failures for empty tests, subtests, and describe/it suites. */
import assert from "node:assert/strict";
import { describe, it, test } from "node:test";

test("empty", () => {});
test("one assertion", () => assert.equal(1, 1));
test("parent with assertion in child", async (context) => {
  await context.test("child assertion", () => assert.equal(1, 1));
});
test("parent with empty child", async (context) => {
  await context.test("empty child", () => {});
});
describe("suite", () => {
  it("assertion", () => assert.equal(1, 1));
  it("empty it", () => {});
});
