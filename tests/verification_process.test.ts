import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("the Node evidence reporter preserves failure diagnostics", async () => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/verification-reporter-"),
  );
  const events = path.join(root, "events.json");
  try {
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    await assert.rejects(
      execute(
        process.execPath,
        [
          "--test",
          "--test-reporter=./scripts/verification/node-reporter.mjs",
          "scripts/verification/_fixtures_/failing.mjs",
        ],
        {
          cwd: repositoryRoot,
          env: { ...environment, MOKLY_NODE_EVENT_REPORT: events },
        },
      ),
      (error: { stderr?: string; stdout?: string }) => {
        assert.match(
          error.stdout ?? "",
          /verification reporter diagnostic sentinel[\s\S]+failing\.mjs/,
        );
        assert.match(
          error.stderr ?? "",
          /verification reporter stderr sentinel/,
        );
        return true;
      },
    );
    const report = JSON.parse(await fs.readFile(events, "utf8"));
    assert.equal(report.reporterComplete, true);
    assert.equal(report.summaries[0].success, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("verification cancellation terminates the owned process tree", async () => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/verification-process-"),
  );
  const pidFile = path.join(root, "grandchild.pid");
  let grandchild: number | undefined;
  try {
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const wrapper = spawn(
      process.execPath,
      ["scripts/verification/_fixtures_/process-wrapper.mjs"],
      {
        cwd: repositoryRoot,
        env: { ...environment, MOKLY_TREE_PID_FILE: pidFile },
        stdio: "ignore",
      },
    );
    await waitFor(async () => {
      try {
        grandchild = Number(await fs.readFile(pidFile, "utf8"));
        return Number.isSafeInteger(grandchild);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    });
    wrapper.kill("SIGTERM");
    const result = await new Promise<{
      code: number | null;
      signal: string | null;
    }>((resolve, reject) => {
      wrapper.once("error", reject);
      wrapper.once("close", (code, signal) => resolve({ code, signal }));
    });
    assert.notEqual(result.code, 0);
    await waitFor(() => !processExists(grandchild));
  } finally {
    if (processExists(grandchild)) process.kill(grandchild!, "SIGKILL");
    await fs.rm(root, { recursive: true, force: true });
  }
});

test(
  "verification cancellation drains a Playwright-owned detached scope",
  { skip: process.platform === "win32", timeout: 20_000 },
  async (context) => {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/verification-playwright-owner-"),
    );
    const pidFile = path.join(root, "owned.pid");
    const resourceFile = path.join(root, "resource-root.txt");
    const fallbackResource = path.join(root, "fallback-resource");
    let ownedPid = 0;
    let resourceRoot = fallbackResource;
    context.after(async () => {
      if (processExists(ownedPid)) process.kill(ownedPid, "SIGKILL");
      await fs.rm(root, { force: true, recursive: true });
    });
    await fs.symlink(
      path.join(repositoryRoot, "node_modules"),
      path.join(root, "node_modules"),
      "dir",
    );
    await writePlaywrightScopeHarness(root, pidFile, resourceFile);
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const wrapper = spawn(
      process.execPath,
      ["scripts/verification/_fixtures_/playwright-scope-wrapper.mjs"],
      {
        cwd: repositoryRoot,
        env: {
          ...environment,
          MOKLY_PLAYWRIGHT_SCOPE_ROOT: root,
          MOKLY_SCOPE_FALLBACK_RESOURCE_ROOT: fallbackResource,
        },
        stdio: "ignore",
      },
    );
    context.after(() => {
      if (processExists(wrapper.pid)) wrapper.kill("SIGKILL");
    });
    await waitFor(async () => {
      try {
        ownedPid = Number(await fs.readFile(pidFile, "utf8"));
        resourceRoot = await fs.readFile(resourceFile, "utf8");
        return Number.isSafeInteger(ownedPid) && ownedPid > 0;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    });
    await fs.access(path.join(resourceRoot, "owned.txt"));
    wrapper.kill("SIGTERM");
    const outcome = await Promise.race([
      new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve, reject) => {
          wrapper.once("error", reject);
          wrapper.once("close", (code, signal) => resolve({ code, signal }));
        },
      ),
      delay(12_000, "hung", { ref: false }),
    ]);
    assert.notEqual(outcome, "hung");
    assert.notEqual(typeof outcome === "string" ? 0 : outcome.code, 0);
    assert.equal(processExists(ownedPid), false);
    ownedPid = 0;
    await assert.rejects(fs.access(resourceRoot), { code: "ENOENT" });
  },
);

async function writePlaywrightScopeHarness(
  root: string,
  pidFile: string,
  resourceFile: string,
): Promise<void> {
  const processScope = pathToFileURL(
    path.join(repositoryRoot, "dist/baseline/process_scope.js"),
  ).href;
  const child = `
    process.on("SIGTERM", () => {});
    require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
    setInterval(() => {}, 1000);
  `;
  const spec = `
    import fs from "node:fs";
    import path from "node:path";
    import { test as base } from "@playwright/test";
    import { NodeBaselineProcessScopeFactory } from ${JSON.stringify(processScope)};
    const test = base.extend({
      owned: [async ({}, use) => {
        const resourceRoot = process.env.MOKLY_VERIFICATION_RESOURCE_ROOT ??
          process.env.MOKLY_SCOPE_FALLBACK_RESOURCE_ROOT;
        if (!resourceRoot) throw new Error("verification resource root is required");
        fs.mkdirSync(resourceRoot, { recursive: true });
        fs.writeFileSync(${JSON.stringify(resourceFile)}, resourceRoot);
        fs.writeFileSync(path.join(resourceRoot, "owned.txt"), "owned");
        const scope = await new NodeBaselineProcessScopeFactory().create();
        const child = scope.spawn({
          argv: [process.execPath, "-e", ${JSON.stringify(child)}],
          cwd: process.cwd(),
          env: { ...process.env },
        });
        scope.start();
        try { await use(); }
        finally {
          scope.terminate("SIGTERM");
          await new Promise((resolve) => child.once("close", resolve));
          await scope.dispose();
        }
      }, { auto: true }],
    });
    test("holds the nested scope", async () => await new Promise(() => {}));
  `;
  const config = `
    export default {
      outputDir: ${JSON.stringify(path.join(root, "output"))},
      testDir: ${JSON.stringify(root)},
      testMatch: "scope.spec.mjs",
      timeout: 300000,
      workers: 1,
    };
  `;
  await Promise.all([
    fs.writeFile(path.join(root, "scope.spec.mjs"), spec),
    fs.writeFile(path.join(root, "playwright.config.mjs"), config),
  ]);
}

async function waitFor(predicate: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  assert.fail("timed out waiting for verification process state");
}

function processExists(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}
