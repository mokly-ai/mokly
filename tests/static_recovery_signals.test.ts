import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  cleanup,
  faultCommand,
  files,
  outputDirectory,
  recoveryFixture,
  reservation,
} from "./helpers/static_faults.js";

for (const verb of ["build", "publish"] as const)
  for (const mode of ["plain", "rich"]) {
    test(
      `${verb} ${mode} settles configuration staging and captured-output signals`,
      { timeout: 120_000, skip: process.platform === "win32" },
      async () => {
        for (const fault of [
          "config",
          "setup-signal",
          "setup-signal,stage-cleanup",
          "stage-signal",
          "capture-signal",
          "capture-signal,restore",
          "stage-signal,stage-cleanup",
        ]) {
          const root = await recoveryFixture();
          let output: string | undefined;
          let ready!: () => void;
          const readiness = new Promise<void>((resolve) => {
            ready = resolve;
          });
          const watcher = fs.watch(
            path.join(root, ".context"),
            (_event, name) => {
              if (name === "ready") ready();
            },
          );
          const running = faultCommand(root, verb, fault, mode);
          try {
            await Promise.race([
              readiness,
              running.result.then((result) => {
                throw new Error(`No fault readiness: ${result.stderr}`);
              }),
            ]);
            running.child.kill("SIGINT");
            const result = await running.result;
            output = outputDirectory(root, verb, result.stdout);
            assert.equal(result.code, 1, result.stderr);
            const failedRecovery = fault.includes(",");
            if (failedRecovery) {
              assert.match(result.stderr, /\[mokly\/export-invalid\]/u);
              assert.match(result.stderr, /Recovery failed/u);
              assert.ok(result.stderr.includes(reservation(output)));
              assert.ok(!result.stderr.includes("Publication was cancelled"));
            } else if (fault === "setup-signal") {
              assert.match(result.stderr, /\[mokly\/export-invalid\]/u);
              assert.ok(!result.stderr.includes("cancelled"));
            } else if (mode === "plain") {
              assert.equal(
                result.stderr,
                verb === "build"
                  ? "[mokly/build-invalid] build cancelled\n"
                  : "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n",
              );
            } else
              assert.match(
                result.stderr,
                verb === "build"
                  ? /build cancelled/u
                  : /Publication was cancelled/u,
              );
            const previous = await files(path.join(root, ".context/previous"));
            if (fault === "config")
              await assert.rejects(fs.promises.stat(output), {
                code: "ENOENT",
              });
            else if (fault === "capture-signal,restore") {
              assert.deepEqual(
                await files(path.join(reservation(output), "backup")),
                previous,
              );
              await assert.rejects(fs.promises.stat(output), {
                code: "ENOENT",
              });
            } else assert.deepEqual(await files(output), previous);
            if (!failedRecovery && fault !== "config")
              await assert.rejects(fs.promises.stat(reservation(output)), {
                code: "ENOENT",
              });
          } finally {
            watcher.close();
            running.child.kill("SIGKILL");
            await cleanup(root, verb, output);
          }
        }
      },
    );
  }
