import { execFile, spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

import { repositoryRoot } from "../helpers/fixture.js";

const execute = promisify(execFile);
const artifactBuilds = new Map<boolean, Promise<string>>();

/** Running Cloudflare Pages preview used by browser integration tests. */
export interface PreviewFixture {
  url: string;
  close(): Promise<void>;
}

/** Build the static artifact and serve it with query-preserving Pages routes. */
export async function startPreviewFixture(
  includeChanges = false,
): Promise<PreviewFixture> {
  const output = await buildPreviewArtifact(includeChanges);
  return await servePreviewFixture(output);
}

async function buildPreviewArtifact(includeChanges: boolean): Promise<string> {
  const retained = artifactBuilds.get(includeChanges);
  if (retained) return await retained;
  const output = path.join(
    repositoryRoot,
    includeChanges
      ? ".context/mokly-preview-changes"
      : ".context/mokly-preview",
  );
  const build = execute(
    "npm",
    [
      "run",
      "preview:build",
      "--",
      "--out",
      output,
      ...(includeChanges ? ["--include-changes"] : []),
    ],
    { cwd: repositoryRoot },
  ).then(() => output);
  artifactBuilds.set(includeChanges, build);
  try {
    return await build;
  } catch (error) {
    if (artifactBuilds.get(includeChanges) === build)
      artifactBuilds.delete(includeChanges);
    throw error;
  }
}

/** Serve an already-published fixture through the real Pages routing runtime. */
export async function servePreviewFixture(
  artifact: string,
): Promise<PreviewFixture> {
  const port = await availablePort();
  const child = spawn(
    process.execPath,
    [
      path.join(repositoryRoot, "node_modules/wrangler/bin/wrangler.js"),
      "pages",
      "dev",
      artifact,
      "--compatibility-date",
      "2026-07-28",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      "0",
    ],
    { cwd: repositoryRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  const output: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  const url = `http://127.0.0.1:${port}`;
  await waitUntilReady(child, url, output);
  return { close: () => stop(child), url };
}

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (!address || typeof address === "string") {
    throw new Error("preview test could not allocate a TCP port");
  }
  return address.port;
}

async function waitUntilReady(
  child: ChildProcess,
  url: string,
  output: readonly string[],
): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`preview exited before startup: ${output.join("")}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The port is expected to refuse connections until workerd is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  await stop(child);
  throw new Error(`preview did not start: ${output.join("")}`);
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), 5_000),
  );
  if (
    (await Promise.race([exited.then(() => "exit" as const), timeout])) ===
    "timeout"
  ) {
    child.kill("SIGKILL");
    await exited;
  }
}
