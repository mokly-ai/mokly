import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { withCommandKeepAlive } from "../dist/cli/keep_alive.js";

import { repositoryRoot, packageRoot } from "./helpers/fixture.js";

test("the command keep-alive lets unreferenced awaited work settle", async () => {
  const result = await withCommandKeepAlive(
    () =>
      new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve("settled"), 10);
        timer.unref();
      }),
  );
  assert.equal(result, "settled");
});

test("the command keep-alive prevents unsettled top-level await exit", () => {
  const helper = pathToFileURL(
    path.join(packageRoot, "dist/cli/keep_alive.js"),
  ).href;
  const action = `new Promise((resolve) => {
    const timer = setTimeout(() => resolve("settled"), 10);
    timer.unref();
  })`;
  const without = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", `console.log(await ${action});`],
    { encoding: "utf8" },
  );
  const withKeepAlive = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { withCommandKeepAlive } from ${JSON.stringify(helper)};
console.log(await withCommandKeepAlive(() => ${action}));`,
    ],
    { encoding: "utf8" },
  );

  assert.equal(without.status, 13);
  assert.match(without.stderr, /unsettled top-level await/u);
  assert.deepEqual(
    {
      status: withKeepAlive.status,
      stderr: withKeepAlive.stderr,
      stdout: withKeepAlive.stdout,
    },
    { status: 0, stderr: "", stdout: "settled\n" },
  );
});

test("export and publish hold the command keep-alive around listeners", () => {
  for (const relative of ["src/cli/export.ts", "src/cli/publish.ts"]) {
    const source = fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
    const keepAlive = source.indexOf("withCommandKeepAlive(async () => {");
    assert.notEqual(keepAlive, -1, relative);
    assert.ok(keepAlive < source.indexOf('process.on("SIGINT"'), relative);
  }
});
