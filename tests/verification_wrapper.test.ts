import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("verification wrappers retain real reporter evidence and fail closed", async () => {
  const root = await createHarness();
  const sharedPlaywrightMarker = path.join(
    repositoryRoot,
    "test-results/.last-run.json",
  );
  const sharedPlaywrightState = await fileState(sharedPlaywrightMarker);
  try {
    const browserReport = path.join(root, "browser-report.json");
    await runWrapper(root, "run-browser.mjs", browserReport);
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
      runWrapper(root, "run-browser.mjs", browserReport, {
        NODE_OPTIONS: appendNodeOption(
          process.env.NODE_OPTIONS,
          `--import=${pathToFileURL(preload).href}`,
        ),
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
    await assert.rejects(runWrapper(root, "run-unit.mjs", unitReport));
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

async function createHarness(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/verification-wrapper-"),
  );
  await fs.cp(
    path.join(repositoryRoot, "scripts/verification"),
    path.join(root, "scripts/verification"),
    { recursive: true },
  );
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const files = new Map([
    ["dist/cli/bin.js", ""],
    ["packages/viewer/dist/browser/inspector.js", ""],
    ["examples/basic/.generated/mokly-manifest.json", "{}\n"],
    [
      "playwright.config.mjs",
      `export default {
  fullyParallel: false,
  outputDir: ${JSON.stringify(path.join(root, "playwright-output"))},
  projects: [{ name: "chromium" }],
  retries: 0,
  testDir: "tests/browser",
  workers: 1,
};
`,
    ],
    [
      "tests/browser/passing.spec.ts",
      `import { test } from "@playwright/test";

test("real reporter identity", () => {});
`,
    ],
    [
      "tests/failing.test.ts",
      `import test from "node:test";

test("retained unit diagnostic", () => {
  throw new Error("retained unit diagnostic sentinel");
});
`,
    ],
  ]);
  for (const [name, contents] of files) {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  await fs.mkdir(path.join(root, "packages/viewer/tests"), { recursive: true });
  return root;
}

async function runWrapper(
  root: string,
  name: string,
  report: string,
  environment: Readonly<Record<string, string>> = {},
): Promise<void> {
  const inherited = { ...process.env };
  delete inherited.NODE_TEST_CONTEXT;
  await execute(
    process.execPath,
    [path.join(root, "scripts/verification", name)],
    {
      cwd: root,
      env: {
        ...inherited,
        ...environment,
        MOKLY_VERIFICATION_REPORT: report,
        MOKLY_VERIFICATION_RUNTIME: `node-${process.versions.node}`,
      },
    },
  );
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
