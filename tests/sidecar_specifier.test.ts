import assert from "node:assert/strict";
import test from "node:test";

import {
  bareSpecifier,
  packageName,
} from "../packages/mokly/src/sidecar/specifier.js";

test("a bare specifier names a package and its package name keeps the scope", () => {
  for (const [specifier, name] of [
    ["react", "react"],
    ["react-dom/server", "react-dom"],
    ["@emotion/react", "@emotion/react"],
    ["@scope/pkg/sub/path.js", "@scope/pkg"],
  ] as const) {
    assert.equal(bareSpecifier(specifier), true, specifier);
    assert.equal(packageName(specifier), name, specifier);
  }
});

test("paths, subpath imports, and URLs are not bare specifiers", () => {
  for (const specifier of [
    "./local.js",
    "../up.js",
    "/absolute/file.js",
    "#internal",
    "node:fs",
    "data:text/javascript,export default 1",
    "C:\\windows\\file.js",
  ])
    assert.equal(bareSpecifier(specifier), false, specifier);
});
