import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";

import { serveProcess } from "../../scripts/verification/serve-process.mjs";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
export const shim = path.join(workspace, "packages/mokly/bin/mokly.mjs");
const processCleanups = new Map<string, (() => Promise<void>)[]>();

export async function consumer(
  context: TestContext,
  files: Record<string, string>,
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-js-serve-"));
  const cleanups: (() => Promise<void>)[] = [];
  processCleanups.set(root, cleanups);
  context.after(async () => {
    const failures: unknown[] = [];
    for (const close of cleanups.toReversed()) {
      try {
        await close();
      } catch (error) {
        failures.push(error);
      }
    }
    processCleanups.delete(root);
    if (failures.length)
      throw new AggregateError(failures, "Serve consumer cleanup failed");
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.symlink(
    path.join(workspace, "node_modules"),
    path.join(root, "node_modules"),
    "junction",
  );
  for (const [file, text] of Object.entries({
    "mokly.config.json": "{}",
    ...files,
  })) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  }
  return root;
}

export async function serve(
  context: TestContext,
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
  extra: string[] = [],
) {
  const managed = await serveProcess(
    [shim, "serve", "--no-watch", "--port", "0", "--sidecars", "1", ...extra],
    root,
    environment,
  );
  const { child } = managed;
  const exited = once(child, "close").finally(managed.drain);
  const updates = new EventEmitter();
  const output = { stdout: "", stderr: "" };
  for (const stream of ["stdout", "stderr"] as const)
    child[stream].on("data", (chunk: Buffer) => {
      output[stream] += chunk.toString();
      updates.emit(stream);
    });
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null)
      managed.signal("SIGINT");
    await exited;
  };
  const cleanups = processCleanups.get(root);
  if (cleanups) cleanups.push(stop);
  else context.after(stop);
  try {
    await managed.start();
  } catch (error) {
    managed.signal("SIGKILL");
    await exited;
    throw error;
  }
  const signal = AbortSignal.timeout(30_000);
  async function wait(stream: "stdout" | "stderr", pattern: RegExp) {
    for (;;) {
      const match = pattern.exec(output[stream]);
      if (match) return match;
      await Promise.race([
        once(updates, stream, { signal }),
        exited.then(() => {
          throw new Error(`Serve exited before ${pattern}: ${output.stderr}`);
        }),
      ]);
    }
  }
  return {
    child,
    exited,
    output,
    signal,
    wait,
    ready: async () =>
      (
        await wait("stdout", /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/)
      )[1]!,
    close: async () => {
      await stop();
      const [code] = await exited;
      assert.equal(code, 0, output.stderr);
    },
  };
}

/** Wait for usage and a terminal Changes state through publication events. */
export async function completed(
  url: string,
  signal: AbortSignal,
  path: string,
  request: typeof fetch = fetch,
) {
  const events = await request(`${url}/mokly-viewer/events`, { signal });
  const stream = events.body!.getReader();
  try {
    for (;;) {
      const index = await (
        await request(`${url}/mokly-viewer/index.json`, { signal })
      ).json();
      const detail = await (
        await request(`${url}/mokly-viewer/entries/${path}.json`, { signal })
      ).json();
      if (
        detail.revision === index.revision &&
        ["ready", "unavailable", "disabled"].includes(index.changesStatus) &&
        Array.isArray(detail.workspace?.usedBy)
      )
        return { index, detail };
      await stream.read();
    }
  } finally {
    await stream.cancel();
  }
}
