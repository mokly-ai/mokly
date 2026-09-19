import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as pause } from "node:timers/promises";

import {
  NodeBaselineProcessScopeFactory,
  type BaselineProcessScope,
  type BaselineProcessScopeFactory,
} from "../dist/baseline/process_scope.js";

import {
  servePreviewFixture,
  startPreviewServerProcess,
  type PreviewServerProcess,
} from "./browser/preview_fixture.js";
import {
  PREVIEW_ARTIFACT_MARKER,
  PreviewOutputRetentionError,
  startOwnedPreviewFixture,
} from "./browser/preview_fixture_owner.js";
import {
  killProcessIfPresent,
  readProcessField,
} from "./helpers/process_state.js";

test("startup process cleanup failure retains its owned artifact", async (context) => {
  const contextRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-preview-startup-failure-"),
  );
  const cleanupFailure = new Error("injected process cleanup failure");
  let closes = 0;
  let artifact = "";
  context.after(() => fs.rm(contextRoot, { force: true, recursive: true }));
  const process: PreviewServerProcess = {
    get exited() {
      return false;
    },
    get output() {
      return "not ready";
    },
    close: async () => {
      closes += 1;
      throw cleanupFailure;
    },
  };

  await assert.rejects(
    startOwnedPreviewFixture({
      build: async (output) => {
        artifact = output;
        await writeFreshArtifact(output);
      },
      contextRoot,
      prefix: "worker-",
      serve: (output) =>
        servePreviewFixture(output, {
          launch: async () => process,
          pause: async () => {},
          request: async () => new Response(undefined, { status: 503 }),
          startupAttempts: 1,
        }),
    }),
    (error) =>
      error instanceof PreviewOutputRetentionError &&
      error.cause === cleanupFailure,
  );
  assert.equal(closes, 1);
  await fs.access(artifact);
});

for (const failureAt of ["spawn", "start"] as const) {
  test(`preview ${failureAt} failure preserves its cleanup failure and retention signal`, async () => {
    const launchFailure = new Error(`injected ${failureAt} failure`);
    const cleanupFailure = new Error("injected launch cleanup failure");
    const scopes = failingScopeFactory(
      failureAt,
      launchFailure,
      cleanupFailure,
    );

    await assert.rejects(
      startPreviewServerProcess(
        { argv: [process.execPath, "ignored"], cwd: process.cwd(), env: {} },
        scopes,
      ),
      (error) => {
        if (!(error instanceof PreviewOutputRetentionError)) return false;
        assert.deepEqual(error.errors, [launchFailure, cleanupFailure]);
        assert.equal(error.cause, cleanupFailure);
        return true;
      },
    );
  });
}

test("preview commands wait for inherited process registration", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-preview-registration-"),
  );
  const sentinel = path.join(root, "started");
  const failure = new Error("injected process registration failure");
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  const scopes = new NodeBaselineProcessScopeFactory({
    register() {
      throw failure;
    },
  });

  await assert.rejects(
    startPreviewServerProcess(
      {
        argv: [
          process.execPath,
          "-e",
          `require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, "started")`,
        ],
        cwd: root,
        env: processEnvironment(),
      },
      scopes,
    ),
    (error) => error === failure,
  );
  await assert.rejects(fs.access(sentinel), { code: "ENOENT" });
});

test(
  "preview process cleanup kills a stubborn descendant after its launcher exits",
  { timeout: 15_000 },
  async (context) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-preview-process-"),
    );
    const pidFile = path.join(root, "descendant.pid");
    let descendantPid = 0;
    const descendant = `
      process.on("SIGTERM", () => {});
      require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      setInterval(() => {}, 1000);
    `;
    const launcher = `
      const child = require("node:child_process").spawn(
        process.execPath,
        ["-e", ${JSON.stringify(descendant)}],
        { stdio: "inherit" },
      );
      child.unref();
    `;
    const managed = await startPreviewServerProcess({
      argv: [process.execPath, "-e", launcher],
      cwd: root,
      env: processEnvironment(),
    });
    context.after(async () => {
      if (descendantPid && processAlive(descendantPid))
        killProcessIfPresent(descendantPid);
      await Promise.race([
        managed.close().catch(() => {}),
        pause(5_000, undefined, { ref: false }),
      ]);
      await fs.rm(root, { force: true, recursive: true });
    });

    for (let attempt = 0; attempt < 300 && !descendantPid; attempt += 1) {
      try {
        descendantPid = Number(await fs.readFile(pidFile, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (!descendantPid) await pause(10);
    }
    assert.ok(descendantPid, "stubborn descendant did not report its pid");
    for (let attempt = 0; attempt < 300 && !managed.exited; attempt += 1)
      await pause(10);
    assert.equal(managed.exited, true, "launcher should exit before cleanup");

    assert.notEqual(
      await Promise.race([
        managed.close().then(() => "closed"),
        pause(6_000, "hung", { ref: false }),
      ]),
      "hung",
    );
    assert.equal(
      processRunning(descendantPid),
      false,
      "close must drain descendants before it resolves",
    );
    descendantPid = 0;
  },
);

async function writeFreshArtifact(artifact: string): Promise<void> {
  await fs.mkdir(artifact, { recursive: true });
  await fs.writeFile(
    path.join(artifact, PREVIEW_ARTIFACT_MARKER),
    "schemaVersion=1\n",
  );
}

function processEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function processRunning(pid: number): boolean {
  if (!processAlive(pid)) return false;
  if (process.platform === "win32") return true;
  return !readProcessField(pid, "stat")?.startsWith("Z");
}

function failingScopeFactory(
  failureAt: "spawn" | "start",
  launchFailure: Error,
  cleanupFailure: Error,
): BaselineProcessScopeFactory {
  return {
    async create() {
      if (failureAt === "spawn")
        return {
          dispose: async () => {
            throw cleanupFailure;
          },
          spawn() {
            throw launchFailure;
          },
          start() {},
          terminate() {},
        };
      const mutableChild = Object.assign(new EventEmitter(), {
        exitCode: null,
        signalCode: null,
        stderr: null,
        stdout: null,
      }) as EventEmitter & {
        exitCode: number | null;
        signalCode: NodeJS.Signals | null;
        stderr: null;
        stdout: null;
      };
      const child = mutableChild as unknown as ChildProcess;
      const scope: BaselineProcessScope = {
        dispose: async () => {},
        spawn: () => child,
        start() {
          throw launchFailure;
        },
        terminate(signal) {
          if (signal === "SIGTERM") {
            mutableChild.exitCode = 1;
            child.emit("exit", 1, null);
            return;
          }
          child.emit("close", 1, null);
          throw cleanupFailure;
        },
      };
      return scope;
    },
  };
}
