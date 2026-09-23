import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as pause } from "node:timers/promises";
import { promisify } from "node:util";

import { discoverUnitFiles } from "./evidence.mjs";
import { validateLocalReports } from "./local-evidence.mjs";
import { chooseBrowserPorts } from "./local-ports.mjs";
import {
  captureSource,
  createSnapshot,
  removeSnapshot,
  verifySource,
} from "./local-snapshot.mjs";
import { runLocalTasks } from "./local-tasks.mjs";
import { discoverBrowserTests } from "./playwright.mjs";
import { createVerificationProcessOwner } from "./process-owner.mjs";
import { runInherited } from "./process.mjs";

const execute = promisify(execFile);
const SHARDS = 4;

export class SnapshotUnavailableError extends Error {}

/** Run all work in isolated snapshots after xtask's live audit. */
export async function runCompleteLocal(root) {
  await preflight(root);
  const initial = performance.now();
  const captured = await captureSource(root);
  const context = path.join(root, ".context");
  await fs.mkdir(context, { recursive: true });
  const directory = await fs.mkdtemp(path.join(context, "local-check-"));
  const reports = path.join(
    context,
    "verification-reports",
    path.basename(directory),
  );
  const tasks = verificationTasks();
  const snapshots = [];
  const abort = new AbortController();
  let owner;
  let interrupted;
  let failure;
  let cancellation;
  let completed;
  const cancel = () => {
    cancellation ??= (async () => {
      abort.abort();
      if (!owner) return;
      await owner.terminate("SIGTERM");
      await pause(2_000);
      await owner.terminate("SIGKILL");
    })();
    return cancellation;
  };
  const signal = (name) => {
    interrupted ??= new Error(`Local verification interrupted by ${name}`);
    void cancel().catch((error) => {
      failure ??= error;
    });
  };
  const sigint = () => signal("SIGINT");
  const sigterm = () => signal("SIGTERM");
  process.on("SIGINT", sigint);
  process.on("SIGTERM", sigterm);
  try {
    const ports = await chooseBrowserPorts(
      SHARDS,
      process.env.MOKLY_PLAYWRIGHT_PORT,
    );
    owner = await createVerificationProcessOwner({ cwd: root });
    for (const task of tasks) {
      if (interrupted) throw interrupted;
      const snapshot = await createSnapshot(
        root,
        captured,
        directory,
        task.key,
      );
      snapshots.push(snapshot);
      task.snapshot = snapshot;
      if (task.suite === "repository") await seedCargoCache(root, snapshot);
      if (task.suite === "browser") task.port = ports[task.index - 1];
      await verifySource(root, captured);
    }
    await fs.mkdir(reports, { recursive: true });
    console.error(
      `[local-check] source ${captured.fingerprint}, ${tasks.length} isolated workers, ${localWorkerLimit(os.availableParallelism())} concurrent`,
    );
    const results = [];
    await runLocalTasks(
      tasks,
      localWorkerLimit(os.availableParallelism()),
      async (task) => {
        if (interrupted) throw interrupted;
        const started = performance.now();
        const env = owner.environment({
          ...process.env,
          CARGO_TARGET_DIR: path.join(task.snapshot, "target"),
          ...(task.port ? { MOKLY_PLAYWRIGHT_PORT: String(task.port) } : {}),
          ...(task.index
            ? {
                MOKLY_VERIFICATION_REPORT: path.join(
                  task.snapshot,
                  ".context/verification-reports/report.json",
                ),
              }
            : {}),
        });
        const args = ["xtask", "check", "--suite", task.suite];
        if (task.index) args.push("--shard", `${task.index}/${SHARDS}`);
        console.error(
          `[local-check] start ${task.key}${task.port ? ` port=${task.port}` : ""}`,
        );
        const outcome = await runInherited("cargo", args, {
          cwd: task.snapshot,
          env,
          abortSignal: abort.signal,
        });
        const succeeded =
          outcome.exitCode === 0 && !outcome.signal && !outcome.interrupted;
        let report;
        if (task.index) {
          try {
            report = await collectWorkerReport(
              env.MOKLY_VERIFICATION_REPORT,
              path.join(reports, `${task.key}.json`),
              succeeded,
            );
          } catch (error) {
            if (succeeded) throw error;
            console.error(
              `[local-check] could not retain ${task.key}: ${error}`,
            );
          }
        }
        if (!succeeded) throw workerFailure(task.key, outcome, report);
        if (report) results.push(report);
        await verifySource(root, captured);
        console.error(
          `[local-check] passed ${task.key} ${((performance.now() - started) / 1000).toFixed(1)}s`,
        );
      },
      cancel,
    );
    if (interrupted) throw interrupted;
    const browserRoot = tasks.find(
      (task) => task.suite === "browser",
    )?.snapshot;
    const expected = {
      commit: captured.head,
      runtime:
        process.env.MOKLY_VERIFICATION_RUNTIME ??
        `node-${process.versions.node}`,
      unitFiles: await discoverUnitFiles(root),
      browserTests: (await discoverBrowserTests(browserRoot)).tests,
    };
    validateLocalReports(results, expected);
    await verifySource(root, captured);
    completed = expected;
  } catch (error) {
    failure = primaryCheckError(error, interrupted);
    try {
      await cancel();
    } catch (cleanupError) {
      failure = new AggregateError(
        [error, cleanupError],
        "Local verification and cancellation failed",
        { cause: error },
      );
    }
  } finally {
    process.removeListener("SIGINT", sigint);
    process.removeListener("SIGTERM", sigterm);
    let drained = true;
    if (owner) {
      try {
        await owner.dispose();
      } catch (cleanupError) {
        failure ??= cleanupError;
        drained = false;
      }
    }
    if (drained) {
      let removed = 0;
      for (const snapshot of snapshots.reverse()) {
        try {
          await removeSnapshot(root, snapshot, directory);
          removed++;
        } catch (cleanupError) {
          failure ??= cleanupError;
          break;
        }
      }
      if (removed === snapshots.length) {
        try {
          await fs.rmdir(directory);
        } catch (cleanupError) {
          failure ??= cleanupError;
        }
      }
    }
    if (failure) console.error(`[local-check] failed; reports: ${reports}`);
  }
  if (failure) throw failure;
  console.error(
    `[local-check] complete: ${completed.unitFiles.length} unit files, ${completed.browserTests.length} browser tests, ${((performance.now() - initial) / 1000).toFixed(1)}s; reports: ${reports}`,
  );
}

