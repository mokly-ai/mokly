import type { MessagePort } from "node:worker_threads";

let paths: MessagePort | undefined;
let sequence = 0;
let state: Int32Array;
const waitAsync = (
  Atomics as typeof Atomics & {
    waitAsync(
      array: Int32Array,
      index: number,
      value: number,
    ): { value: Promise<string> };
  }
).waitAsync;

export function initialize(data: {
  paths: MessagePort;
  state: SharedArrayBuffer;
}): void {
  paths = data.paths;
  state = new Int32Array(data.state);
  void flushRequests();
}

async function flushRequests(): Promise<void> {
  while (true) {
    let request = Atomics.load(state, 0);
    while (request === 0) {
      await waitAsync(state, 0, 0).value;
      request = Atomics.load(state, 0);
    }
    while (Atomics.load(state, 1) > 0) {
      const active = Atomics.load(state, 1);
      await waitAsync(state, 1, active).value;
    }
    Atomics.store(state, 3, request);
    Atomics.notify(state, 3);
    while (Atomics.load(state, 0) === request)
      await waitAsync(state, 0, request).value;
  }
}

export async function resolve(
  specifier: string,
  context: Record<string, unknown>,
  nextResolve: (
    specifier: string,
    context: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  while (Atomics.load(state, 0) !== 0) {
    const request = Atomics.load(state, 0);
    await waitAsync(state, 0, request).value;
  }
  Atomics.add(state, 1, 1);
  try {
    const result = await nextResolve(specifier, context);
    if (typeof result.url === "string" && result.url.startsWith("file:")) {
      const sequenceId = ++sequence;
      Atomics.store(state, 2, sequenceId);
      paths?.postMessage({
        kind: "path",
        sequence: sequenceId,
        url: result.url,
      });
    }
    return result;
  } finally {
    Atomics.sub(state, 1, 1);
    Atomics.notify(state, 1);
  }
}
