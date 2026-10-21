import { syncBuiltinESMExports } from "node:module";
import { Readable } from "node:stream";
import { Worker } from "node:worker_threads";

/** A separate thread owns stdin, so EOF and parent death can stop a blocked render. */
export function parentInput() {
  const stream = Object.assign(new Readable({ read() {} }), { fd: 0 });
  // Windows cannot bind the watchdog's pipe to a second event loop when a
  // consumer imports node:process and Node evaluates its lazy stdin export.
  Object.defineProperty(process, "stdin", { value: stream });
  syncBuiltinESMExports();
  const worker = new Worker(new URL("./parent-watchdog.js", import.meta.url), {
    workerData: process.ppid,
    execArgv: process.execArgv.filter((arg) => !arg.startsWith("--input-type")),
  });
  const ended = new Promise<void>((resolve) =>
    worker.once("exit", () => resolve()),
  );
  worker.on("error", (error) =>
    stream.destroy(error instanceof Error ? error : new Error(String(error))),
  );
  worker.on(
    "message",
    (message: { chunk?: Uint8Array; end?: boolean; error?: string }) => {
      if (message.error) stream.destroy(new Error(message.error));
      else if (message.end) stream.push(null);
      else if (message.chunk) stream.push(Buffer.from(message.chunk));
    },
  );
  return {
    stream,
    async close() {
      worker.postMessage("close");
      await ended;
      stream.destroy();
    },
  };
}
