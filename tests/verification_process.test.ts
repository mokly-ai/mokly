import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
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
