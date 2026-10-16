import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  cleanup,
  faultCommand,
  outputDirectory,
  recoveryFixture,
  reservation,
} from "./helpers/static_faults.js";

for (const verb of ["build", "publish"] as const)
  for (const fault of ["install,restore", "reservation-cleanup"])
    test(
      `${verb} rich ${fault} paths remain complete at the default 80 columns`,
      { timeout: 120_000 },
      async () => {
        const root = await recoveryFixture();
        const temporary = await fs.mkdtemp(
          path.join(os.tmpdir(), "mokly-paths-"),
        );
        const longName = "retained-output-".repeat(6);
        const temporaryRoot = path.join(temporary, longName);
        await fs.mkdir(temporaryRoot);
        const requested = path.join(".context", longName, "site");
        await fs.mkdir(path.join(root, path.dirname(requested)), {
          recursive: true,
        });
        let output: string | undefined;
        try {
          const result = await faultCommand(
            root,
            verb,
            fault,
            "rich",
            {
              MOKLY_TEST_STATIC_COLUMNS: undefined,
              TMPDIR: temporaryRoot,
              TMP: temporaryRoot,
              TEMP: temporaryRoot,
            },
            requested,
          ).result;
          output =
            verb === "build"
              ? path.join(root, requested)
              : outputDirectory(root, verb, result.stdout);
          assert.equal(result.code, 1, result.stderr);
          const retained =
            fault === "install,restore"
              ? path.join(reservation(output), "backup")
              : reservation(output);
          const displayed =
            verb === "build" ? path.relative(root, retained) : retained;
          assert.ok(displayed.length > 80);
          assert.ok(
            result.stderr.split("\n").includes(`  Recovery path: ${displayed}`),
            result.stderr,
          );
          if (verb === "publish") {
            assert.ok(output.length > 80);
            assert.ok(
              result.stdout
                .split("\n")
                .includes(`Mokly publish build: ${output}`),
            );
          } else {
            assert.ok(!result.stderr.includes(`Recovery path: ${root}`));
          }
        } finally {
          await cleanup(root, verb, output);
          await fs.rm(temporary, { recursive: true, force: true });
        }
      },
    );
