import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { servePreviewFixture } from "./browser/preview_fixture.js";
import type { PreviewServerProcess } from "./browser/preview_process.js";
import {
  runWithPreviewServerLogs,
  trackedPreviewServerLogs,
} from "./browser/preview_server_logs.js";

interface FakePreviewProcess extends PreviewServerProcess {
  exit(): void;
}

test("a preview started before a failed test is reported and stays tracked", async (context) => {
  const root = await temporaryRoot(context);
  const url = "http://127.0.0.1:43231";
  const child = fakeProcess(url, "[wrangler:info] GET / 200 OK (5ms)\n");
  const preview = await serve(child);
  try {
    assert.equal(preview.url, url);
    assert.deepEqual(logsFor(url), [
      { output: child.output, state: "running", url },
    ]);

    const report = await runTest(root, "failed", async () => {});

    assert.match(report, serverLine(url, "running"));
    assert.deepEqual(statesFor(url), ["running"]);
  } finally {
    await preview.close();
  }
  assert.deepEqual(statesFor(url), ["closed"]);
});

test("a preview closed during a timed-out test is reported once as closed", async (context) => {
  const root = await temporaryRoot(context);
  const url = "http://127.0.0.1:43232";
  const child = fakeProcess(url, "[wrangler:info] GET /stalled 200 OK\n");

  const report = await runTest(root, "timedOut", async () => {
    const preview = await serve(child);
    await preview.close();
  });

  assert.match(report, serverLine(url, "closed"));
  assert.match(report, /\n {2}\[wrangler:info\] GET \/stalled 200 OK\n/u);
  assert.deepEqual(logsFor(url), []);
  assert.doesNotMatch(
    await runTest(root, "timedOut", async () => {}),
    /43232/u,
  );
});

test("a preview closed before a test starts is not reported", async (context) => {
  const root = await temporaryRoot(context);
  const url = "http://127.0.0.1:43233";
  const preview = await serve(fakeProcess(url));
  await preview.close();
  await preview.close();
  assert.deepEqual(statesFor(url), ["closed"]);

  const report = await runTest(root, "failed", async () => {});

  assert.doesNotMatch(report, /43233/u);
  assert.deepEqual(logsFor(url), []);
});

test("a preview whose process exits is reported as exited", async (context) => {
  const root = await temporaryRoot(context);
  const url = "http://127.0.0.1:43234";
  const child = fakeProcess(url);
  const preview = await serve(child);
  try {
    child.exit();
    assert.deepEqual(statesFor(url), ["exited"]);
    assert.match(
      await runTest(root, "timedOut", async () => {}),
      serverLine(url, "exited"),
    );
  } finally {
    await preview.close();
  }
});

test("a preview that never becomes ready is not tracked", async () => {
  const url = "http://127.0.0.1:43235";
  await assert.rejects(
    servePreviewFixture("/fixture/site", {
      launch: async () => fakeProcess(url),
      pause: async () => {},
      request: async () => new Response(undefined, { status: 503 }),
      startupAttempts: 1,
    }),
    /preview did not start/u,
  );
  assert.deepEqual(logsFor(url), []);
});

test("a passing test reports no preview and leaves running previews tracked", async (context) => {
  const root = await temporaryRoot(context);
  const url = "http://127.0.0.1:43236";
  const preview = await serve(fakeProcess(url));
  try {
    assert.equal(await runTest(root, "passed", async () => {}), "");
    assert.deepEqual(statesFor(url), ["running"]);
    assert.deepEqual(await fs.readdir(root), []);
  } finally {
    await preview.close();
  }
});

function fakeProcess(url: string, log = ""): FakePreviewProcess {
  let exited = false;
  return {
    close: async () => {},
    exit: () => {
      exited = true;
    },
    get exited() {
      return exited;
    },
    get output() {
      return `[wrangler:info] Ready on ${url}\n${log}`;
    },
  };
}

function serve(child: PreviewServerProcess) {
  return servePreviewFixture("/fixture/site", {
    launch: async () => child,
    pause: async () => {},
    request: async () => new Response(),
    startupAttempts: 1,
  });
}

function logsFor(url: string) {
  return trackedPreviewServerLogs().filter((log) => log.url === url);
}

function statesFor(url: string) {
  return logsFor(url).map((log) => log.state);
}

function serverLine(url: string, state: string): RegExp {
  const escaped = url.replaceAll(".", "\\.");
  return new RegExp(
    `\\nPreview server ${escaped} \\(${state}\\)\\. Full log: \\S+\\.log\\n`,
    "u",
  );
}

async function runTest(
  root: string,
  status: "failed" | "passed" | "timedOut",
  run: () => Promise<void>,
): Promise<string> {
  const writes: string[] = [];
  await runWithPreviewServerLogs(
    {
      expectedStatus: "passed",
      outputPath: (...segments: string[]) => path.join(root, ...segments),
      status,
      titlePath: ["tracking.spec.ts", status],
    },
    run,
    (text) => writes.push(text),
  );
  return writes.join("");
}

async function temporaryRoot(context: TestContext): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-preview-server-tracking-"),
  );
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  return root;
}
