import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createSelectedHarness,
  runSelected,
} from "./helpers/verification_unit_selected.js";
import { writeHarnessFile } from "./helpers/verification_wrapper.js";

test(
  "real SIGINT with absent reporter output reports the process outcome and removes temporary events",
  {
    skip: process.platform === "win32",
    timeout: 30_000,
  },
  async (context) => {
    const harness = await createSelectedHarness(context);
    const reporter = path.join(
      harness.root,
      "scripts/verification/node-reporter.mjs",
    );
    const source = await fs.readFile(reporter, "utf8");
    assert.ok(source.includes("fs.writeFileSync("));
    await fs.writeFile(
      reporter,
      source.replace("fs.writeFileSync(", "if (false) fs.writeFileSync("),
    );
    await writeHarnessFile(
      harness.root,
      "tests/passing.test.ts",
      'import fs from "node:fs"; import test from "node:test"; setInterval(() => {}, 1000); test("never settles", async () => { fs.writeFileSync("signal.marker.tmp", "ready"); fs.renameSync("signal.marker.tmp", "signal.marker"); await new Promise(() => {}); });',
    );
    let markerReady: () => void;
    const ready = new Promise<void>((resolve) => {
      markerReady = resolve;
    });

    const watcher = watch(harness.root, (_event, name) => {
      if (name === "signal.marker") markerReady();
    });
    context.after(() => watcher.close());
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TMPDIR: harness.temporary,
      TMP: harness.temporary,
      TEMP: harness.temporary,
      TSX_DISABLE_CACHE: "1",
    };
    delete env.NODE_TEST_CONTEXT;
    delete env.MOKLY_VERIFICATION_REPORT;
    const child = spawn(
      process.execPath,
      [
        path.join(harness.root, "scripts/verification/run-unit-dev.mjs"),
        "tests/passing.test.ts",
      ],
      { cwd: harness.root, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    context.after(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGTERM");
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    const completed = new Promise<{
      code: number | null;
      signal: string | null;
    }>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    await Promise.race([
      ready,
      completed.then(() => {
        throw new Error("Runner ended before the fixture marker");
      }),
    ]);
    assert.equal(
      await fs.readFile(path.join(harness.root, "signal.marker"), "utf8"),
      "ready",
    );
    child.kill("SIGINT");
    const outcome = await completed;
    assert.notEqual(outcome.code, 0);
    assert.equal(
      stderr,
      "selected unit test process exited with signal SIGINT; the test reporter did not finish\n",
    );
    assert.doesNotMatch(stderr, / {4}at |Node\.js v/u);
    assert.doesNotMatch(
      stdout,
      /tests run:|warning:|unit tests skipped or todo/u,
    );
    assert.deepEqual(await fs.readdir(harness.temporary), []);
  },
);

for (const missing of [false, true]) {
  test(
    "failed process takes priority over unfinished reporter: missing=" +
      missing,
    async (context) => {
      const harness = await createSelectedHarness(context);
      const reporter = path.join(
        harness.root,
        "scripts/verification/node-reporter.mjs",
      );
      const source = await fs.readFile(reporter, "utf8");
      await fs.writeFile(
        reporter,
        missing
          ? source.replace("fs.writeFileSync(", "if (false) fs.writeFileSync(")
          : source.replace(
              "reporterComplete = true;",
              "reporterComplete = false;",
            ),
      );
      await assert.rejects(
        runSelected(harness, ["tests/failing.test.ts"]),
        (error: Error & { stderr: string; stdout: string; code: number }) => {
          assert.equal(error.code, 1);
          assert.equal(
            error.stderr,
            "selected unit test process exited with code 1; the test reporter did not finish\n",
          );
          assert.doesNotMatch(
            error.stdout,
            /tests run:|warning:|unit tests skipped or todo/u,
          );
          return true;
        },
      );
    },
  );
}
