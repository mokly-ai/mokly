/** Skip and todo exemptions must leave later test frames usable. */
import assert from "node:assert/strict";
import test from "node:test";

test("skip option", { skip: true }, () => {});
test("after skip option", () => assert.equal(1, 1));
test("runtime skip", (context) => context.skip());
test("after runtime skip", () => assert.equal(1, 1));
test("todo option", { todo: true }, () => {});
test("after todo option", () => assert.equal(1, 1));
test("runtime todo", (context) => context.todo());
test("after runtime todo", () => assert.equal(1, 1));
