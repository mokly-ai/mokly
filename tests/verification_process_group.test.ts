import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { createVerificationProcessOwner } from "../scripts/verification/process-owner.mjs";
import { runInherited } from "../scripts/verification/process.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

test(
  "a parent owner drains an independently grouped verification command",
  { skip: process.platform === "win32", timeout: 15_000 },
  async (context) => {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/verification-group-"),
    );
    context.after(() => fs.rm(root, { force: true, recursive: true }));
    const pidFile = path.join(root, "command.pid");
    const environment = { ...process.env };
    for (const key of [
      "MOKLY_VERIFICATION_OWNER_ID",
      "MOKLY_VERIFICATION_PROCESS_REGISTRY",
      "MOKLY_VERIFICATION_RESOURCE_ROOT",
    ])
      delete environment[key];
    const parent = await createVerificationProcessOwner({
      cwd: root,
      env: environment,
    });
    const controller = new AbortController();
    let pid = 0;
    context.after(() => killGroupIfPresent(pid));
    const child = `
      require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      process.on("SIGTERM", () => {});
      setInterval(() => {}, 1000);
    `;
    const pending = runInherited(process.execPath, ["-e", child], {
      cwd: repositoryRoot,
      env: parent.environment(environment),
      abortSignal: controller.signal,
    });
    try {
      await waitFor(async () => {
        try {
          pid = Number(await fs.readFile(pidFile, "utf8"));
          return Number.isSafeInteger(pid) && pid > 0;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
          throw error;
        }
      });
      await parent.terminate("SIGTERM");
      await parent.terminate("SIGKILL");
      await waitFor(() => !processGroupExists(pid));
    } finally {
      controller.abort();
      killGroupIfPresent(pid);
      await pending.catch(() => {});
      await parent.dispose();
    }
  },
);

async function waitFor(predicate: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  assert.fail("timed out waiting for owned verification process");
}

function processGroupExists(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function killGroupIfPresent(pid: number): void {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}
