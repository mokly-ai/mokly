import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { platformPackage } from "../../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../../packages/mokly/src/runtime.mjs";
import { listeningAddress } from "../../scripts/verification/serve-process.mjs";

import { noisyFixture } from "./sidecar_noise.js";
import { workspace } from "./static_publication.js";

export async function noisySidecar(
  context: TestContext,
  verb: "build" | "serve",
) {
  const { root, packageRoot } = await noisyFixture(context, verb, true);
  const runtime = systemRuntime();
  const native = runtime.nativePackage(
    platformPackage(runtime.platform, runtime.architecture, runtime.glibc),
  );
  const child = spawn(
    native.binary,
    [
      verb,
      "--sidecars=1",
      ...(verb === "build"
        ? ["--no-changes", "--out=.context/site"]
        : ["--watch", "--port=0"]),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        MOKLY_OUTPUT: "plain",
        MOKLY_PACKAGE_ROOT: packageRoot,
        MOKLY_NODE_EXECUTABLE: process.execPath,
        MOKLY_VIEWER_DIST: path.join(workspace, "packages/viewer/dist"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stop = () => child.kill("SIGTERM");
  context.signal.addEventListener("abort", stop, { once: true });
  context.after(() => {
    child.kill("SIGKILL");
  });
  const updates = new EventEmitter();
  let stdout = "";
  let stderr = "";
  let acknowledged = false;
  child.stdout.on("data", (bytes) => {
    stdout += String(bytes);
    updates.emit("output");
  });
  child.stderr.on("data", (bytes) => {
    stderr += String(bytes);
    const finalPiece = verb === "serve" ? "T".repeat(17) + "\n" : "\nR\n";
    if (!acknowledged && stderr.includes(finalPiece)) {
      acknowledged = true;
      writeFileSync(path.join(root, ".context/stderr-forwarded"), "yes");
    }
    updates.emit("output");
  });
  const result = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      context.signal.removeEventListener("abort", stop);
      resolve({ code, signal, stdout, stderr });
    });
  });
  return {
    child,
    result,
    root,
    async ready() {
      while (!listeningAddress(stdout))
        await Promise.race([
          once(updates, "output", { signal: context.signal }),
          result.then((value) => {
            throw new Error(`Serve exited: ${value.stderr}`);
          }),
        ]);
      return listeningAddress(stdout)!;
    },
    async gitFailure() {
      while (!/^\[mokly\/git-failed\][^\n]*\n/mu.test(stderr))
        await Promise.race([
          once(updates, "output", { signal: context.signal }),
          result.then((value) => {
            throw new Error(
              `Serve exited before its Git diagnostic: ${value.stderr}`,
            );
          }),
        ]);
    },
    async completion() {
      const read = async (file: string) =>
        fs
          .readFile(path.join(root, ".context", file), "utf8")
          .catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return null;
            throw error;
          });
      return {
        written: await read("stderr-complete"),
        tail: await read("stderr-tail-complete"),
        exit: await read("sidecar-exit"),
      };
    },
    async assertStopped() {
      const pids = new Set(
        (await fs.readFile(path.join(root, ".context/pids"), "utf8"))
          .trim()
          .split("\n")
          .map(Number),
      );
      assert.ok(pids.size >= 2);
      for (const pid of pids)
        assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    },
  };
}
