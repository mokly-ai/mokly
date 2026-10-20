import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { platformPackage } from "../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../packages/mokly/src/runtime.mjs";
import {
  acceptanceCommand,
  acceptanceForFixture,
  buildAcceptanceBinary,
  verifyAcceptanceBinary,
} from "../scripts/large/acceptance_build.js";
import type { AcceptanceBuild } from "../scripts/large/acceptance_build.js";
import { nativeTarget } from "../scripts/release/targets.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

test("acceptance builds select the release target and verify the packaged bytes", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/acceptance-build-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = nativeTarget(
    platformPackage(process.platform, process.arch, systemRuntime().glibc),
  );
  const plan = acceptanceCommand(root, target);
  const calls: string[][] = [];
  const built = await buildAcceptanceBinary(
    root,
    async (file, args, options) => {
      calls.push([file, ...args]);
      assert.equal(options.env.CARGO_BUILD_JOBS, "4");
      assert.equal(options.env.CARGO_PROFILE_DEV_DEBUG, "0");
      assert.equal(options.env.CARGO_INCREMENTAL, "0");
      if (file === "cargo") {
        assert.deepEqual(args, [
          "build",
          "--locked",
          "--release",
          "--package",
          "mokly-cli",
          "--bin",
          "mokly",
          "--target",
          target.triple,
          "--target-dir",
          path.join(root, "target/release-native"),
        ]);
        await fs.mkdir(path.dirname(plan.binary), { recursive: true });
        await fs.writeFile(plan.binary, "optimized native fixture");
        return { stdout: "", stderr: "release built\n" };
      }
      assert.equal(file, "git");
      return {
        stdout: args[0] === "status" ? "" : "recorded-source\n",
        stderr: "",
      };
    },
  );
  assert.equal(calls.filter(([file]) => file === "cargo").length, 1);
  assert.equal(built.profile, "release");
  assert.equal(built.target, target.target);
  assert.equal(built.dirty, false);
  assert.equal(built.sourceCommit, "recorded-source");
  assert.equal(built.sourceTree, "recorded-source");
  assert.match(built.binarySha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(
        path.join(root, ".context/large-acceptance/build.json"),
        "utf8",
      ),
    ),
    built,
  );
  const native = path.join(root, target.directory);
  await fs.writeFile(
    path.join(native, "package.json"),
    JSON.stringify({ name: target.name, version: "0.14.0" }),
  );
  const modules = path.join(root, "node_modules/@mokly");
  await fs.mkdir(path.join(modules, "mokly/bin"), { recursive: true });
  await fs.writeFile(path.join(modules, "mokly/bin/mokly.mjs"), "");
  await fs.symlink(
    native,
    path.join(modules, `native-${target.target}`),
    "junction",
  );
  const fixture = {
    root,
    toolchain: { mode: "install" as const },
    acceptanceBuild: built,
  };
  assert.deepEqual(await acceptanceForFixture(fixture), built);
  await assert.rejects(
    verifyAcceptanceBinary(root, undefined),
    /release binary/,
  );
  await assert.rejects(
    verifyAcceptanceBinary(root, { ...built, target: "another-host" }),
    /release binary/,
  );
  await fs.writeFile(
    path.join(native, "bin", target.executable),
    "development binary",
  );
  await assert.rejects(
    acceptanceForFixture(fixture),
    /differs from its release build/,
  );
});

test("release verification follows the runtime module's native lookup", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/acceptance-lookup-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = nativeTarget(
    platformPackage(process.platform, process.arch, systemRuntime().glibc),
  );
  const modules = path.join(root, "node_modules");
  const packageRoot = path.join(modules, "@mokly/mokly");
  await fs.mkdir(path.join(packageRoot, "bin"), { recursive: true });
  await fs.writeFile(path.join(packageRoot, "bin/mokly.mjs"), "");
  const outer = path.join(modules, target.name);
  const nested = path.join(packageRoot, "dist/node_modules", target.name);
  for (const [directory, bytes] of [
    [outer, "release"],
    [nested, "development"],
  ] as const) {
    await fs.mkdir(path.join(directory, "bin"), { recursive: true });
    await fs.writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ name: target.name, version: "0.14.0" }),
    );
    await fs.writeFile(path.join(directory, "bin", target.executable), bytes);
  }
  const built: AcceptanceBuild = {
    profile: "release",
    target: target.target,
    binarySha256: createHash("sha256").update("release").digest("hex"),
    sourceCommit: "fixture",
    sourceTree: "fixture",
    dirty: false,
  };
  const fixture = {
    root,
    toolchain: { mode: "install" as const },
    acceptanceBuild: built,
  };
  await assert.rejects(
    acceptanceForFixture(fixture),
    /differs from its release build/,
  );
  await fs.writeFile(path.join(nested, "bin", target.executable), "release");
  await fs.writeFile(
    path.join(outer, "bin", target.executable),
    "unused development binary",
  );
  assert.deepEqual(await acceptanceForFixture(fixture), built);
});
