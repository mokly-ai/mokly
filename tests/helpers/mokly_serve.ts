import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
export const shim = path.join(workspace, "packages/mokly/bin/mokly.mjs");

export async function consumer(
  context: TestContext,
  files: Record<string, string>,
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-js-serve-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
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

export function serve(context: TestContext, root: string, group = false) {
  const child = spawn(
    process.execPath,
    [shim, "serve", "--no-watch", "--port", "0", "--sidecars", "1"],
    {
      cwd: root,
      detached: group,
      env: { ...process.env, MOKLY_OUTPUT: "plain" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(child, "exit");
  const updates = new EventEmitter();
  const output = { stdout: "", stderr: "" };
  for (const stream of ["stdout", "stderr"] as const)
    child[stream].on("data", (chunk: Buffer) => {
      output[stream] += chunk.toString();
      updates.emit(stream);
    });
  context.after(async () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGINT");
    await exited;
  });
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
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGINT");
      const [code] = await exited;
      assert.equal(code, 0, output.stderr);
    },
  };
}

/** Wait for the background batch through publication events, not a clock assertion. */
export async function completed(
  url: string,
  signal: AbortSignal,
  path: string,
) {
  const events = await fetch(`${url}/mokly-viewer/events`, { signal });
  const stream = events.body!.getReader();
  try {
    for (;;) {
      const index = await (
        await fetch(`${url}/mokly-viewer/index.json`, { signal })
      ).json();
      const detail = await (
        await fetch(`${url}/mokly-viewer/entries/${path}.json`, { signal })
      ).json();
      if (
        detail.revision === index.revision &&
        Array.isArray(detail.workspace?.usedBy)
      )
        return { index, detail };
      await stream.read();
    }
  } finally {
    await stream.cancel();
  }
}