async function preflight(root) {
  try {
    await execute("git", ["worktree", "list", "--porcelain"], { cwd: root });
  } catch (error) {
    throw new SnapshotUnavailableError(
      `Cannot create isolated Git worktrees: ${error.message}`,
      { cause: error },
    );
  }
}

async function seedCargoCache(root, snapshot) {
  try {
    await fs.cp(path.join(root, "target"), path.join(snapshot, "target"), {
      recursive: true,
      preserveTimestamps: true,
    });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Start the longest observed shards early so they do not extend the tail. */
export function verificationTasks() {
  return [
    { key: "repository", suite: "repository" },
    { key: "browser-2", suite: "browser", index: 2 },
    { key: "unit-4", suite: "unit", index: 4 },
    { key: "browser-3", suite: "browser", index: 3 },
    { key: "package", suite: "package" },
    { key: "browser-4", suite: "browser", index: 4 },
    { key: "browser-1", suite: "browser", index: 1 },
    { key: "unit-1", suite: "unit", index: 1 },
    { key: "unit-2", suite: "unit", index: 2 },
    { key: "unit-3", suite: "unit", index: 3 },
  ];
}

/** Cap process-level parallelism independently of each runner's worker cap. */
export function localWorkerLimit(available) {
  return Math.max(1, Math.min(4, available));
}

/** A cancellation-caused worker exit must not replace the initiating signal. */
export function primaryCheckError(error, interrupted) {
  return interrupted ?? error;
}

/** Preserve a failed shard's evidence for diagnosis without accepting it. */
export async function collectWorkerReport(source, destination, required) {
  let contents;
  try {
    contents = await fs.readFile(source, "utf8");
  } catch (error) {
    if (required) throw error;
    return undefined;
  }
  await fs.copyFile(source, destination);
  try {
    return JSON.parse(contents);
  } catch (error) {
    if (required) throw error;
    return undefined;
  }
}

/** Surface the originating test when a worker exits unsuccessfully. */
export function workerFailure(key, outcome, report) {
  const detail = (report?.failures ?? [])
    .slice(0, 2)
    .map((failure) => `${failure.name}: ${failure.diagnostic}`)
    .join("\n");
  const exit = outcome.signal ?? outcome.interrupted ?? outcome.exitCode;
  return new Error(`${key} failed (${exit})${detail ? `\n${detail}` : ""}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const root = path.resolve(import.meta.dirname, "../..");
  try {
    await runCompleteLocal(root);
  } catch (error) {
    console.error(error);
    process.exitCode = error instanceof SnapshotUnavailableError ? 75 : 1;
  }
}
