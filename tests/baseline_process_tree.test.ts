import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { NodeBaselineProcessRunner } from "../dist/baseline/process.js";

import {
  killProcessIfPresent,
  readProcessField,
} from "./helpers/process_state.js";

for (const exitLauncher of [false, true]) {
  test(
    `native cancellation drains a descendant with its launcher ${exitLauncher ? "exited" : "running"}`,
    { timeout: 15000 },
    async (t) => {
      const root = await fs.mkdtemp(
        path.join(os.tmpdir(), "mokly process tree "),
      );
      const pids: number[] = [];
      const controller = new AbortController();
      t.after(async () => {
        controller.abort();
        for (const pid of pids) killProcessIfPresent(pid);
        await fs.rm(root, { recursive: true, force: true });
      });
      const descendant = `
      process.on("SIGTERM", () => {});
      require("node:fs").writeFileSync("descendant.pid", String(process.pid));
      setInterval(() => {}, 1000);
    `;
      const script = `
      const child = require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { stdio: "inherit", detached: process.platform === "win32" });
      require("node:fs").writeFileSync("launcher.pid", String(process.pid));
      ${exitLauncher ? "child.unref();" : "setInterval(() => {}, 1000);"}
    `;
      const runner = new NodeBaselineProcessRunner();
      const reason = new Error("cancel nested build");
      const pending = runner.run({
        argv: [process.execPath, "-e", script],
        cwd: root,
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
        signal: controller.signal,
      });
      const outcome = pending.then(
        () => "completed",
        (error: unknown) => error,
      );
      for (const file of ["launcher.pid", "descendant.pid"]) {
        let value = "";
        for (let attempt = 0; attempt < 1_500 && !value; attempt++) {
          try {
            value = await fs.readFile(path.join(root, file), "utf8");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          if (!value) await setTimeout(10);
        }
        assert.ok(value, `Missing ${file}`);
        pids.push(Number(value));
      }
      if (exitLauncher) {
        for (
          let attempt = 0;
          attempt < 1_500 && runner.isAlive(pids[0]!);
          attempt++
        )
          await setTimeout(10);
        assert.equal(
          runner.isAlive(pids[0]!),
          false,
          "the launcher has exited before cancellation",
        );
      }
      controller.abort(reason);
      assert.equal(
        await Promise.race([
          outcome,
          setTimeout(10_000, "hung", { ref: false }),
        ]),
        reason,
      );
      for (const pid of pids) {
        if (!runner.isAlive(pid)) continue;
        assert.notEqual(
          process.platform,
          "win32",
          "Windows job disposal waits for every process",
        );
        const state = readProcessField(pid, "stat");
        assert.ok(
          state === undefined || state.startsWith("Z"),
          `Process ${pid} is still running: ${state}`,
        );
      }
      pids.length = 0;
    },
  );
}

test("native process scopes preserve literal arguments and command exit status", async () => {
  const args = ["a & b", "%PATH%", "", 'quote"value'];
  const result = await new NodeBaselineProcessRunner().run({
    argv: [
      process.execPath,
      "-e",
      "process.stdout.write(JSON.stringify(process.argv.slice(1))); process.exitCode = 17;",
      ...args,
    ],
    cwd: process.cwd(),
    env: {},
  });
  assert.deepEqual(JSON.parse(result.output), args);
  assert.equal(result.exitCode, 17);
});
