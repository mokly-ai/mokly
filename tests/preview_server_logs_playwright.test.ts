import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const SERVER_URL = "http://127.0.0.1:43241";
const LOG_LINES = Array.from(
  { length: 45 },
  (_, index) => `[wrangler:info] GET /page-${index + 1} 200 OK`,
);

test("Playwright reports preview logs after preview tests time out or fail", async (context) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/preview-server-logs-"),
  );
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  await writeProject(root);
  const events = path.join(root, "events.json");
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    MOKLY_PLAYWRIGHT_EVENT_REPORT: events,
    PWTEST_CACHE_DIR: path.join(root, "transform-cache"),
  };
  delete environment.NODE_TEST_CONTEXT;

  const failure = await execute(
    process.execPath,
    [
      path.join(repositoryRoot, "node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      path.join(root, "playwright.config.mjs"),
    ],
    {
      cwd: root,
      env: environment,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
    },
  ).then(
    () => assert.fail("the miniature preview project must fail"),
    (error: { stderr?: string }) => error,
  );

  const report = JSON.parse(await fs.readFile(events, "utf8"));
  assert.deepEqual(
    Object.fromEntries(
      report.observedTests.map(
        (observed: { title: string; status: string }) => [
          observed.title.split(" › ").at(-1),
          observed.status,
        ],
      ),
    ),
    {
      "assertion fails": "failed",
      "page load stalls": "timedOut",
      "page loads": "passed",
    },
  );
  const stderr = (failure.stderr ?? "").split("\n");
  const timedOut = reportBlock(
    stderr,
    "Test timed out: logs.spec.mjs › page load stalls",
  );
  assert.deepEqual(timedOut.slice(2), [
    "Last 40 of 45 log lines:",
    ...LOG_LINES.slice(5).map((line) => `  ${line}`),
  ]);
  const failed = reportBlock(
    stderr,
    "Test failed: logs.spec.mjs › assertion fails",
  );
  assert.deepEqual(failed.slice(2), []);
  assert.equal(stderr.filter((line) => line.includes("page loads")).length, 0);
  for (const block of [timedOut, failed]) {
    const saved = await fs.readFile(path.join(root, logPath(block)), "utf8");
    assert.ok(saved.endsWith(`\n\n${LOG_LINES.join("\n")}\n`));
  }
  assert.deepEqual(
    (await savedLogs(path.join(root, "output"))).sort(),
    [logPath(failed), logPath(timedOut)].sort(),
  );
});

function reportBlock(stderr: readonly string[], heading: string): string[] {
  const start = stderr.indexOf(`[mokly:preview-server-log] ${heading}`);
  assert.notEqual(start, -1, `missing preview log report: ${heading}`);
  const lines = [stderr[start] ?? ""];
  for (const line of stderr.slice(start + 1)) {
    if (!/^(?:Preview server |Last \d+ of | {2})/u.test(line)) break;
    lines.push(line);
  }
  assert.match(
    lines[1] ?? "",
    /^Preview server http:\/\/127\.0\.0\.1:43241 \(running\)\. Full log: output[\\/]\S+[\\/]preview-server-1\.log$/u,
  );
  return lines;
}

function logPath(block: readonly string[]): string {
  return (block[1] ?? "").replace(/^.*\. Full log: /u, "");
}

async function savedLogs(output: string): Promise<string[]> {
  const entries = await fs.readdir(output, { recursive: true });
  return entries
    .filter((entry) => path.basename(entry).startsWith("preview-server-"))
    .map((entry) => path.join("output", entry));
}

async function writeProject(root: string): Promise<void> {
  const module = (name: string) =>
    JSON.stringify(
      pathToFileURL(path.join(repositoryRoot, "tests/browser", name)).href,
    );
  const spec = `
    import { test } from ${module("preview_test.ts")};
    import { trackPreviewServer } from ${module("preview_server_logs.ts")};

    const output = ${JSON.stringify(`${LOG_LINES.join("\n")}\n`)};
    let close = () => {};
    test.beforeAll(() => {
      close = trackPreviewServer({ exited: false, output }, ${JSON.stringify(SERVER_URL)});
    });
    test.afterAll(() => close());
    test("page load stalls", async () => {
      test.setTimeout(500);
      await new Promise(() => {});
    });
    test("assertion fails", async () => {
      throw new Error("injected assertion failure");
    });
    test("page loads", async () => {});
  `;
  const config = `
    export default {
      outputDir: ${JSON.stringify(path.join(root, "output"))},
      reporter: [[${JSON.stringify(path.join(repositoryRoot, "scripts/verification/playwright-reporter.mjs"))}]],
      testDir: ${JSON.stringify(root)},
      testMatch: "logs.spec.mjs",
      workers: 1,
    };
  `;
  await Promise.all([
    fs.writeFile(path.join(root, "logs.spec.mjs"), spec),
    fs.writeFile(path.join(root, "playwright.config.mjs"), config),
  ]);
}
