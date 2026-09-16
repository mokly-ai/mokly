import assert from "node:assert/strict";
import test from "node:test";

import { resolveConfig } from "../dist/config/validate.js";
import { MoklyError } from "../dist/errors.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const defaults = [
  "**/README",
  "**/README.*",
  "**/tsconfig.json",
  "**/tsconfig.*.json",
];

for (const extra of [undefined, [], ["internal/**", "internal/**"]]) {
  test(`publicExclude prepends defaults without mutating ${JSON.stringify(extra)}`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const input =
      extra === undefined ? {} : { publicExclude: Object.freeze(extra) };
    const config = resolveConfig(
      { entriesDir: "entries", mockupsDir: "mockups", ...input },
      fixture.configPath,
    );
    assert.deepEqual(config.publicExclude, [...defaults, ...(extra ?? [])]);
    assert.notEqual(config.publicExclude, extra);
  });
}

for (const item of [
  "/secret/**",
  "../secret",
  "a/../b",
  "a/./b",
  "a//b",
  "C:/secret",
  "\\\\server\\share",
  "a\\b",
  "!safe/**",
  "#comment",
  "   ",
  "",
  "a:b",
  "a\u0085b",
  "a\u0000b",
  "a\nb",
  "{safe,..}/file",
  "{safe,/root}/file",
  "{safe,!bad}",
  "{safe,#bad}",
  "{safe,./bad}",
  42,
  null,
]) {
  test(`publicExclude rejects unsafe item ${JSON.stringify(item)}`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    assert.throws(
      () =>
        resolveConfig(
          {
            entriesDir: "entries",
            mockupsDir: "mockups",
            publicExclude: [item],
          },
          fixture.configPath,
        ),
      (error: unknown) =>
        error instanceof MoklyError &&
        error.code === "config-invalid" &&
        error.message.includes("publicExclude") &&
        error.message.includes(JSON.stringify(item)),
    );
  });
}

for (const value of ["internal/**", null, {}]) {
  test(`publicExclude rejects non-array ${JSON.stringify(value)}`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    assert.throws(
      () =>
        resolveConfig(
          {
            entriesDir: "entries",
            mockupsDir: "mockups",
            publicExclude: value,
          },
          fixture.configPath,
        ),
      /publicExclude/,
    );
  });
}

for (const invalid of [
  1n,
  {
    get self(): unknown {
      return this;
    },
  },
]) {
  test(`publicExclude retains config-invalid for a non-JSON ${typeof invalid} item`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    assert.throws(
      () =>
        resolveConfig(
          {
            entriesDir: "entries",
            mockupsDir: "mockups",
            publicExclude: [invalid],
          },
          fixture.configPath,
        ),
      (error: unknown) =>
        error instanceof MoklyError &&
        error.code === "config-invalid" &&
        error.message.includes("publicExclude"),
    );
  });
}
