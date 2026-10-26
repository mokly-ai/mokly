import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import type { PackageReport } from "../scripts/release/archive.mjs";
import { nativeTarget } from "../scripts/release/targets.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

interface Result {
  code: number;
  stdout: string;
  stderr: string;
  signal: null | string;
}
type Execute = (
  file: string,
  args: string[],
  options?: { cwd?: string },
) => Promise<Result>;
const { verifyRegistry } = (await import(
  pathToFileURL(
    path.join(repositoryRoot, "scripts/release/registry_verifier.mjs"),
  ).href
)) as {
  verifyRegistry(
    options: {
      localReport: PackageReport;
      repositoryRoot: string;
      mode: string;
      distTag: string;
    },
    dependencies: {
      execute: Execute;
      wait(): Promise<void>;
      write(message: string): void;
    },
  ): Promise<boolean>;
};
const { runCommandResult } = (await import(
  pathToFileURL(path.join(repositoryRoot, "scripts/release/command.mjs")).href
)) as { runCommandResult: Execute };

async function verifyNative(
  t: TestContext,
  name: string,
  install?: Execute,
): Promise<string[][]> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-native-registry-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".context"));
  const report: PackageReport = {
    name,
    version: "0.15.0",
    filename: "native.tgz",
    integrity: "sha512-fixture",
    shasum: "a".repeat(40),
    files: [
      `bin/${nativeTarget(name).executable}`,
      "LICENSE",
      "README.md",
      "package.json",
    ].map((path) => ({ path, size: 1 })),
  };
  const commands: string[][] = [];
  await verifyRegistry(
    {
      localReport: report,
      repositoryRoot: root,
      mode: "verify",
      distTag: "latest",
    },
    {
      execute: async (file, args, options) => {
        commands.push([file, ...args]);
        if (install && args[0] === "install") {
          return await install(file, args, options);
        }
        const value =
          file === "git"
            ? "b".repeat(40)
            : args[0] === "pack"
              ? JSON.stringify([report])
              : args[0] === "view"
                ? JSON.stringify(
                    args[2] === "dist-tags"
                      ? { latest: report.version }
                      : { gitHead: "b".repeat(40) },
                  )
                : "";
        return { code: 0, stdout: value, stderr: "", signal: null };
      },
      wait: async () => assert.fail("matching registry bytes need no retry"),
      write: () => undefined,
    },
  );
  return commands;
}

test("registry verification installs a foreign native package with its target selectors", async (t) => {
  for (const name of [
    "@mokly/native-darwin-arm64",
    "@mokly/native-linux-arm64-gnu",
  ]) {
    const target = nativeTarget(name);
    const commands = await verifyNative(t, name);
    const install = commands.find((args) => args[1] === "install")!;
    assert.ok(install.includes("--save-optional"));
    assert.ok(install.includes(`--os=${target.os}`));
    assert.ok(install.includes(`--cpu=${target.cpu}`));
    if (target.libc) assert.ok(install.includes(`--libc=${target.libc}`));
    else assert.ok(!install.some((arg) => arg.startsWith("--libc=")));
    assert.ok(install.includes("--ignore-scripts"));
    assert.deepEqual(commands.at(-1), ["npm", "audit", "signatures"]);
  }
});

test("npm installs a native package of another platform with the verification arguments", async (t) => {
  const target = nativeTarget(
    process.platform === "win32" ? "darwin-arm64" : "win32-x64-msvc",
  );
  const fixture = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-native-fixture-"),
  );
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const source = path.join(fixture, "package");
  await fs.mkdir(source);
  await fs.writeFile(
    path.join(source, "package.json"),
    `${JSON.stringify({ name: target.name, version: "0.15.0", os: [target.os], cpu: [target.cpu] })}\n`,
  );
  const packed = await runCommandResult(
    "npm",
    ["pack", "--json", "--pack-destination", fixture],
    { cwd: source },
  );
  assert.equal(packed.code, 0, packed.stderr);
  const [{ filename }] = JSON.parse(packed.stdout) as { filename: string }[];
  let installed = false;
  await verifyNative(t, target.name, async (file, args, options) => {
    const result = await runCommandResult(
      file,
      [...args.slice(0, -1), "--offline", path.join(fixture, filename)],
      options,
    );
    assert.equal(result.code, 0, result.stderr);
    await fs.access(
      path.join(options!.cwd!, "node_modules", target.name, "package.json"),
    );
    installed = true;
    return result;
  });
  assert.ok(installed);
});
