import type { MessagePort } from "node:worker_threads";

let paths: MessagePort | undefined;
let sequence = 0;

export function initialize(data: { paths: MessagePort }): void {
  paths = data.paths;
}

export async function resolve(
  specifier: string,
  context: Record<string, unknown>,
  nextResolve: (
    specifier: string,
    context: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const result = await nextResolve(specifier, context);
  if (typeof result.url === "string" && result.url.startsWith("file:")) {
    const sequenceId = ++sequence;
    paths?.postMessage({ kind: "path", sequence: sequenceId, url: result.url });
    paths?.postMessage({ kind: "ack", sequence: sequenceId });
  }
  return result;
}
