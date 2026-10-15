import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";

export const sidecarFixture = path.resolve("tests/fixtures/sidecar");

export function startSidecar(context: TestContext) {
  const child = spawn(
    process.execPath,
    [path.resolve("packages/mokly/dist/sidecar.js")],
    { stdio: "pipe" },
  );
  context.after(() => {
    child.kill("SIGKILL");
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  let next = 0;
  const pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  createInterface({ input: child.stdout }).on("line", (line) => {
    const value = JSON.parse(line);
    const waiter = pending.get(value.id);
    assert.ok(waiter, `unexpected frame ${line}`);
    pending.delete(value.id);
    if (value.error)
      waiter.reject(
        Object.assign(new Error(value.error.message), {
          code: value.error.code,
        }),
      );
    else waiter.resolve(value.result);
  });
  child.on("exit", () => {
    for (const waiter of pending.values())
      waiter.reject(new Error(`sidecar exited: ${stderr}`));
    pending.clear();
  });
  const call = <T = unknown>(
    method: string,
    params: object = {},
  ): Promise<T> => {
    const id = next++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve: (value) => resolve(value as T), reject });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  };
  return { call, child, stderr: () => stderr };
}

export function bundleParams(
  overrides: Partial<BundleParams> = {},
): BundleParams {
  return {
    entryFiles: ["component.mockup.tsx", "screen.mockup.tsx", "page.mockup.ts"],
    renderer: "renderer.tsx",
    storiesFiles: ["button.stories.tsx"],
    sourceRoot: sidecarFixture,
    moduleResolution: {
      aliases: {},
      conditions: [],
      loaders: {},
      mainFields: [],
      packageRoots: [],
      resolveExtensions: [],
    },
    ...overrides,
  };
}
