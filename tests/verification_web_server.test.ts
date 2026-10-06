import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { createVerificationProcessOwner } from "../scripts/verification/process-owner.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

test(
  "the browser server registers its process group for ancestor cancellation",
  { skip: process.platform === "win32", timeout: 12_000 },
  async (context) => {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/verification-web-server-"),
    );
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const pidFile = path.join(root, "server.pid");
    const environment = { ...process.env };
    for (const key of [
      "MOKLY_VERIFICATION_OWNER_ID",
      "MOKLY_VERIFICATION_PROCESS_REGISTRY",
      "MOKLY_VERIFICATION_RESOURCE_ROOT",
    ])
      delete environment[key];
    const owner = await createVerificationProcessOwner({
      cwd: root,
      env: environment,
    });
    const child = spawn(
      process.execPath,
      [
        "--import",
        "./scripts/verification/register-web-server.mjs",
        "-e",
        `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)`,
      ],
      {
        cwd: repositoryRoot,
        detached: true,
        env: owner.environment(environment),
        stdio: "ignore",
      },
    );
    const closed = new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", () => resolve());
    });
    context.after(() => killGroupIfPresent(child.pid));
    try {
      await waitFor(async () => {
        try {
          return (await fs.readFile(pidFile, "utf8")) === String(child.pid);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
          throw error;
        }
      });
      await owner.terminate("SIGKILL");
      await closed;
      assert.equal(processGroupExists(child.pid), false);
    } finally {
      killGroupIfPresent(child.pid);
      await closed;
      await owner.dispose();
    }
  },
);

async function waitFor(predicate: () => Promise<boolean>) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  assert.fail("timed out waiting for the owned browser server");
}

function processGroupExists(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function killGroupIfPresent(pid: number | undefined): void {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}
