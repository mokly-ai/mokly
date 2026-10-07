import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";
import { createTurboFixture, runTurbo } from "./helpers/turbo_fixture.js";

const execute = promisify(execFile);

test("ignored source directories stay outside both TypeScript builds", async (context) => {
  const root = await createTurboFixture(context);
  for (const workspace of ["", "packages/viewer"])
    for (const directory of [
      "target",
      "dist",
      "coverage",
      "test-results",
      "playwright-report",
      ".context",
      ".mokly-write-old",
      ".mokly-review-old",
    ]) {
      const file = path.join(root, workspace, "src", directory, "leftover.ts");
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "export const leftover = true;\n");
    }
  for (const workspace of ["", "packages/viewer"]) {
    const { stdout } = await execute(
      process.execPath,
      [
        path.join(repositoryRoot, "node_modules/typescript/bin/tsc"),
        "--project",
        path.join(root, workspace, "tsconfig.build.json"),
        "--listFilesOnly",
      ],
      { cwd: root, maxBuffer: 8_000_000 },
    );
    assert.ok(stdout.includes(path.join(root, workspace, "src/index.ts")));
    assert.ok(!stdout.includes("leftover.ts"), workspace || "root");
  }
});

test("viewer asset copying excludes ignored leftovers", async (context) => {
  const root = await createTurboFixture(context);
  await fs.cp(
    path.join(repositoryRoot, "packages/viewer/dist"),
    path.join(root, "packages/viewer/dist"),
    { recursive: true },
  );
  const assets = path.join(root, "packages/viewer/src/shell/assets");
  for (const relative of [
    "target/leftover.txt",
    ".mokly-write-old/leftover.txt",
    ".context/leftover.txt",
    "archive.tgz",
  ]) {
    await fs.mkdir(path.dirname(path.join(assets, relative)), {
      recursive: true,
    });
    await fs.writeFile(path.join(assets, relative), "ignored\n");
  }
  const authored = "authored-cache-proof.txt";
  await fs.writeFile(path.join(assets, authored), "authored asset\n");
  await execute(
    process.execPath,
    [path.join(root, "packages/viewer/scripts/build.mjs")],
    { cwd: root, maxBuffer: 8_000_000 },
  );
  const output = path.join(root, "packages/viewer/dist/assets");
  assert.equal(
    await fs.readFile(path.join(output, authored), "utf8"),
    "authored asset\n",
  );
  for (const relative of [
    "target/leftover.txt",
    ".mokly-write-old/leftover.txt",
    ".context/leftover.txt",
    "archive.tgz",
  ])
    await assert.rejects(fs.access(path.join(output, relative)), {
      code: "ENOENT",
    });
});

test("example builds replace disposable output and reject linked output roots", async (context) => {
  const root = await createTurboFixture(context, true);
  await runTurbo(root, ["run", "build:package"]);
  const generated = path.join(root, "examples/basic/mokly-generated");
  const css = path.join(root, "examples/basic/styles.css");
  const authored = await fs.readFile(css);
  await fs.mkdir(generated, { recursive: true });
  const stale = path.join(generated, "unowned-cache-proof.html");
  await fs.writeFile(stale, "stale output");
  const build = () =>
    execute(
      process.execPath,
      [
        path.join(repositoryRoot, "dist/cli/bin.js"),
        "build",
        "--config",
        "examples/basic/mokly.config.ts",
      ],
      { cwd: root, maxBuffer: 8_000_000 },
    );
  await build();
  await assert.rejects(fs.access(stale), { code: "ENOENT" });
  assert.deepEqual(await fs.readFile(css), authored);
  const external = path.join(root, ".context/external");
  await fs.mkdir(external, { recursive: true });
  const keep = path.join(external, "keep.html");
  await fs.writeFile(keep, "authored HTML");
  await fs.rm(generated, { recursive: true });
  await fs.symlink(external, generated, "junction");
  await assert.rejects(build());
  assert.equal(await fs.readFile(keep, "utf8"), "authored HTML");
});
