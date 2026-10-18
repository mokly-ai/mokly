import { Console } from "node:console";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { performance } from "node:perf_hooks";

import { SidecarError, detail } from "./sidecar/errors.js";
import { parentInput } from "./sidecar/parent-input.js";
import { guardParentOutput } from "./sidecar/parent-output.js";
import { requestId } from "./sidecar/request-id.js";
import { request } from "./sidecar/requests.js";
import { Session } from "./sidecar/session.js";
import { timingOutput } from "./sidecar/timing-output.js";
import { Timings } from "./sidecar/timings.js";
import { encodeFrame, encodeResponse, frames } from "./sidecar/transport.js";

const version = (
  JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;
guardParentOutput();
const write = process.stdout.write.bind(process.stdout);
const timings = new Timings(
  performance,
  timingOutput(process.stderr),
  process.pid,
  randomUUID(),
);
globalThis.console = new Console(process.stderr, process.stderr);
process.stdout.write = process.stderr.write.bind(process.stderr);
const send = async (id: string, outcome: object) => {
  const frame = encodeResponse(id, outcome);
  await new Promise<void>((resolve, reject) =>
    write(frame, (error) => (error ? reject(error) : resolve())),
  );
};
const session = new Session(
  version,
  (message) => process.stderr.write(message),
  undefined,
  (operation) => {
    write(
      encodeFrame({
        event: "operation",
        params: { operation, pid: process.pid },
      }),
    );
  },
);
const input = parentInput();
try {
  for await (const value of frames(input.stream)) {
    const received = timings.received();
    let finish: (status: "ok" | "error") => void = () => {};
    let stop = false;
    const id = requestId(value);
    try {
      const call = request(value);
      finish = timings.begin(call, received);
      const result = await session.call(call);
      if (call.method === "hello") timings.enable(call.params.timings ?? false);
      await send(id!, { result });
      finish("ok");
      stop = call.method === "shutdown";
    } catch (error) {
      const code = error instanceof SidecarError ? error.code : "render-failed";
      if (id !== undefined)
        await send(id, {
          error: {
            code,
            message: detail(error),
            ...(error instanceof SidecarError && error.postcss
              ? { postcss: error.postcss }
              : {}),
          },
        });
      else process.stderr.write(detail(error) + "\n");
      finish("error");
      stop = code === "sidecar-protocol";
      if (stop) process.exitCode = 1;
    }
    if (stop) {
      input.stream.destroy();
      break;
    }
  }
} catch (error) {
  process.stderr.write(`[mokly/sidecar-protocol] ${detail(error)}\n`);
  process.exitCode = 1;
} finally {
  await session.dispose();
  await input.close();
}
