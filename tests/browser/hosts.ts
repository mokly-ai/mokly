import fs from "node:fs/promises";
import path from "node:path";

import { startServe } from "../../scripts/verification/serve-process.mjs";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { exampleServerCommand } from "./example_servers.js";

export interface BrowserHost {
  url: string;
  close(): Promise<void>;
  diagnostics?(): string;
}

/** Use the same browser tests with Serve or a plain, already-built site. */
export async function browserHost(
  source:
    | { kind: "serve"; signal?: AbortSignal }
    | { kind: "static"; directory: string },
): Promise<BrowserHost> {
  if (source.kind === "static") {
    const directory = path.resolve(source.directory);
    await requireStaticCatalogue(directory);
    const host = await serveStaticFiles(directory);
    let closing: Promise<void> | undefined;
    return { url: host.url, close: () => (closing ??= host.close()) };
  }
  return serveHost(exampleServerCommand(), repositoryRoot, source.signal);
}

/** Start the shim and wait for its bound address. */
export async function serveHost(
  args: readonly string[],
  cwd: string,
  cancellation?: AbortSignal,
): Promise<BrowserHost> {
  const server = await startServe(args, { cwd });
  const close = async () => {
    const outcome = await server.stop();
    if (outcome.code !== 0)
      throw new Error(
        `Example Serve did not stop cleanly:\n${server.diagnostics()}`,
      );
  };
  try {
    const signal = AbortSignal.any([
      AbortSignal.timeout(180_000),
      ...(cancellation ? [cancellation] : []),
    ]);
    return {
      url: await server.listening(signal),
      close,
      diagnostics: server.diagnostics,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Example startup and cleanup failed",
        { cause: cleanup },
      );
    }
    throw error;
  }
}

/** Fail before launching tests when an output path is missing or incomplete. */
export async function requireStaticCatalogue(directory: string): Promise<void> {
  const root = path.resolve(directory);
  for (const name of [
    "index.html",
    "mokly-viewer/index.json",
    ".mokly-export-artifact",
  ]) {
    try {
      if (!(await fs.stat(path.join(root, name))).isFile())
        throw new Error("not a file");
    } catch {
      throw new Error(
        `Static browser catalogue ${root} is missing required file ${name}`,
      );
    }
  }
}

export { listeningAddress } from "../../scripts/verification/serve-process.mjs";
