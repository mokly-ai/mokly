import type { MessagePort } from "node:worker_threads";

let paths: MessagePort | undefined;

export function initialize(data: { paths: MessagePort }): void {
  paths = data.paths;
  paths.on("message", (message: unknown) => {
    if (
      message &&
      typeof message === "object" &&
      "kind" in message &&
      message.kind === "flush" &&
      "id" in message &&
      typeof message.id === "number"
    )
      paths?.postMessage({ kind: "flushed", id: message.id });
  });
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
  if (typeof result.url === "string" && result.url.startsWith("file:"))
    paths?.postMessage({ kind: "path", url: result.url });
  return result;
}
