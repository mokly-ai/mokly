import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInstallationId } from "../../navigation/installation-id";

test("an installation id is a positive base-10 integer a number holds", () => {
  assert.equal(parseInstallationId("1"), 1);
  assert.equal(parseInstallationId("42"), 42);
  assert.equal(parseInstallationId("9007199254740991"), 9007199254740991);
  for (const value of [
    undefined,
    "",
    "0",
    "042",
    "-1",
    "1.5",
    "1e3",
    " 42",
    "42 ",
    "0x2a",
    "abc",
    "9007199254740992",
  ]) {
    assert.equal(parseInstallationId(value), undefined, String(value));
  }
});
