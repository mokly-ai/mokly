import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import {
  repositoryRoot,
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

const bin = path.join(repositoryRoot, "dist/cli/bin.js");

async function until(
  condition: () => Promise<boolean> | boolean,
  output: () => string,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await condition()) return;
    await setTimeout(50);
  }
  assert.fail(`watch did not advance: ${output()}`);
}

test(
  "build --watch writes accepted compilations, recovers from failures, and exits on SIGTERM",
  { timeout: 30000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const child = spawn(
      process.execPath,
      [bin, "build", "--watch", "--config", fixture.configPath],
      {
        cwd: fixture.root,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (bytes: Buffer) => {
      stdout += bytes.toString();
    });
    child.stderr.on("data", (bytes: Buffer) => {
      stderr += bytes.toString();
    });
    context.after(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    });
    const manifest = path.join(fixture.mockupsDir, "mokly-manifest.json");
    const home = path.join(fixture.mockupsDir, "screens/home.mobile.html");
    const output = () => `${stdout}\n${stderr}`;
    try {
      await until(() => stdout.includes("Generated "), output);
      const first = await fs.readFile(manifest, "utf8");
      const firstDocument = await fs.readFile(home, "utf8");
      await setTimeout(450);
      assert.equal(
        stdout.match(/Generated /g)?.length,
        1,
        "own writes retriggered the watcher",
      );

      await fs.writeFile(fixture.entryPath, "invalid(((");
      await until(() => stderr.length > 0, output);
      assert.equal(await fs.readFile(manifest, "utf8"), first);
      assert.equal(await fs.readFile(home, "utf8"), firstDocument);

      await fs.writeFile(
        fixture.entryPath,
        validEntrySource({ body: "Recovered build" }),
      );
      await until(
        () => (stdout.match(/Generated /g)?.length ?? 0) === 2,
        output,
      );
      assert.notEqual(await fs.readFile(home, "utf8"), firstDocument);
      assert.match(await fs.readFile(home, "utf8"), /Recovered build/);
      await setTimeout(450);
      assert.equal(
        stdout.match(/Generated /g)?.length,
        2,
        "own rewrite triggered another build",
      );

      child.kill("SIGTERM");
      await Promise.race([
        new Promise<void>((resolve) => child.once("exit", () => resolve())),
        setTimeout(5000).then(() =>
          assert.fail(`watch did not stop: ${output()}`),
        ),
      ]);
      assert.equal(child.exitCode, 0, output());
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  },
);
