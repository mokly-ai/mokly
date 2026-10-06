import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";
import { createTurboFixture } from "./helpers/turbo_fixture.js";

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

test("example cleanup clears only output patterns and does not follow linked directories", async (context) => {
  const root = await createTurboFixture(context);
  const generated = path.join(root, "examples/basic/generated");
  const css = await fs.readFile(path.join(generated, "styles.css"));
  const outputs = [
    "nested/unowned.html",
    "mokly-manifest.json",
    "example/workspace.svg",
    "mokly-generated/styles/stale.css",
  ];
  for (const relative of outputs) {
    await fs.mkdir(path.dirname(path.join(generated, relative)), {
      recursive: true,
    });
    await fs.writeFile(path.join(generated, relative), "generated output\n");
  }
  const external = path.join(root, ".context/external");
  await fs.mkdir(external, { recursive: true });
  await fs.writeFile(path.join(external, "keep.html"), "authored HTML\n");
  await fs.symlink(external, path.join(generated, "linked"), "junction");
  const clean = () =>
    execute(process.execPath, [
      path.join(root, "scripts/clean.mjs"),
      "--example",
    ]);
  await clean();
  for (const relative of outputs)
    await assert.rejects(fs.access(path.join(generated, relative)), {
      code: "ENOENT",
    });
  assert.deepEqual(await fs.readFile(path.join(generated, "styles.css")), css);
  assert.equal(
    await fs.readFile(path.join(external, "keep.html"), "utf8"),
    "authored HTML\n",
  );
  await fs.rename(generated, path.join(root, ".context/held-generated"));
  await fs.symlink(external, generated, "junction");
  await clean();
  assert.equal(
    await fs.readFile(path.join(external, "keep.html"), "utf8"),
    "authored HTML\n",
  );
  await fs.mkdir(path.join(external, "generated"));
  await fs.writeFile(
    path.join(external, "generated/keep.html"),
    "authored HTML\n",
  );
  await fs.rename(
    path.join(root, "examples/basic"),
    path.join(root, ".context/held-basic"),
  );
  await fs.symlink(external, path.join(root, "examples/basic"), "junction");
  await clean();
  assert.equal(
    await fs.readFile(path.join(external, "generated/keep.html"), "utf8"),
    "authored HTML\n",
  );
});
