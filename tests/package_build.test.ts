import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { copyPackageDocs } from "../packages/mokly/scripts/copy-docs.mjs";

import { packageRoot, repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("clean install followed by the root build makes the workspace CLI executable available", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-workspace-bin-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "mokly-bin-fixture",
      private: true,
      workspaces: workspace.workspaces,
      scripts: { build: workspace.scripts.build },
    }),
  );
  for (const name of ["viewer", "mokly"]) {
    const directory = path.join(root, "packages", name);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: `@mokly/${name}`,
        version: "0.0.0",
        ...(name === "mokly" ? { bin: { mokly: "./dist/cli/bin.js" } } : {}),
        scripts: { build: "node build.cjs" },
      }),
    );
    const source =
      name === "viewer"
        ? 'require("node:fs").writeFileSync("ready", "viewer built");'
        : `const fs = require("node:fs");
fs.accessSync("../viewer/ready");
fs.mkdirSync("dist/cli", { recursive: true });
fs.writeFileSync("dist/cli/bin.js", '#!/usr/bin/env node\\nconsole.log("workspace CLI ready");\\n');`;
    await fs.writeFile(path.join(directory, "build.cjs"), source);
  }
  await execute(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: root },
  );
  const executable = path.join(root, "node_modules/.bin/mokly");
  await assert.rejects(fs.access(executable), { code: "ENOENT" });
  await execute("npm", ["run", "build"], { cwd: root });
  await fs.access(executable);
  const result = await execute(
    "npm",
    ["exec", "--offline", "--no", "--", "mokly"],
    { cwd: root },
  );
  assert.equal(result.stdout.trim(), "workspace CLI ready");
  assert.equal(
    await fs.realpath(executable),
    path.join(root, "packages/mokly/dist/cli/bin.js"),
  );
});

test("package docs replace old copies so deleted guides and extra files cannot linger", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-docs-copy-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const target = path.join(root, "package");
  await fs.mkdir(path.join(source, "docs/guides"), { recursive: true });
  await fs.mkdir(path.join(source, "docs/protocol"), { recursive: true });
  await fs.writeFile(path.join(source, "docs/guides/deleted.md"), "Old guide");
  await fs.writeFile(
    path.join(source, "docs/guides/current.md"),
    "Current guide",
  );
  await fs.writeFile(
    path.join(source, "docs/protocol/contract.md"),
    "Contract",
  );
  await copyPackageDocs(source, target);
  await fs.writeFile(path.join(target, "docs/extra.md"), "Stale copy");
  await fs.rm(path.join(source, "docs/guides/deleted.md"));
  await fs.writeFile(
    path.join(source, "docs/guides/current.md"),
    "Updated guide",
  );
  await copyPackageDocs(source, target);
  assert.equal(
    await fs.readFile(path.join(target, "docs/guides/current.md"), "utf8"),
    "Updated guide",
  );
  assert.equal(
    await fs.readFile(path.join(target, "docs/protocol/contract.md"), "utf8"),
    "Contract",
  );
  for (const file of ["docs/guides/deleted.md", "docs/extra.md"])
    await assert.rejects(fs.access(path.join(target, file)), {
      code: "ENOENT",
    });
  await assert.rejects(copyPackageDocs(source, source), /workspace package/);
});

test("clean removes both package outputs and copied docs while keeping canonical docs", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-clean-layout-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const directory of [
    "scripts/package",
    "packages/mokly/dist",
    "packages/mokly/docs",
    "packages/viewer/dist",
    "docs/guides",
  ])
    await fs.mkdir(path.join(root, directory), { recursive: true });
  for (const file of ["scripts/clean.mjs", "scripts/package/layout.mjs"])
    await fs.copyFile(path.join(repositoryRoot, file), path.join(root, file));
  await fs.writeFile(
    path.join(root, "docs/guides/source.md"),
    "Canonical source",
  );
  await execute(process.execPath, [path.join(root, "scripts/clean.mjs")]);
  for (const directory of [
    "packages/mokly/dist",
    "packages/mokly/docs",
    "packages/viewer/dist",
  ])
    await assert.rejects(fs.access(path.join(root, directory)), {
      code: "ENOENT",
    });
  assert.equal(
    await fs.readFile(path.join(root, "docs/guides/source.md"), "utf8"),
    "Canonical source",
  );
});

test("CLI package build fails clearly when the viewer declarations are missing", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/mokly-build-guard-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(
    path.join(packageRoot, "scripts"),
    path.join(root, "packages/mokly/scripts"),
    { recursive: true },
  );
  await fs.cp(
    path.join(repositoryRoot, "packages/viewer/scripts"),
    path.join(root, "packages/viewer/scripts"),
    { recursive: true },
  );
  await assert.rejects(
    execute(process.execPath, [
      path.join(root, "packages/mokly/scripts/build.mjs"),
    ]),
    /Build @mokly\/viewer before @mokly\/mokly/,
  );
});
