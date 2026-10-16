import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";

const exec = promisify(execFile);
test(
  "publication cancellation keeps the real compiler diagnostic in its cause chain",
  { timeout: 120_000, skip: process.platform === "win32" },
  async () => {
    const root = await publicationFixture(true);
    let output: string | undefined;
    await fs.promises.mkdir(path.join(root, ".context"));
    await fs.promises.writeFile(
      path.join(root, "specs/home.mockup.ts"),
      "export const broken = ;",
    );
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-qm", "invalid source"], { cwd: root });
    let ready!: () => void;
    const readiness = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const watcher = fs.watch(path.join(root, ".context"), (_event, file) => {
      if (file === "ready") ready();
    });
    const running = publish(root, "http://127.0.0.1:1/plan", "plain", {
      env: {
        MOKLY_DIAGNOSTIC: "1",
        MOKLY_TEST_STATIC_FAULTS: "compile",
        MOKLY_TEST_STATIC_READY: path.join(root, ".context/ready"),
      },
    });
    try {
      await Promise.race([
        readiness,
        running.result.then((result) => {
          throw new Error(`No compiler gate: ${result.stderr}`);
        }),
      ]);
      running.child.kill("SIGINT");
      const result = await running.result;
      output = directory(result.stdout);
      assert.equal(result.code, 1);
      assert.ok(
        result.stderr.startsWith(
          "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n",
        ),
      );
      assert.match(result.stderr, /Diagnostic causes:/u);
      assert.match(result.stderr, /home\.mockup\.ts:1:/u);
      assert.match(result.stderr, /Unexpected/u);
      assert.ok(!result.stderr.includes("private/a=="));
      await assert.rejects(fs.promises.stat(output), { code: "ENOENT" });
    } finally {
      watcher.close();
      running.child.kill("SIGKILL");
      if (output) await removeOutput(output);
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  },
);
