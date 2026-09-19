import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");

test(
  "forced rich Serve reports ready, catalogue, baseline, and Changes in order",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const child = spawn(
      process.execPath,
      [cli, "serve", "--config", fixture.configPath, "--port", "0"],
      {
        cwd: fixture.root,
        env: {
          ...process.env,
          COLUMNS: "100",
          MOKLY_OUTPUT: "rich",
          NO_COLOR: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        await new Promise((resolve) => child.once("exit", resolve));
      }
    });
    await waitFor(
      () => stdout.includes("Changes ready"),
      () => stderr,
    );
    const positions = [
      "http://127.0.0.1:",
      "Catalogue ready",
      "Preparing comparison baseline",
      "Baseline ready",
      "Changes ready",
    ].map((text) => stdout.indexOf(text));
    assert.ok(
      positions.every((position) => position >= 0),
      stdout,
    );
    assert.deepEqual(
      [...positions].sort((left, right) => left - right),
      positions,
    );
    assert.equal(stderr, "");
  },
);

async function waitFor(
  predicate: () => boolean,
  stderr: () => string,
): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Serve lifecycle timed out\n${stderr()}`);
}
