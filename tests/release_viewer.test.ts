import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";

const execute = promisify(execFile);
test("release fixtures install viewer and CLI tarballs without registry links", async (t) => {
  const fixture = await bootstrapFixture(t);
  const pack = async (cwd: string) => {
    const { stdout } = await execute(
      "npm",
      ["pack", "--json", "--pack-destination", fixture.destination],
      { cwd },
    );
    return JSON.parse(stdout)[0].filename as string;
  };
  await fs.mkdir(fixture.destination);
  const viewer = await pack(path.join(fixture.root, "packages/viewer"));
  const cli = await pack(fixture.root);
  const consumer = path.join(fixture.destination, "consumer");
  await fs.mkdir(consumer);
  await fs.writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      dependencies: {
        "@mokly/viewer": `file:../${viewer}`,
        "@mokly/mokly": `file:../${cli}`,
      },
    }),
  );
  await execute(
    "npm",
    ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: consumer },
  );
  const installed = JSON.parse(
    await fs.readFile(
      path.join(consumer, "node_modules/@mokly/mokly/package.json"),
      "utf8",
    ),
  );
  assert.equal(installed.dependencies["@mokly/viewer"], "0.1.0");
  assert.equal(
    (
      await fs.lstat(path.join(consumer, "node_modules/@mokly/viewer"))
    ).isSymbolicLink(),
    false,
  );
  const viewerPackage = JSON.parse(
    await fs.readFile(
      path.join(consumer, "node_modules/@mokly/viewer/package.json"),
      "utf8",
    ),
  );
  assert.equal(viewerPackage.version, "0.1.0");
});
