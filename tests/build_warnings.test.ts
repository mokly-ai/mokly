import assert from "node:assert/strict";
import test from "node:test";

import {
  enforceStrictBuildWarnings,
  normalizeBuildDiagnostics,
  type BuildDiagnostic,
} from "../dist/build/build_warnings.js";
import { MoklyError } from "../dist/errors.js";

const ancestor: BuildDiagnostic = {
  code: "link-control-ancestor",
  route: "screens/home.desktop.html",
  message: "MockLink child control is inside <button>",
};

test("build diagnostics validate, de-duplicate, and sort independently of input order", () => {
  const diagnostics = normalizeBuildDiagnostics([
    {
      code: "link-control-descendant",
      route: "screens/home.mobile.html",
      message: 'MockLink child control contains <span tabindex="0">',
    },
    { ...ancestor, code: "link-control-descendant" },
    ancestor,
    {
      code: "link-control-ancestor",
      route: "screens/about.desktop.html",
      message: "MockLink child control is inside <label>",
    },
    ancestor,
  ]);

  assert.deepEqual(diagnostics, [
    {
      code: "link-control-ancestor",
      route: "screens/about.desktop.html",
      message: "MockLink child control is inside <label>",
    },
    ancestor,
    { ...ancestor, code: "link-control-descendant" },
    {
      code: "link-control-descendant",
      route: "screens/home.mobile.html",
      message: 'MockLink child control contains <span tabindex="0">',
    },
  ]);
});

test("build diagnostics reject invalid codes, routes, and messages", () => {
  for (const diagnostic of [
    { ...ancestor, code: "Link_Control" },
    { ...ancestor, code: "unknown-warning" },
    { ...ancestor, route: "/screens/home.desktop.html" },
    { ...ancestor, route: "screens\\home.desktop.html" },
    { ...ancestor, route: "../home.desktop.html" },
    { ...ancestor, message: "" },
    { ...ancestor, message: "   " },
    { ...ancestor, message: "first line\nsecond line" },
  ]) {
    assert.throws(
      () => normalizeBuildDiagnostics([diagnostic as BuildDiagnostic]),
      (error: unknown) =>
        error instanceof MoklyError && error.code === "build-invalid",
    );
  }
});

test("build diagnostics reject terminal control characters", () => {
  for (const diagnostic of [
    { ...ancestor, route: "screens/home\u001b[2J.desktop.html" },
    { ...ancestor, message: "warning\u001b[2J" },
    { ...ancestor, message: "warning\u009b2J" },
  ]) {
    assert.throws(
      () => normalizeBuildDiagnostics([diagnostic]),
      (error: unknown) =>
        error instanceof MoklyError && error.code === "build-invalid",
    );
  }
});

test("strict build warnings use singular and plural build-invalid messages", () => {
  enforceStrictBuildWarnings([], true);
  enforceStrictBuildWarnings([ancestor], false);
  for (const [diagnostics, message] of [
    [[ancestor], "1 build warning with --strict"],
    [
      [ancestor, { ...ancestor, route: "screens/other.html" }],
      "2 build warnings with --strict",
    ],
  ] as const) {
    assert.throws(
      () => enforceStrictBuildWarnings(diagnostics, true),
      (error: unknown) =>
        error instanceof MoklyError &&
        error.code === "build-invalid" &&
        error.message === `[mokly/build-invalid] ${message}`,
    );
  }
});
