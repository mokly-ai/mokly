import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

const require = createRequire(import.meta.url);

/** Install an esbuild service proxy that interrupts the CLI's process group during compilation. */
export async function esbuildCancellationEnvironment(
  context: TestContext,
): Promise<{ environment: NodeJS.ProcessEnv; marker: string }> {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-esbuild-cancel-"),
  );
  context.after(() => fs.rm(directory, { force: true, recursive: true }));
  const proxy = path.join(directory, "esbuild-cancellation-proxy.mjs");
  const marker = path.join(directory, "compile-interrupted");
  await fs.writeFile(proxy, ESBUILD_CANCELLATION_PROXY, { mode: 0o755 });
  return {
    environment: {
      ESBUILD_BINARY_PATH: proxy,
      MOKLY_TEST_ESBUILD_MARKER: marker,
      MOKLY_TEST_REAL_ESBUILD: require.resolve("esbuild/bin/esbuild"),
    },
    marker,
  };
}

const ESBUILD_CANCELLATION_PROXY = `#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";

const binary = process.env["MOKLY_TEST_REAL_ESBUILD"];
const marker = process.env["MOKLY_TEST_ESBUILD_MARKER"];
if (!binary || !marker) throw new Error("missing esbuild cancellation settings");

process.on("SIGINT", () => undefined);
const child = spawn(binary, process.argv.slice(2), {
  stdio: ["pipe", "pipe", "inherit"],
});
child.stdout.pipe(process.stdout);
let buffered = Buffer.alloc(0);
let signalled = false;

process.stdin.on("data", (chunk) => {
  buffered = Buffer.concat([buffered, chunk]).subarray(-65_536);
  const interrupt = !signalled && buffered.includes(".mokly-consumer.cjs");
  if (interrupt) signalled = true;
  child.stdin.write(chunk, (error) => {
    if (error || !interrupt) return;
    fs.writeFileSync(marker, "interrupted");
    process.kill(-process.ppid, "SIGINT");
  });
});
process.stdin.on("end", () => child.stdin.end());
child.stdin.on("error", () => undefined);
child.once("error", (error) => {
  process.stderr.write(String(error));
  process.exitCode = 1;
});
child.once("close", (code) => {
  process.stdin.destroy();
  process.exitCode = code ?? 1;
});
`;
