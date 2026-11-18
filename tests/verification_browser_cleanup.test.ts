import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

for (const phase of ["setup", "cleanup"] as const) {
  test(`browser ${phase} failures retain every host error through Playwright`, async (context) => {
    const root = await diagnosticProject(context, phase);
    const eventPath = path.join(root, "events.json");
    let stderr = "";
    await assert.rejects(
      execute(
        process.execPath,
        [
          path.join(repositoryRoot, "node_modules/@playwright/test/cli.js"),
          "test",
          `--reporter=${path.join(repositoryRoot, "scripts/verification/playwright-reporter.mjs")}`,
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            MOKLY_PLAYWRIGHT_EVENT_REPORT: eventPath,
            MOKLY_PLAYWRIGHT_WORKERS: "2",
            MOKLY_PLAYWRIGHT_STATIC_DIR: "",
            MOKLY_PLAYWRIGHT_FILE_DIR: "",
          },
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, 1);
        assert.ok("stderr" in error && typeof error.stderr === "string");
        stderr = error.stderr;
        return true;
      },
    );
    const events: unknown = JSON.parse(await fs.readFile(eventPath, "utf8"));
    assert.ok(events && typeof events === "object");
    assert.ok("status" in events);
    assert.equal(events.status, "failed");
    assert.ok("reporterComplete" in events);
    assert.equal(events.reporterComplete, true);
    assert.ok("observedTests" in events && Array.isArray(events.observedTests));
    assert.deepEqual(
      events.observedTests.map((entry: unknown) => {
        assert.ok(entry && typeof entry === "object" && "status" in entry);
        return entry.status;
      }),
      phase === "cleanup" ? ["passed"] : [],
    );
    assert.ok("errors" in events && Array.isArray(events.errors));
    assert.equal(events.errors.length, 1);
    const diagnostic: unknown = events.errors[0];
    assert.ok(typeof diagnostic === "string");
    assert.ok(stderr.includes(diagnostic));
    for (const message of [
      "Browser host cleanup failed",
      "Example Serve worker 1 (http://127.0.0.1:7001) cleanup failed",
      "Example Serve worker 2 (http://127.0.0.1:7002) cleanup failed",
      "Copied static host (http://127.0.0.1:7003) cleanup failed",
      "Comparison static host (http://127.0.0.1:7004) cleanup failed",
      "worker close first",
      "worker nested group",
      "worker root cause",
      "worker close second",
      "Expected one shared example Git diagnostic:",
      "unexpected worker output",
      "copied workspace removal failed",
      "copied root cause",
      "comparison close failed",
      "comparison close non-error",
      ...(phase === "setup"
        ? [
            "Browser setup and cleanup failed",
            "worker readiness group",
            "worker readiness first",
            "worker readiness second",
          ]
        : []),
    ]) {
      assert.ok(diagnostic.includes(message), `missing diagnostic: ${message}`);
    }
    assert.match(stderr, /at Object\.close \([^\n]*global_setup\.ts:/u);
  });
}

async function diagnosticProject(
  context: TestContext,
  phase: "setup" | "cleanup",
): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/browser-cleanup-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const files = {
    "playwright.config.mjs": `export default {
      globalSetup: "./global_setup.ts",
      outputDir: "./playwright-output",
      projects: [{ name: "chromium" }],
      testDir: "./tests/browser",
      workers: 1,
    };`,
    "tests/browser/passing.spec.ts": `import { test } from "@playwright/test";
      test("case passes before cleanup", () => {});`,
    "global_setup.ts": `
import setup from ${JSON.stringify(path.join(repositoryRoot, "tests/browser/setup.ts"))};
import { startExampleHosts } from ${JSON.stringify(path.join(repositoryRoot, "tests/browser/example_setup.ts"))};

export default (config) => setup(config, {
  start: (count, signal) => {
    let worker = 0;
    return startExampleHosts(count, signal, async () => {
      const index = worker++;
      return {
        url: "http://127.0.0.1:" + (7001 + index),
        diagnostics: () => "unexpected worker output",
        async close() {
          if (index === 0) throw new AggregateError([
            new Error("worker close first", {
              cause: new AggregateError([
                new Error("worker root cause"),
              ], "worker nested group"),
            }),
            new Error("worker close second"),
          ], "worker close group");
        },
      };
    }, async (url) => {
      if (${JSON.stringify(phase)} === "setup" && url.endsWith(":7002"))
        throw new AggregateError([
          new Error("worker readiness first"),
          new Error("worker readiness second"),
        ], "worker readiness group");
    });
  },
  staticHost: async () => ({
    directory: "/copied",
    url: "http://127.0.0.1:7003",
    async close() {
      throw new Error("copied workspace removal failed", {
        cause: new Error("copied root cause"),
      });
    },
  }),
  comparisonHost: async () => ({
    directory: "/comparison",
    url: "http://127.0.0.1:7004",
    async close() {
      throw new AggregateError([
        new Error("comparison close failed"),
        "comparison close non-error",
      ], "comparison close group");
    },
  }),
});`,
  };
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  return root;
}
