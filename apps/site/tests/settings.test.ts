import assert from "node:assert/strict";
import test from "node:test";

import { parseSettings } from "../src/settings.js";

test("local settings default once and are immutable", () => {
  const settings = parseSettings({});
  assert.deepEqual(settings, {
    origin: "http://localhost:4321",
    stagePublication: "sydney-v1",
  });
  assert.ok(Object.isFrozen(settings));
});

test("the site origin normalizes valid HTTP(S) authorities and ports", () => {
  assert.deepEqual(
    parseSettings({
      SITE_ORIGIN: "https://example.com:8443/",
      SITE_STAGE_PR: "calummoore/sydney-v1",
    }),
    {
      origin: "https://example.com:8443",
      stagePublication: "calummoore/sydney-v1",
    },
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
        () => parseSettings({ [name]: value, SITE_STAGE_PR: "71" }),
        new RegExp(name),
        value,
      );
    }
  });
}

test("stage requires a safe branch or publication label", () => {
  for (const value of [
    "",
    "/main",
    "main/",
    "main//preview",
    "../main",
    "main/../preview",
    "main preview",
    "main\npreview",
    "x".repeat(101),
  ]) {
    assert.throws(
      () => parseSettings({ SITE_STAGE_PR: value }),
      /SITE_STAGE_PR/,
      value,
    );
  }
  for (const value of ["sydney-v1", "calummoore/sydney-v1", "release_1.0"]) {
    assert.equal(
      parseSettings({ SITE_STAGE_PR: value }).stagePublication,
      value,
    );
  }
});
