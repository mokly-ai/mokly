import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { isInside, resolveAbsolutePath } from "../dist/config/paths.js";

test("containment retains Node semantics across normalized and non-normalized paths", () => {
  const roots = [
    "/repo",
    "/repo/child",
    "/repo.name",
    "/.hidden",
    "/répo",
    "/repo\\name",
    "/repo\0name",
    "/",
    "repo",
    "../repo",
    "",
    "//repo",
    "/repo/./child",
    "/repo/child/..",
    "/repo//child",
    "/repo/child/",
    "C:\\repo",
    "C:\\REPO",
    "D:\\repo",
    "\\\\server\\share\\repo",
  ];
  const candidates = roots.flatMap((root) => [
    root,
    `${root}/child`,
    `${root}/../sibling`,
    `${root}/other/../child`,
    `${root}-other`,
    `${root}//child`,
    `${root}/.`,
    `${root}/..`,
    `${root}/.../file`,
    `${root}\\child`,
  ]);
  for (const candidate of candidates)
    assert.equal(resolveAbsolutePath(candidate), path.resolve(candidate));
  for (const root of roots)
    for (const candidate of candidates) {
      const relative = path.relative(root, candidate);
      const expected =
        relative === "" ||
        (!path.isAbsolute(relative) &&
          relative !== ".." &&
          !relative.startsWith(`..${path.sep}`));
      assert.equal(
        isInside(root, candidate),
        expected,
        JSON.stringify({ root, candidate }),
      );
    }
});

test("containment requires a complete path segment and preserves invalid-argument errors", () => {
  assert.equal(isInside("/repo", "/repo/private"), true);
  assert.equal(isInside("/repo", "/repository/private"), false);
  assert.equal(isInside("/repo", "/repo/../private"), false);
  assert.equal(isInside("/repo", "/repo/.hidden/private"), true);
  assert.equal(isInside("/repo", "/repo/.../private"), true);
  assert.throws(
    () => isInside(undefined as never, undefined as never),
    TypeError,
  );
  assert.throws(() => isInside("/repo", null as never), TypeError);
  assert.throws(() => resolveAbsolutePath(undefined as never), TypeError);
});
