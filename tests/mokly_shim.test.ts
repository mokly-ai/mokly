import assert from "node:assert/strict";
import test from "node:test";

import { platformPackage } from "../packages/mokly/src/platform.mjs";
import type { ShimRuntime } from "../packages/mokly/src/shim.mjs";
import { runShim } from "../packages/mokly/src/shim.mjs";
import { assertNodeVersion } from "../packages/mokly/src/version.mjs";

const VERSION = "fixture-version";

function runtime(overrides: Partial<ShimRuntime> = {}): ShimRuntime {
  return {
    nodeVersion: "24.21.0",
    platform: "linux",
    architecture: "x64",
    glibc: true,
    cliPackage: () => ({ version: VERSION }),
    nativePackage: (name) => {
      assert.equal(name, "@mokly/native-linux-x64-gnu");
      return { version: VERSION, binary: "/native/bin/mokly" };
    },
    execute: async () => 0,
    ...overrides,
  };
}

test("the shim accepts the complete Node engine range", () => {
  for (const version of [
    "22.14.0",
    "22.99.0",
    "23.0.0",
    "24.13.99",
    "24.19.0",
    "24.21.0",
    "25.0.0",
    "26.0.0",
  ]) {
    assertNodeVersion(version);
  }
  for (const version of [
    "20.19.0",
    "22.13.99",
    "24.14.0",
    "24.18.99",
    "invalid",
  ]) {
    assert.throws(() => assertNodeVersion(version), /Install a supported Node/);
  }
});

test("the shim resolves exactly the five supported native packages", () => {
  for (const [platform, architecture, target] of [
    ["linux", "x64", "linux-x64-gnu"],
    ["linux", "arm64", "linux-arm64-gnu"],
    ["darwin", "x64", "darwin-x64"],
    ["darwin", "arm64", "darwin-arm64"],
    ["win32", "x64", "win32-x64-msvc"],
  ] as const) {
    assert.equal(
      platformPackage(platform, architecture, true),
      `@mokly/native-${target}`,
    );
  }
  assert.throws(() => platformPackage("linux", "x64", false), /without glibc/);
  assert.throws(
    () => platformPackage("win32", "arm64", false),
    /no native binary/,
  );
  assert.throws(
    () => platformPackage("freebsd", "x64", false),
    /no native binary/,
  );
});

test("the version gate runs before package lookup or binary execution", async () => {
  await assert.rejects(
    runShim(
      ["--help"],
      runtime({
        nodeVersion: "24.14.1",
        cliPackage: () => assert.fail("package lookup must not run"),
        nativePackage: () => assert.fail("native lookup must not run"),
        execute: () => assert.fail("binary must not run"),
      }),
    ),
    /requires Node.js/,
  );
});

test("missing and mismatched native packages fail without a fallback", async () => {
  for (const nativePackage of [
    () => {
      throw new Error("not installed");
    },
    () => ({ version: "other-version", binary: "/native/bin/mokly" }),
  ]) {
    await assert.rejects(
      runShim(
        [],
        runtime({
          nativePackage,
          execute: () => assert.fail("wrong binary must not run"),
        }),
      ),
      /Reinstall @mokly\/mokly/,
    );
  }
});

test("the shim forwards arguments unchanged and returns the native status", async () => {
  const arguments_ = ["publish", "--token=-TOKEN==", "--config", "a b.json"];
  for (const status of [0, 1]) {
    let calls = 0;
    const result = await runShim(
      arguments_,
      runtime({
        execute: async (binary, actual) => {
          calls += 1;
          assert.equal(binary, "/native/bin/mokly");
          assert.equal(actual, arguments_);
          return status;
        },
      }),
    );
    assert.equal(result, status);
    assert.equal(calls, 1);
  }
});

test("binary startup errors give a safe recovery message", async () => {
  await assert.rejects(
    runShim(
      ["--token=SECRET"],
      runtime({
        execute: async () => {
          throw new Error("SECRET ENOENT");
        },
      }),
    ),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /could not start the binary/);
      assert.doesNotMatch(error.message, /SECRET|ENOENT/);
      return true;
    },
  );
});
