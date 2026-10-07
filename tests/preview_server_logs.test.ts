import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  PRINTED_PREVIEW_LOG_LINES,
  reportPreviewServerLogs,
  type PreviewLogTestInfo,
  type PreviewServerLog,
} from "./browser/preview_server_logs.js";

const TITLE_PATH = ["preview_design_links.spec.ts", "scheme swaps"];
const TITLE = "preview_design_links.spec.ts › scheme swaps";

test("a timed-out test prints each preview log tail and saves the full log", async (context) => {
  const root = await temporaryRoot(context);
  const output = numberedLines(45);
  const writes: string[] = [];

  await reportPreviewServerLogs(
    testInfo(root, "timedOut"),
    [
      server("http://127.0.0.1:43217", "running", output.join("\n") + "\n"),
      server("http://127.0.0.1:43218", "closed", ""),
    ],
    (text) => writes.push(text),
  );

  assert.equal(PRINTED_PREVIEW_LOG_LINES, 40);
  assert.deepEqual(writes, [
    [
      `[mokly:preview-server-log] Test timed out: ${TITLE}`,
      `Preview server http://127.0.0.1:43217 (running). Full log: ${shown(root, 1)}`,
      "Last 40 of 45 log lines:",
      ...output.slice(5).map((line) => `  ${line}`),
      `Preview server http://127.0.0.1:43218 (closed). Full log: ${shown(root, 2)}`,
      "The log is empty.",
      "",
    ].join("\n"),
  ]);
  assert.equal(
    await fs.readFile(logFile(root, 1), "utf8"),
    [
      "Preview server http://127.0.0.1:43217 (running)",
      `Test timed out: ${TITLE}`,
      "",
      ...output,
      "",
    ].join("\n"),
  );
  assert.equal(
    await fs.readFile(logFile(root, 2), "utf8"),
    [
      "Preview server http://127.0.0.1:43218 (closed)",
      `Test timed out: ${TITLE}`,
      "",
      "The log is empty.",
      "",
    ].join("\n"),
  );
});

test("a failed test saves preview logs and prints only where they are", async (context) => {
  const root = await temporaryRoot(context);
  const output = numberedLines(3);
  const writes: string[] = [];

  await reportPreviewServerLogs(
    testInfo(root, "failed"),
    [server("http://127.0.0.1:43219", "exited", output.join("\n"))],
    (text) => writes.push(text),
  );

  assert.deepEqual(writes, [
    [
      `[mokly:preview-server-log] Test failed: ${TITLE}`,
      `Preview server http://127.0.0.1:43219 (exited). Full log: ${shown(root, 1)}`,
      "",
    ].join("\n"),
  ]);
  assert.equal(
    await fs.readFile(logFile(root, 1), "utf8"),
    [
      "Preview server http://127.0.0.1:43219 (exited)",
      `Test failed: ${TITLE}`,
      "",
      ...output,
      "",
    ].join("\n"),
  );
});

for (const [status, expectedStatus, servers] of [
  ["passed", "passed", 1],
  ["skipped", "skipped", 1],
  ["failed", "failed", 1],
  ["interrupted", "passed", 1],
  ["timedOut", "passed", 0],
] as const) {
  test(`no preview log is kept for status ${status}, expected ${expectedStatus}, servers ${servers}`, async () => {
    const paths: string[] = [];
    const writes: string[] = [];

    await reportPreviewServerLogs(
      {
        expectedStatus,
        outputPath: (...segments: string[]) => {
          paths.push(path.join(...segments));
          return path.join(os.tmpdir(), ...segments);
        },
        status,
        titlePath: TITLE_PATH,
      },
      Array.from({ length: servers }, () =>
        server("http://127.0.0.1:43220", "running", "line\n"),
      ),
      (text) => writes.push(text),
    );

    assert.deepEqual(paths, []);
    assert.deepEqual(writes, []);
  });
}

test("preview logs drop terminal colours and normalize line endings", async (context) => {
  const root = await temporaryRoot(context);
  const writes: string[] = [];

  await reportPreviewServerLogs(
    testInfo(root, "timedOut"),
    [
      server(
        "http://127.0.0.1:43221",
        "running",
        "\u001B[32m[wrangler:info]\u001B[39m GET / 200 OK (5ms)\r\nold mac line\rlast",
      ),
    ],
    (text) => writes.push(text),
  );

  assert.deepEqual(writes[0]?.split("\n").slice(2), [
    "Last 3 of 3 log lines:",
    "  [wrangler:info] GET / 200 OK (5ms)",
    "  old mac line",
    "  last",
    "",
  ]);
  assert.match(
    await fs.readFile(logFile(root, 1), "utf8"),
    /\n\n\[wrangler:info\] GET \/ 200 OK \(5ms\)\nold mac line\nlast\n$/u,
  );
});

test("a preview log that cannot be saved still prints its tail", async (context) => {
  const root = await temporaryRoot(context);
  const missing = path.join(root, "missing");
  const writes: string[] = [];

  await reportPreviewServerLogs(
    {
      ...testInfo(root, "timedOut"),
      outputPath: (...segments: string[]) => path.join(missing, ...segments),
    },
    [server("http://127.0.0.1:43222", "running", "only line\n")],
    (text) => writes.push(text),
  );

  const lines = writes[0]?.split("\n") ?? [];
  assert.equal(lines.length, 5);
  assert.match(
    lines[1] ?? "",
    /^Preview server http:\/\/127\.0\.0\.1:43222 \(running\)\. The full log was not saved to .*preview-server-1\.log: ENOENT/u,
  );
  assert.deepEqual(lines.slice(2), [
    "Last 1 of 1 log lines:",
    "  only line",
    "",
  ]);
  await assert.rejects(fs.access(missing), { code: "ENOENT" });
});

function server(
  url: string,
  state: PreviewServerLog["state"],
  output: string,
): PreviewServerLog {
  return { output, state, url };
}

function testInfo(
  root: string,
  status: "failed" | "timedOut",
): PreviewLogTestInfo {
  return {
    expectedStatus: "passed",
    outputPath: (...segments: string[]) => path.join(root, ...segments),
    status,
    titlePath: TITLE_PATH,
  };
}

function numberedLines(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `[wrangler:info] GET /page-${index + 1} 200 OK`,
  );
}

function logFile(root: string, index: number): string {
  return path.join(root, `preview-server-${index}.log`);
}

function shown(root: string, index: number): string {
  return path.relative(process.cwd(), logFile(root, index));
}

async function temporaryRoot(context: TestContext): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-preview-server-logs-"),
  );
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  return root;
}
