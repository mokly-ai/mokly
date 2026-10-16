import { EventEmitter, once } from "node:events";

import { serveProcess } from "../../scripts/verification/serve-process.mjs";
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
    const host = await serveStaticFiles(source.directory);
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
  const managed = await serveProcess(args, cwd);
  const { child } = managed;
  const events = new EventEmitter();
  let output = "";
  let failure: unknown;
  const closed = new Promise<void>((resolve) => {
    child.once("error", (error) => {
      failure = error;
      events.emit("output");
      resolve();
    });
    child.once("close", () => {
      events.emit("output");
      resolve();
    });
  });
  for (const stream of [child.stdout, child.stderr])
    stream?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      events.emit("output");
    });
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      if (child.exitCode === null && child.signalCode === null)
        managed.signal("SIGINT");
      const guard = setTimeout(() => managed.signal("SIGKILL"), 10_000);
      try {
        await closed;
      } finally {
        clearTimeout(guard);
      }
      await managed.drain();
      if (failure || child.exitCode !== 0)
        throw new Error(`Example Serve did not stop cleanly:\n${output}`, {
          cause: failure,
        });
    })());
  try {
    await managed.start();
    const signal = AbortSignal.any([
      AbortSignal.timeout(180_000),
      ...(cancellation ? [cancellation] : []),
    ]);
    for (;;) {
      const match = /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/.exec(
        output,
      );
      if (match) return { url: match[1]!, close, diagnostics: () => output };
      if (failure || child.exitCode !== null || child.signalCode !== null)
        throw new Error(`Example Serve exited before readiness:\n${output}`, {
          cause: failure,
        });
      await once(events, "output", { signal });
    }
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
