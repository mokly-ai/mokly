import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
      `${verb} ${mode} reports install, rollback, and cleanup failures with retained bytes`,
      { timeout: 120_000 },
      async () => {
        for (const fault of [
          "install",
          "install,restore",
          "backup-cleanup",
          "reservation-cleanup",
          "stage,stage-cleanup",
          "setup,stage-cleanup",
        ]) {
          const root = await recoveryFixture();
          let output: string | undefined;
          try {
            const previous = await files(path.join(root, ".context/previous"));
            const result = await faultCommand(root, verb, fault, mode).result;
            output = outputDirectory(root, verb, result.stdout);
            const recovery = reservation(output);
            assert.equal(result.code, 1, result.stderr);
            assert.ok(!result.stdout.includes("Built Mokly to"));
            assert.ok(!result.stdout.includes("Published Mokly catalogue"));
            assert.equal(
              result.stderr.match(/\[mokly\/export-invalid\]/gu)?.length,
              1,
              result.stderr,
            );
            assert.ok(!result.stderr.includes("[mokly-static"));
            assert.ok(!result.stderr.includes("[mokly-platform"));
            if (fault === "install") {
              assert.match(result.stderr, /injected install failure/u);
              assert.deepEqual(await files(output), previous);
              await assert.rejects(fs.stat(recovery), { code: "ENOENT" });
            } else if (fault === "install,restore") {
              assert.ok(
                result.stderr.indexOf("injected install failure") <
                  result.stderr.indexOf("injected restore failure"),
              );
              assert.ok(result.stderr.includes(path.join(recovery, "backup")));
              assert.deepEqual(
                await files(path.join(recovery, "backup")),
                previous,
              );
              await assert.rejects(fs.stat(output), { code: "ENOENT" });
            } else if (
              fault === "backup-cleanup" ||
              fault === "reservation-cleanup"
            ) {
              assert.match(result.stderr, /new site is installed/iu);
              assert.ok(result.stderr.includes(recovery));
              assert.notDeepEqual(await files(output), previous);
              if (fault === "backup-cleanup")
                assert.deepEqual(
                  await files(path.join(recovery, "backup")),
                  previous,
                );
            } else {
              assert.match(result.stderr, /Recovery failed/u);
              assert.ok(result.stderr.includes(recovery));
              assert.deepEqual(await files(output), previous);
            }
            const events = (
              await fs.readFile(path.join(root, ".context/events"), "utf8")
            )
              .trim()
              .split("\n");
            assert.equal(
              events.filter((event) => event === "remove-stage").length,
              ["install,restore", "backup-cleanup"].includes(fault) ? 0 : 1,
            );
          } finally {
            await cleanup(root, verb, output);
          }
        }
      },
    );
  }
