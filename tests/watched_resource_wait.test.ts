import assert from "node:assert/strict";
import test from "node:test";

import { waitForWatchedResource } from "./helpers/watched_events.js";

const origin = "http://127.0.0.1:12345";
const resource = `${origin}/static/theme.css`;

function events(version: number, update = false): Response {
  return new Response(
    `event: ready\ndata: ${version}\n\n${update ? `event: update\ndata: ${version + 1}\n\n` : ""}`,
    { status: 200 },
  );
}

for (const code of [
  "ECONNREFUSED",
  "ECONNRESET",
  "UND_ERR_SOCKET",
  "EPIPE",
  "ECONNABORTED",
  "UND_ERR_DESTROYED",
  "UND_ERR_CLOSED",
]) {
  test(`resource wait reconnects after ${code}`, async () => {
    let connections = 0;
    let reads = 0;
    let edits = 0;
    let shells = 0;
    const fetcher = (async (input: RequestInfo | URL): Promise<Response> => {
      if (String(input).endsWith("/__mokly/events"))
        return events(++connections === 1 ? 1 : 3, connections === 1);
      if (String(input) === origin)
        return new Response(
          `<main data-mokly-content-version="${++shells === 1 ? 1 : connections === 1 ? 2 : 3}">`,
        );
      assert.equal(String(input), resource);
      if (++reads === 1)
        throw new TypeError("fetch failed", { cause: { code } });
      return new Response(".theme{color:blue}", { status: 200 });
    }) as typeof fetch;
    const css = await waitForWatchedResource({
      origin,
      previous: 1,
      resource,
      edit: async () => {
        edits += 1;
      },
      read: (response) => response.text(),
      accept: (value) => value.includes("blue"),
      fetcher,
    });
    assert.equal(css, ".theme{color:blue}");
    assert.equal(connections, 2);
    assert.equal(reads, 2);
    assert.equal(edits, 1);
  });
}

test("resource wait ignores an old child's evidence update until the new ready", async () => {
  let connections = 0;
  let shells = 0;
  const fetcher = (async (input: RequestInfo | URL): Promise<Response> => {
    if (String(input).endsWith("/__mokly/events"))
      return events(++connections === 1 ? 1 : 3, connections === 1);
    if (String(input) === origin)
      return new Response(
        `<main data-mokly-content-version="${++shells === 1 || connections === 1 ? 1 : 3}">`,
      );
    return new Response(connections === 1 ? "old" : "new", { status: 200 });
  }) as typeof fetch;
  const css = await waitForWatchedResource({
    origin,
    previous: 1,
    resource,
    edit: async () => {},
    read: (response) => response.text(),
    accept: (value) => value === "new",
    fetcher,
  });
  assert.equal(css, "new");
  assert.equal(connections, 2);
});

test("resource wait rethrows unrelated fetch failures", async () => {
  const failure = new TypeError("fetch failed", {
    cause: { code: "EACCES" },
  });
  let shells = 0;
  const fetcher = (async (input: RequestInfo | URL): Promise<Response> => {
    if (String(input).endsWith("/__mokly/events")) return events(1, true);
    if (String(input) === origin)
      return new Response(
        `<main data-mokly-content-version="${++shells === 1 ? 1 : 2}">`,
      );
    throw failure;
  }) as typeof fetch;
  await assert.rejects(
    waitForWatchedResource({
      origin,
      previous: 1,
      resource,
      edit: async () => {},
      read: (response) => response.text(),
      accept: (value) => value === "new",
      fetcher,
    }),
    (error) => error === failure,
  );
});

test("resource wait accepts a later matching content update", async () => {
  let shells = 0;
  let connections = 0;
  let resources = 0;
  const fetcher = (async (input: RequestInfo | URL): Promise<Response> => {
    if (String(input).endsWith("/__mokly/events"))
      return events(++connections === 1 ? 1 : 3, connections === 1);
    if (String(input) === origin)
      return new Response(
        `<main data-mokly-content-version="${++shells === 1 ? 1 : connections === 1 ? 2 : 3}">`,
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
  assert.equal(resources, 2);
});

test("resource wait timeout reports the last versions, status and value", async () => {
  let shells = 0;
  const fetcher = (async (input: RequestInfo | URL): Promise<Response> => {
    if (String(input).endsWith("/__mokly/events")) return events(1, true);
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
});
