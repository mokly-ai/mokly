import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { PackageReport } from "../scripts/release/archive.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

interface Result {
  code: number;
  stdout: string;
  stderr: string;
  signal: null;
}
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
      execute(file: string, args: string[]): Promise<Result>;
      wait(): Promise<void>;
      write(message: string): void;
    },
  ): Promise<boolean>;
};

test("registry verification installs a foreign native package with its target selectors", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-native-registry-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".context"));
  const report: PackageReport = {
    name: "@mokly/native-darwin-arm64",
    version: "0.15.0",
    filename: "native.tgz",
    integrity: "sha512-fixture",
    shasum: "a".repeat(40),
    files: ["bin/mokly", "LICENSE", "README.md", "package.json"].map(
      (path) => ({ path, size: 1 }),
    ),
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
      execute: async (file, args) => {
        commands.push([file, ...args]);
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
  const install = commands.find((args) => args[1] === "install")!;
  assert.ok(install.includes("--os=darwin"));
  assert.ok(install.includes("--cpu=arm64"));
  assert.ok(install.includes("--ignore-scripts"));
  assert.deepEqual(commands.at(-1), ["npm", "audit", "signatures"]);
});
