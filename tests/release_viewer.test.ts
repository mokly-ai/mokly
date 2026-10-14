import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";

const execute = promisify(execFile);

test("a viewer tarball installs without a workspace link or CLI package", async (t) => {
  const fixture = await bootstrapFixture(t);
  await fs.mkdir(fixture.destination);
  const { stdout } = await execute(
    "npm",
    ["pack", "--json", "--pack-destination", fixture.destination],
    { cwd: path.join(fixture.root, "packages/viewer") },
  );
  const filename = JSON.parse(stdout)[0].filename as string;
  const consumer = path.join(fixture.destination, "consumer");
  await fs.mkdir(consumer);
  await fs.writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      dependencies: { "@mokly/viewer": `file:../${filename}` },
    }),
  );
  await execute(
    "npm",
    ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: consumer },
  );
  const installed = path.join(consumer, "node_modules/@mokly/viewer");
  assert.equal((await fs.lstat(installed)).isSymbolicLink(), false);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(installed, "package.json"), "utf8"))
      .version,
    "0.1.0",
  );
  await assert.rejects(
    fs.stat(path.join(consumer, "node_modules/@mokly/mokly")),
    { code: "ENOENT" },
  );
});
