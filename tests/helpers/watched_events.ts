import assert from "node:assert/strict";

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
