/** A file beforeEach assertion is part of the test's counted work. */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

beforeEach(() => assert.equal(1, 1));
test("before hook assertion", () => {});
