import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { createTestboxDependencies } from "../scripts/verification/testbox-suite.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const moduleUrl = pathToFileURL(
  path.join(repositoryRoot, "scripts/verification/testbox-suite.mjs"),
).href;

function bridge(root: string, child: string, captureOutput: boolean) {
  return `
    import { createTestboxDependencies } from ${JSON.stringify(moduleUrl)};
    const cwd = ${JSON.stringify(root)};
    const env = { PATH: process.env.PATH };
    const dependencies = createTestboxDependencies({ cwd, environment: env });
    const result = await dependencies.runCommand({
      file: process.execPath, args: ["-e", ${JSON.stringify(child)}],
      cwd, env, captureOutput: ${captureOutput},
    });
    process.stdout.write("OUTCOME:" + JSON.stringify(result) + "\\n");
  `;
}

test("the production command adapter streams both outputs and retains nonzero exits", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-testbox-output-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const child = `process.stdout.write("streamed output\\n"); process.stderr.write("streamed error\\n"); process.exitCode = 23;`;
  const result = await execute(process.execPath, [
    "--input-type=module",
    "-e",
    bridge(root, child, false),
  ]);
  assert.match(result.stdout, /^streamed output\n/mu);
  assert.equal(result.stderr, "streamed error\n");
  const outcome = JSON.parse(result.stdout.split("OUTCOME:")[1]!) as {
    exitCode: number;
  };
  assert.equal(outcome.exitCode, 23);
  const dependencies = createTestboxDependencies({
    cwd: root,
    environment: { ...process.env },
  });
  const captured = await dependencies.runCommand({
    file: process.execPath,
    args: ["-e", child],
    cwd: root,
    env: { ...process.env },
    captureOutput: true,
  });
  assert.equal(captured.stdout, "streamed output\n");
  assert.equal(captured.stderr, "streamed error\n");
  assert.equal(captured.exitCode, 23);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test(
    `the wrapper command adapter forwards ${signal} to its running child`,
    { skip: process.platform === "win32", timeout: 20_000 },
    async (context) => {
      const root = await fs.mkdtemp(
        path.join(os.tmpdir(), "mokly-testbox-signal-"),
      );
      let childPid = 0;
      const child = `
      process.on(${JSON.stringify(signal)}, () => {
        process.stdout.write("FORWARDED:${signal}\\n");
        process.exit(17);
      });
      process.stdout.write("READY:" + process.pid + "\\n");
      setInterval(() => {}, 1000);
    `;
      const wrapper = spawn(
        process.execPath,
        ["--input-type=module", "-e", bridge(root, child, false)],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      context.after(async () => {
        if (wrapper.exitCode === null && wrapper.signalCode === null)
          wrapper.kill("SIGKILL");
        if (childPid) {
          try {
            process.kill(childPid, "SIGKILL");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
          }
        }
        await fs.rm(root, { recursive: true, force: true });
      });
      let stdout = "";
      let stderr = "";
      let ready: () => void = () => {};
      const readiness = new Promise<void>((resolve) => {
        ready = resolve;
      });
      wrapper.stdout.setEncoding("utf8");
      wrapper.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        const match = /^READY:(\d+)$/mu.exec(stdout);
        if (match) {
          childPid = Number(match[1]);
          ready();
        }
      });
      wrapper.stderr.setEncoding("utf8");
      wrapper.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      const completion = new Promise<number | null>((resolve, reject) => {
        wrapper.once("error", reject);
        wrapper.once("close", resolve);
      });
      await Promise.race([
        readiness,
        completion.then(() => {
          throw new Error(`wrapper closed before readiness: ${stderr}`);
        }),
      ]);
      wrapper.kill(signal);
      assert.equal(await completion, 0, stderr);
      assert.ok(stdout.includes(`FORWARDED:${signal}\n`));
      const outcome = JSON.parse(stdout.split("OUTCOME:")[1]!) as {
        exitCode: number;
        interrupted: string;
      };
      assert.equal(outcome.exitCode, 17);
      assert.equal(outcome.interrupted, signal);
      assert.throws(() => process.kill(childPid, 0), { code: "ESRCH" });
      childPid = 0;
    },
  );
}
