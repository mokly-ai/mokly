import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { createExportFixture } from "./helpers/export_fixture.js";
import { repositoryRoot, cliBinPath } from "./helpers/fixture.js";

for (const mode of ["rollback", "backup", "cancellation", "cleanup"] as const) {
  test(`real export CLI reports ${mode} failures without losing recovery information`, async (context) => {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    await fs.promises.mkdir(fixture.output);
    const result = await new Promise<{
      code: string | number | undefined;
      stdout: string;
      stderr: string;
    }>((resolve) => {
      execFile(
        process.execPath,
        [
          "--import",
          "tsx",
          "--import",
          pathToFileURL(
            path.join(
              repositoryRoot,
              "tests/helpers/export_failure_preload.ts",
            ),
          ).href,
          cliBinPath,
          "export",
          "--out",
          "site",
        ],
        {
          cwd: fixture.root,
          env: {
            ...process.env,
            MOKLY_TEST_EXPORT_FAILURE: mode,
            MOKLY_DIAGNOSTIC: "0",
          },
          timeout: 60_000,
        },
        (error, stdout, stderr) =>
          resolve({ code: error?.code, stdout, stderr }),
      );
    });
    assert.equal(result.code, 1, result.stderr);
    assert.equal(result.stdout, "");
    if (mode === "rollback") {
      assert.match(result.stderr, /rollback failed/);
      assert.match(result.stderr, /Injected install failure/);
      assert.match(result.stderr, /Injected restore failure/);
      assert.match(result.stderr, /recovery files retained/);
    } else if (mode === "backup") {
      assert.match(
        result.stderr,
        /Export installed, but backup cleanup failed/,
      );
      assert.match(result.stderr, /Injected backup cleanup failure/);
      assert.match(result.stderr, /recovery files retained/);
    } else if (mode === "cancellation") {
      assert.match(result.stderr, /Export cancelled/);
      assert.match(result.stderr, /Cleanup also failed/);
      assert.deepEqual(await fs.promises.readdir(fixture.output), []);
    } else {
      assert.match(result.stderr, /Export installed, but cleanup failed/);
      assert.ok(fs.existsSync(path.join(fixture.output, "index.html")));
    }
    assert.match(result.stderr, /\.mokly-export-reservations/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  });
}
