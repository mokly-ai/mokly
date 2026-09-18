import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { normalizeComponentSource } from "../dist/build/component_source.js";
import { validateComponentSource } from "../packages/viewer/dist/components/source.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("bundler sources resolve from its working directory and serialize repository-relative POSIX paths", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const source = {
    fileName: "../entries/./fixture.mockup.tsx",
    lineNumber: 3,
    columnNumber: 7,
  };
  const expected = { path: "entries/fixture.mockup.tsx", line: 3, column: 7 };
  assert.deepEqual(
    normalizeComponentSource(source, fixture.mockupsDir, fixture.root),
    expected,
  );
  assert.deepEqual(
    normalizeComponentSource(
      { ...source, fileName: fixture.entryPath },
      fixture.root,
      fixture.root,
    ),
    expected,
  );
  assert.equal(
    normalizeComponentSource(undefined, fixture.root, fixture.root),
    undefined,
  );
});

test("bundler source capture rejects escaping, backslash, URL and incomplete locations", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  for (const fileName of [
    "",
    "../outside.tsx",
    path.join(fixture.root + "-other", "file.tsx"),
    "entries\\file.tsx",
    "C:/file.tsx",
    "file:///secret.tsx",
    "entries/\0file.tsx",
  ])
    assert.throws(
      () =>
        normalizeComponentSource(
          { fileName, lineNumber: 1, columnNumber: 1 },
          fixture.root,
          fixture.root,
        ),
      /source/,
      fileName,
    );
  for (const source of [
    {},
    { fileName: "entries/fixture.mockup.tsx" },
    { fileName: "entries/fixture.mockup.tsx", lineNumber: 0, columnNumber: 1 },
  ])
    assert.throws(
      () => normalizeComponentSource(source, fixture.root, fixture.root),
      /source/,
    );
  await fs.symlink(
    path.dirname(fixture.root),
    path.join(fixture.root, "escape"),
  );
  assert.throws(
    () =>
      normalizeComponentSource(
        { fileName: "escape/outside.tsx", lineNumber: 1, columnNumber: 1 },
        fixture.root,
        fixture.root,
      ),
    /source/,
  );
});

test("serialized source locations reject noncanonical paths and invalid coordinates", () => {
  const valid = { path: "entries/My screen.tsx", line: 1, column: 1 };
  assert.doesNotThrow(() => validateComponentSource(valid, "$source"));
  for (const file of [
    "",
    "/absolute.tsx",
    "//host/share.tsx",
    "C:/file.tsx",
    "C:file.tsx",
    "https://host/file",
    "../escape.tsx",
    "a/../file.tsx",
    "./file.tsx",
    "a//file.tsx",
    "a/./file.tsx",
    "a/file.tsx/",
    "a\\file.tsx",
    "a/\0file.tsx",
  ])
    assert.throws(
      () => validateComponentSource({ ...valid, path: file }, "$source"),
      /source/,
      file,
    );
  for (const coordinate of [
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    NaN,
    Infinity,
    "1",
    null,
    undefined,
  ])
    for (const field of ["line", "column"])
      assert.throws(
        () =>
          validateComponentSource({ ...valid, [field]: coordinate }, "$source"),
        /source/,
        `${field}=${coordinate}`,
      );
  for (const value of [
    null,
    [],
    "file.tsx",
    {},
    { ...valid, unexpected: true },
  ])
    assert.throws(() => validateComponentSource(value, "$source"), /source/);
});
