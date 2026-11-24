import assert from "node:assert/strict";
import test from "node:test";

import { parseSettings } from "../src/settings.js";

test("local settings default once and are immutable", () => {
  const settings = parseSettings({});
  assert.deepEqual(settings, { origin: "http://localhost:4321" });
  assert.ok(Object.isFrozen(settings));
});

test("the site origin normalizes valid HTTP(S) authorities and ports", () => {
  assert.deepEqual(
    parseSettings({ SITE_ORIGIN: "https://example.com:8443/" }),
    { origin: "https://example.com:8443" },
  );
});

for (const name of ["SITE_ORIGIN"]) {
  test(`${name} rejects malformed and non-origin values`, () => {
    for (const value of [
      "",
      "example.com",
      "//example.com",
      "https:example.com",
      "ftp://example.com",
      "https://example.com/docs",
      "https://example.com/..",
      "https://example.com?",
      "https://example.com#",
      "https://user:pass@example.com",
      "https://@example.com",
      " https://example.com",
      "https://example.com\n",
      "https://example.com\\",
      "https://example.com:70000",
    ]) {
      assert.throws(
        () => parseSettings({ [name]: value }),
        new RegExp(name),
        value,
      );
    }
  });
}
