import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  cleanup,
  files,
  outputDirectory,
  recoveryFixture,
  reservation,
} from "./helpers/static_faults.js";
import {
  causes,
  exportCategory,
  normalized,
  recoveryPath,
  unsafe,
} from "./helpers/static_recovery_assertions.js";
import { signalFault } from "./helpers/static_signal.js";

for (const verb of ["build", "publish"] as const)
  for (const mode of ["plain", "rich"]) {
    for (const fault of [
      "config",
      "setup-signal",
      "setup-signal,stage-cleanup",
      "stage-signal",
      "capture-signal",
      "capture-signal,restore",
      "stage-signal,stage-cleanup",
    ])
      test(
        `${verb} ${mode} settles configuration staging and captured-output signals (${fault})`,
        { timeout: 120_000, skip: process.platform === "win32" },
        async (context) => {
          const root = await recoveryFixture(context.signal);
          const publication: { output?: string } = {};
          context.after(() => cleanup(root, verb, publication.output));
          const result = await signalFault(
            root,
            verb,
            mode,
            fault,
            context.signal,
          );
          const output = outputDirectory(root, verb, result.stdout);
          publication.output = output;
          assert.equal(result.code, 1, result.stderr);
          const failedRecovery = fault.includes(",");
          const recovery = reservation(output);
          if (failedRecovery) {
            exportCategory(result.stderr);
            assert.match(result.stderr, /Recovery failed/u);
            assert.ok(
              result.stderr.includes(recoveryPath(root, recovery, verb)),
            );
            assert.ok(!result.stderr.includes("Publication was cancelled"));
            const captured = fault.startsWith("capture");
            causes(
              result.stderr,
              captured
                ? "build cancelled"
                : unsafe(
                    path.join(
                      recovery,
                      fault.startsWith("setup")
                        ? ".mokly-export-transaction"
                        : "stage/404.html",
                    ),
                  ),
              captured
                ? "injected restore failure"
                : `Recovery failed: ${unsafe(path.join(recovery, "stage"))}`,
            );
          } else if (fault === "setup-signal") {
            exportCategory(result.stderr);
            assert.ok(
              result.stderr.includes(
                unsafe(path.join(recovery, ".mokly-export-transaction")),
              ),
            );
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
          if (mode === "plain")
            context.assert.snapshot(
              normalized(result.stderr, root, output, verb),
              { serializers: [String] },
            );
        },
      );
  }
