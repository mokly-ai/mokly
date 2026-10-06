import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  createHarness,
  runWrapper,
  writeHarnessFile,
} from "./helpers/verification_wrapper.js";

test("verification wrappers retain real reporter evidence and fail closed", async () => {
  const root = await createHarness();
  const sharedPlaywrightMarker = path.join(
    repositoryRoot,
    "test-results/.last-run.json",
  );
  const sharedPlaywrightState = await fileState(sharedPlaywrightMarker);
  try {
    const browserReport = path.join(root, "browser-report.json");
    await runWrapper(root, "run-browser.mjs", { report: browserReport });
    await assertPlaywrightOutputIsConfined(
      root,
      sharedPlaywrightMarker,
      sharedPlaywrightState,
    );
    const successful = await readJson(browserReport);
    assert.equal(successful.reporterComplete, true);
    assert.equal(successful.outcome.status, "passed");
    assert.equal(successful.observedTests.length, 1);
    assert.equal(successful.observedTests[0].project, "chromium");
    assert.deepEqual(successful.observedTests[0].errors, []);
    assert.deepEqual(
      successful.observedTests.map((entry: { id: string }) => entry.id),
      successful.assignedTests.map((entry: { id: string }) => entry.id),
    );

    await fs.writeFile(
      browserReport,
      `${JSON.stringify({ marker: "stale", outcome: { status: "passed" } })}\n`,
    );
    const preload = path.join(root, "reject-event-write.mjs");
    await fs.writeFile(
      preload,
      `import fs from "node:fs";
const writeFileSync = fs.writeFileSync;
fs.writeFileSync = function (file, ...args) {
  if (String(file).endsWith(".events"))
    throw new Error("intentional reporter write failure");
  return writeFileSync.call(this, file, ...args);
};
`,
    );
    await assert.rejects(
      runWrapper(root, "run-browser.mjs", {
        report: browserReport,
        environment: {
          NODE_OPTIONS: appendNodeOption(
            process.env.NODE_OPTIONS,
            `--import=${pathToFileURL(preload).href}`,
          ),
        },
      }),
    );
    await assertPlaywrightOutputIsConfined(
      root,
      sharedPlaywrightMarker,
      sharedPlaywrightState,
    );
    const failed = await readJson(browserReport);
    assert.equal(failed.marker, undefined);
    assert.equal(failed.reporterComplete, false);
    assert.equal(failed.outcome.exitCode, 0);
    assert.equal(failed.outcome.status, "failed");

    const unitReport = path.join(root, "unit-report.json");
    await assert.rejects(
      runWrapper(root, "run-unit.mjs", { report: unitReport }),
    );
    const unit = await readJson(unitReport);
    assert.equal(unit.outcome.status, "failed");
    assert.ok(
      unit.failures.some((failure: { diagnostic?: string }) =>
        failure.diagnostic?.includes("retained unit diagnostic sentinel"),
      ),
      JSON.stringify(unit, null, 2),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("complete developer runs retain skips and reports while the strict policy rejects skips", async (context) => {
  const root = await createHarness();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeHarnessFile(
    root,
    "tests/failing.test.ts",
    'import test from "node:test";\ntest("passing", () => {});\ntest.skip("intentional Windows skip", () => {});\ntest.todo("pending");\n',
  );
  const report = path.join(root, "unit-report.json");
  const { stdout } = await runWrapper(root, "run-unit-dev.mjs", { report });
  const developer = await readJson(report);
  assert.equal(developer.skipped, 2);
  assert.equal(developer.reporterComplete, true);
  assert.equal(developer.outcome.status, "passed");
  assert.match(stdout, /unit tests skipped or todo: 2/u);
  assert.doesNotMatch(stdout, /partial verification/u);
  await assert.rejects(
    runWrapper(root, "run-unit.mjs", { report }),
    /report contains skipped tests/u,
  );
  const strict = await readJson(report);
  assert.equal(strict.skipped, 2);
  assert.equal(strict.outcome.status, "failed");
});

test("the strict wrapper retains Node shard arguments and report assignments", async (context) => {
  const root = await createHarness();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeHarnessFile(
    root,
    "tests/passing.test.ts",
    'import test from "node:test";\ntest("passing", () => {});\n',
  );
  const report = path.join(root, "unit-report.json");
  await runWrapper(root, "run-unit.mjs", {
    report,
    args: ["--shard", "2/2"],
  });
  const strict = await readJson(report);
  assert.deepEqual(strict.shard, { index: 2, total: 2 });
  assert.deepEqual(strict.fullFiles, [
    "tests/failing.test.ts",
    "tests/passing.test.ts",
  ]);
  assert.deepEqual(strict.assignedFiles, ["tests/passing.test.ts"]);
  assert.deepEqual(
    strict.observedFiles.map((entry: { file: string }) => entry.file),
    strict.assignedFiles,
  );
  assert.equal(strict.outcome.status, "passed");
});

for (const policy of ["run-unit.mjs", "run-unit-dev.mjs"]) {
  for (const failure of ["discovery", "preparation"]) {
    test(
      "complete " +
        policy +
        " removes stale evidence before " +
        failure +
        " fails",
      async (context) => {
        const root = await createHarness();
        context.after(() => fs.rm(root, { recursive: true, force: true }));
        const report = path.join(root, "unit-report.json");
        await fs.writeFile(report, "stale complete report\n");
        await fs.writeFile(report + ".events", "stale events\n");
        if (failure === "discovery")
          await fs.rm(path.join(root, "tests/failing.test.ts"));
        else await fs.rm(path.join(root, "dist"), { recursive: true });
        await assert.rejects(
          runWrapper(root, policy, { report }),
          failure === "discovery"
            ? /unit test discovery was empty/u
            : /prepared verification output is missing/u,
        );
        for (const target of [report, report + ".events"])
          await assert.rejects(fs.stat(target), { code: "ENOENT" });
      },
    );
  }
}

async function readJson(file: string) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function fileState(file: string) {
  try {
    const [contents, metadata] = await Promise.all([
      fs.readFile(file, "base64"),
      fs.stat(file),
    ]);
    return {
      contents,
      modifiedAtMs: metadata.mtimeMs,
      size: metadata.size,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function assertPlaywrightOutputIsConfined(
  root: string,
  sharedMarker: string,
  sharedState: Awaited<ReturnType<typeof fileState>>,
): Promise<void> {
  assert.deepEqual(await fileState(sharedMarker), sharedState);
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(
        path.join(root, "playwright-output/.last-run.json"),
        "utf8",
      ),
    ),
    { failedTests: [], status: "passed" },
  );
}

function appendNodeOption(current: string | undefined, next: string): string {
  return current ? `${current} ${next}` : next;
}
