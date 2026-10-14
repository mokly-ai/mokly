/** Package installation and discovery integration checks. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { platformPackage } from "../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../packages/mokly/src/runtime.mjs";
import { discoverUnitFiles } from "../scripts/verification/evidence.mjs";

interface Manifest {
  name: string;
  version: string;
  os?: string[];
  cpu?: string[];
  libc?: string[];
  workspaces?: string[];
  optionalDependencies: Record<string, string>;
}

const root = path.resolve(import.meta.dirname, "..");
async function manifest(file: string): Promise<Manifest> {
  return JSON.parse(
    await fs.readFile(path.join(root, file), "utf8"),
  ) as Manifest;
}

test("native package manifests match the root links and the CLI version pins", async () => {
  const workspace = await manifest("package.json");
  const cli = await manifest("packages/mokly/package.json");
  assert.deepEqual(
    new Set(workspace.workspaces),
    new Set(["packages/viewer", "packages/mokly"]),
  );
  for (const [target, os, cpu, libc] of [
    ["linux-x64-gnu", "linux", "x64", "glibc"],
    ["linux-arm64-gnu", "linux", "arm64", "glibc"],
    ["darwin-x64", "darwin", "x64", undefined],
    ["darwin-arm64", "darwin", "arm64", undefined],
    ["win32-x64-msvc", "win32", "x64", undefined],
  ] as const) {
    const native = await manifest(`packages/native-${target}/package.json`);
    assert.equal(native.name, `@mokly/native-${target}`);
    assert.equal(native.version, cli.version);
    assert.deepEqual(native.os, [os]);
    assert.deepEqual(native.cpu, [cpu]);
    assert.deepEqual(native.libc, libc ? [libc] : undefined);
    assert.equal(cli.optionalDependencies[native.name], cli.version);
    assert.equal(
      workspace.optionalDependencies[native.name],
      `file:packages/native-${target}`,
    );
  }
});

test("the discovered Node inventory includes all shim regression tests", async () => {
  const files = await discoverUnitFiles(root);
  for (const file of [
    "tests/mokly_shim.test.ts",
    "tests/mokly_shim_signals.test.ts",
    "tests/mokly_native_packages.test.ts",
  ])
    assert.ok(files.includes(file));
});

test("the runtime resolves the installed host package without a fallback", async () => {
  const runtime = systemRuntime();
  const cli = await manifest("packages/mokly/package.json");
  assert.equal(runtime.cliPackage().version, cli.version);
  const supported =
    [
      ["linux", "x64"],
      ["linux", "arm64"],
      ["darwin", "x64"],
      ["darwin", "arm64"],
      ["win32", "x64"],
    ].some(
      ([os, cpu]) => os === runtime.platform && cpu === runtime.architecture,
    ) &&
    (runtime.platform !== "linux" || runtime.glibc);
  if (!supported) {
    assert.throws(
      () =>
        platformPackage(runtime.platform, runtime.architecture, runtime.glibc),
      /no native binary/,
    );
    return;
  }
  const native = runtime.nativePackage(
    platformPackage(runtime.platform, runtime.architecture, runtime.glibc),
  );
  assert.equal(native.version, cli.version);
  assert.ok(path.isAbsolute(native.binary));
  assert.equal(
    path.basename(native.binary),
    runtime.platform === "win32" ? "mokly.exe" : "mokly",
  );
});
