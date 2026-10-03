import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

interface WatchedResourceOptions<Value> {
  readonly origin: string;
  readonly previous: number;
  readonly resource: string;
  readonly edit: () => Promise<void>;
  readonly read: (response: Response) => Promise<Value>;
  readonly accept: (value: Value) => boolean;
  readonly timeoutMs?: number;
  readonly fetcher?: typeof fetch;
}

const restartErrors = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_DESTROYED",
  "UND_ERR_CLOSED",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function restartError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current !== null; depth += 1) {
    if (typeof current !== "object") return false;
    const cause = current as { code?: unknown; cause?: unknown };
    if (typeof cause.code === "string" && restartErrors.has(cause.code))
      return true;
    current = cause.cause;
  }
  return false;
}

function contentVersion(html: string): number {
  const match = /data-mokly-content-version="(\d+)"/.exec(html);
  assert.ok(match, "watched shell has a content version");
  return Number(match[1]);
}

function excerpt(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value.slice(0, 80));
  if (value instanceof Uint8Array)
    return `0x${Buffer.from(value.subarray(0, 24)).toString("hex")}`;
  return String(value).slice(0, 80);
}

export async function waitForWatchedResource<Value>(
  options: WatchedResourceOptions<Value>,
): Promise<Value> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 25_000,
  );
  const fetcher = options.fetcher ?? fetch;
  let edited = false;
  let lastVersion = options.previous;
  let lastContentVersion: number | undefined;
  let lastResourceStatus = "not requested";
  let lastResourceValue = "not read";
  try {
    let initialContent: number | undefined;
    while (initialContent === undefined && !controller.signal.aborted) {
      try {
        const response = await fetcher(options.origin, {
          signal: controller.signal,
        });
        assert.equal(response.status, 200);
        initialContent = contentVersion(await response.text());
      } catch (error) {
        if (controller.signal.aborted) break;
        if (!restartError(error)) throw error;
        try {
          await delay(30, undefined, { signal: controller.signal });
        } catch {
          break;
        }
      }
    }
    if (initialContent === undefined)
      throw new Error("watched shell was unavailable before the edit");
    lastContentVersion = initialContent;
    while (!controller.signal.aborted) {
      try {
        const response = await fetcher(`${options.origin}/__mokly/events`, {
          signal: controller.signal,
        });
        assert.equal(response.status, 200);
        assert.ok(response.body);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffered += decoder.decode(value, { stream: true });
            let end = buffered.indexOf("\n\n");
            while (end !== -1) {
              const event = buffered.slice(0, end);
              buffered = buffered.slice(end + 2);
              const kind = /^event: (\w+)/m.exec(event)?.[1];
              const version = Number(/^data: (\d+)/m.exec(event)?.[1]);
              if (!edited && kind === "ready") {
                edited = true;
                await options.edit();
              }
              if (
                edited &&
                Number.isSafeInteger(version) &&
                version > options.previous &&
                (kind === "ready" || kind === "update")
              ) {
                lastVersion = version;
                const shell = await fetcher(options.origin, {
                  signal: controller.signal,
                });
                assert.equal(shell.status, 200);
                lastContentVersion = contentVersion(await shell.text());
                let resource: Response;
                try {
                  resource = await fetcher(options.resource, {
                    signal: controller.signal,
                  });
                } catch (error) {
                  lastResourceStatus = "transport failure";
                  throw error;
                }
                lastResourceStatus = String(resource.status);
                if (resource.status === 200) {
                  const result = await options.read(resource);
                  lastResourceValue = excerpt(result);
                  if (options.accept(result)) return result;
                } else lastResourceValue = excerpt(await resource.text());
              }
              end = buffered.indexOf("\n\n");
            }
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        await delay(30, undefined, { signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) break;
        if (!restartError(error)) throw error;
        try {
          await delay(30, undefined, { signal: controller.signal });
        } catch {
          break;
        }
      }
    }
    throw new Error(
      `watched resource did not reach the expected state after version ${options.previous}; last content version ${lastContentVersion ?? "unknown"}; last update version ${lastVersion}; last resource status ${lastResourceStatus}; last resource value ${lastResourceValue}`,
    );
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

/** Assert a watched source edit produces a browser-visible update event. */
export async function waitForBrowserReload(
  url: string,
  previous: number,
  edit: () => Promise<void>,
  timeoutMs = 25_000,
): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let edited = false;
  try {
    while (!controller.signal.aborted) {
      const response = await fetch(`${url}/__mokly/events`, {
        signal: controller.signal,
      });
      assert.equal(response.status, 200);
      assert.ok(response.body);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        let end = buffered.indexOf("\n\n");
        while (end !== -1) {
          const event = buffered.slice(0, end);
          buffered = buffered.slice(end + 2);
          const kind = /^event: (\w+)/m.exec(event)?.[1];
          const version = Number(/^data: (\d+)/m.exec(event)?.[1]);
          if (!edited && kind === "ready") {
            edited = true;
            await edit();
          }
          if (
            edited &&
            version > previous &&
            (kind === "update" || kind === "ready")
          )
            return version;
          end = buffered.indexOf("\n\n");
        }
      }
    }
    throw new Error("watched server closed without a browser reload");
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
