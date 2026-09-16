import assert from "node:assert/strict";
import test from "node:test";

import { parseSettings } from "../src/settings.js";

test("local settings default once and are immutable", () => {
  const settings = parseSettings({});
  assert.deepEqual(settings, {
    appOrigin: "https://app.mokly.ai",
    origin: "http://localhost:4321",
    stagePr: 71,
  });
  assert.ok(Object.isFrozen(settings));
});

test("origins normalize valid HTTP(S) authorities and ports", () => {
  assert.deepEqual(
    parseSettings({
      SITE_APP_ORIGIN: "HTTPS://APP.EXAMPLE.COM:443/",
      SITE_ORIGIN: "https://example.com:8443/",
      SITE_STAGE_PR: "93",
    }),
    {
      appOrigin: "https://app.example.com",
      origin: "https://example.com:8443",
      stagePr: 93,
    },
  );
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(
      parseSettings({ SITE_ORIGIN: `http://${host}:4321` }).stagePr,
      71,
    );
  }
});

for (const name of ["SITE_APP_ORIGIN", "SITE_ORIGIN"]) {
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
        () => parseSettings({ [name]: value, SITE_STAGE_PR: "71" }),
        new RegExp(name),
        value,
      );
    }
  });
}

test("stage requires a decimal positive safe integer", () => {
  for (const value of [
    "",
    "0",
    "-1",
    "1.1",
    "1e2",
    "0x47",
    "+71",
    " 71",
    "71\n",
    "Infinity",
    "NaN",
    "9007199254740992",
  ]) {
    assert.throws(
      () => parseSettings({ SITE_STAGE_PR: value }),
      /SITE_STAGE_PR/,
      value,
    );
  }
  assert.equal(
    parseSettings({ SITE_STAGE_PR: "9007199254740991" }).stagePr,
    Number.MAX_SAFE_INTEGER,
  );
});

test("non-local builds require a stage pull request", () => {
  for (const SITE_ORIGIN of [
    "https://mokly.ai",
    "https://localhost.example.com",
    "https://preview.example.com",
  ]) {
    assert.throws(() => parseSettings({ SITE_ORIGIN }), /SITE_STAGE_PR/);
  }
});
