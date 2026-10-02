import assert from "node:assert/strict";
import test from "node:test";

import { waitForWatchedResource } from "./helpers/watched_events.js";

const origin = "http://127.0.0.1:12345";
const resource = `${origin}/static/theme.css`;

/** Event stream that stays open until its request aborts, as Serve's does. */
function openEvents(init: RequestInit | undefined, text: string): Response {
  const signal = init?.signal;
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        signal?.addEventListener(
          "abort",
          () => controller.error(signal.reason),
          { once: true },
        );
      },
    }),
    { status: 200 },
  );
}

test(
  "resource wait fails with its diagnostic at the deadline while the event stream stays open",
  { timeout: 5_000 },
  async () => {
    let shells = 0;
    const fetcher = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      if (String(input).endsWith("/__mokly/events"))
        return openEvents(
          init,
          "event: ready\ndata: 1\n\nevent: update\ndata: 2\n\n",
        );
      if (String(input) === origin)
        return new Response(
          `<main data-mokly-content-version="${++shells === 1 ? 1 : 2}">`,
        );
      return new Response(".theme{color:red}", { status: 200 });
    }) as typeof fetch;
    await assert.rejects(
      waitForWatchedResource({
        origin,
        previous: 1,
        resource,
        edit: async () => {},
        read: (response) => response.text(),
        accept: (value) => value.includes("blue"),
        fetcher,
        timeoutMs: 200,
      }),
      /last content version 2.*last update version 2.*last resource status 200.*last resource value .*color:red/u,
    );
  },
);

test(
  "resource wait accepts a second update on the same open event stream",
  { timeout: 5_000 },
  async () => {
    let connections = 0;
    let shells = 0;
    let resources = 0;
    const fetcher = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      if (String(input).endsWith("/__mokly/events")) {
        connections += 1;
        return openEvents(
          init,
          "event: ready\ndata: 1\n\nevent: update\ndata: 2\n\nevent: update\ndata: 3\n\n",
        );
      }
      if (String(input) === origin)
        return new Response(
          `<main data-mokly-content-version="${Math.min(++shells, 3)}">`,
        );
      return new Response(
        ++resources === 1 ? ".theme{color:red}" : ".theme{color:blue}",
        { status: 200 },
      );
    }) as typeof fetch;
    const css = await waitForWatchedResource({
      origin,
      previous: 1,
      resource,
      edit: async () => {},
      read: (response) => response.text(),
      accept: (value) => value.includes("blue"),
      fetcher,
    });
    assert.equal(css, ".theme{color:blue}");
    assert.equal(connections, 1);
    assert.equal(resources, 2);
  },
);
