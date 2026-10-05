import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { createExportFixture } from "./helpers/export_fixture.js";
import { cliBinPath } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("publish categorizes unexpected local preparation failures before writing or uploading", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await assert.rejects(
    execute(
      process.execPath,
      [
        cliBinPath,
        "publish",
        "--no-changes",
        "--repository",
        "github.com/sample/catalogue",
      ],
      {
        cwd: fixture.root,
        env: {
          ...process.env,
          MOKLY_TOKEN: "fixture-token",
          MOKLY_ENDPOINT: "http://127.0.0.1:1/upload",
          TMPDIR: path.join(fixture.root, "missing", "temporary"),
          TMP: path.join(fixture.root, "missing", "temporary"),
          TEMP: path.join(fixture.root, "missing", "temporary"),
        },
      },
    ),
    (error: unknown) => {
      const { stderr, stdout } = error as { stderr: string; stdout: string };
      assert.match(stderr, /\[mokly\/upload-failed\].*prepare/);
      assert.doesNotMatch(stderr + stdout, /fixture-token/);
      return true;
    },
  );
  assert.equal(
    fs.existsSync(path.join(fixture.root, ".context/mokly-publish")),
    false,
  );
});
