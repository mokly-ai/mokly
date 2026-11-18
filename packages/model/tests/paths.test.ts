import assert from "node:assert/strict";
import test from "node:test";

import {
  isEntryPath,
  isPathSegment,
  isWindowsDeviceName,
} from "../src/index.js";

test("paths preserve ASCII case and reject nonportable segments", () => {
  for (const value of [
    "account-home",
    "Button",
    "0-start",
    "_",
    "__proto__",
    "constructor",
  ])
    assert.equal(isPathSegment(value), true, value);
  for (const value of [
    "",
    "bad/id",
    ".",
    "..",
    "has space",
    "é",
    "one.two",
    "aux",
    "CON",
    "com1",
    "LPT9",
    42,
    null,
  ])
    assert.equal(isPathSegment(value), false, String(value));
  assert.equal(isWindowsDeviceName("COM1"), true);
  assert.equal(isWindowsDeviceName(42), false);
  assert.equal(isEntryPath("account/Invoice"), true);
  for (const value of [
    "/account",
    "account/",
    "account//invoice",
    "account/../invoice",
    "account\\invoice",
    "account/%20",
    null,
  ])
    assert.equal(isEntryPath(value), false, String(value));
});
