import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { exportCatalogue } from "../dist/export/run.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { repositoryRoot } from "./helpers/fixture.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");
const preload = pathToFileURL(
  path.join(repositoryRoot, "tests/helpers/export_failure_preload.ts"),
).href;
const token = "export-cancellation-token";

test("publish cancellation with a clean rollback restores the previous site", async (context) => {
  const scenario = await cancellationScenario(
    context,
    "publish-cancel-clean",
    "plain",
  );
  assert.equal(scenario.result.code, 1);
  assert.equal(scenario.result.stdout, "");
  assert.equal(
    scenario.result.stderr,
    "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n",
  );
  assert.deepEqual(
    await directoryFiles(scenario.fixture.output),
    scenario.previous,
  );
  assert.equal(scenario.receiver.requests.length, 0);
});

test("publish preserves failed-restore recovery output in plain and rich modes", async (context) => {
  for (const output of ["plain", "rich"] as const) {
    await context.test(output, async (subcontext) => {
      const scenario = await cancellationScenario(
        subcontext,
        "publish-cancel-restore-failure",
        output,
      );
      assert.equal(scenario.result.code, 1);
      assert.match(scenario.result.stderr, /Export rollback failed/u);
      if (output === "plain")
        assert.match(
          scenario.result.stderr,
          /Injected restore failure after cancellation/u,
        );
      else
        assert.match(
          scenario.result.stderr,
          /The catalogue could not be exported/u,
        );
      assert.match(scenario.result.stderr, /\.mokly-export-reservations/u);
      assert.match(scenario.result.stderr, /backup/u);
      assert.doesNotMatch(scenario.result.stderr, /Publication was cancelled/u);
      assert.equal(fs.existsSync(scenario.fixture.output), false);
      assert.equal(scenario.receiver.requests.length, 0);
    });
  }
});

test("publish preserves reservation cleanup recovery after cancellation", async (context) => {
  const scenario = await cancellationScenario(context, "cancellation", "plain");
  assert.equal(scenario.result.code, 1);
  assert.equal(scenario.result.stdout, "");
  assert.match(scenario.result.stderr, /Export cancelled/u);
  assert.match(scenario.result.stderr, /Cleanup also failed/u);
  assert.match(scenario.result.stderr, /\.mokly-export-reservations/u);
  assert.doesNotMatch(scenario.result.stderr, /Publication was cancelled/u);
  assert.deepEqual(
    await directoryFiles(scenario.fixture.output),
    scenario.previous,
  );
  assert.equal(scenario.receiver.requests.length, 0);
});

async function cancellationScenario(
  context: TestContext,
  failure: string,
  output: "plain" | "rich",
) {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
  const previous = await directoryFiles(fixture.output);
  const receiver = await startFakeReceiver(context, { token });
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
        preload,
        cli,
        "publish",
        "--endpoint",
        receiver.endpoint,
        "--token",
        token,
        "--repository",
        "github.com/sample/catalogue",
        "--out",
        "site",
        "--no-changes",
      ],
      {
        cwd: fixture.root,
        env: {
          ...process.env,
          COLUMNS: "240",
          MOKLY_DIAGNOSTIC: "",
          MOKLY_OUTPUT: output,
          MOKLY_TEST_EXPORT_FAILURE: failure,
          NO_COLOR: "1",
        },
        timeout: 60_000,
      },
      (error, stdout, stderr) => resolve({ code: error?.code, stdout, stderr }),
    );
  });
  assert.equal((result.stdout + result.stderr).includes(token), false);
  return { fixture, previous, receiver, result };
}
