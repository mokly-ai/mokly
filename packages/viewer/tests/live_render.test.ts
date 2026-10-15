import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeProps } from "../src/components/codec.js";
import {
  ComponentRenderError,
  renderStatus,
  type ComponentRenderRequest,
} from "../src/components/render_types.js";
import type { StandaloneWindow } from "../src/standalone/data_source.js";
import { standaloneLiveSource } from "../src/standalone/live_source.js";

import { liveDescriptor } from "./data_fakes.js";

const ORIGIN = "http://localhost:4810";
const TOKEN = "token";
const descriptor = liveDescriptor("9".repeat(64));

const request: ComponentRenderRequest = {
  entryPath: "components/action",
  viewport: "mobile",
  colorScheme: "light",
  revision: 4,
  pageId: "0123456789abcdef0123456789abcdef",
  overrides: { label: { kind: "set", value: "Go" } },
};

/** The render route of Serve: token, method, revision fence, then one answer. */
function fakeServe(options: {
  installed?: number;
  status?: number;
  answer?: (body: ComponentRenderRequest) => unknown;
}) {
  const received: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: URL, init: RequestInit): Promise<Response> => {
    received.push({ url: url.href, init });
    const reply = (status: number, body?: unknown) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        url: url.href,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => body,
      }) as Response;
    if (init.method === "HEAD")
      return reply(url.pathname.includes("/expired/") ? 410 : 200);
    const headers = init.headers as Record<string, string>;
    if (headers["x-mokly-render-token"] !== TOKEN) return reply(403);
    if (init.method !== "POST") return reply(405);
    const body = JSON.parse(String(init.body)) as ComponentRenderRequest;
    if (options.status) return reply(options.status);
    if (body.revision !== (options.installed ?? 4)) return reply(409);
    return reply(
      200,
      options.answer?.(body) ?? {
        renderId: "r-1",
        revision: body.revision,
        previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
        props: encodeProps({ label: "Go" }),
        usage: { status: "ready", instances: [], slots: [], ranges: [] },
      },
    );
  };
  const win: StandaloneWindow = {
    location: { href: `${ORIGIN}/view/components/action/`, reload() {} },
    fetch,
  };
  return { live: standaloneLiveSource(win), received };
}

const signal = new AbortController().signal;

test("a render request posts the installed revision with the render token", async () => {
  const serve = fakeServe({});
  const result = await serve.live.render(descriptor, request, signal);
  assert.deepEqual(result, {
    renderId: "r-1",
    revision: 4,
    previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
    props: encodeProps({ label: "Go" }),
    usage: { status: "ready", instances: [], slots: [], ranges: [] },
  });
  const sent = serve.received[0]!;
  assert.equal(sent.url, `${ORIGIN}/mokly-viewer/components/render`);
  assert.equal(sent.init.method, "POST");
  assert.equal(sent.init.credentials, "same-origin");
  assert.deepEqual(sent.init.headers, {
    "content-type": "application/json",
    "x-mokly-render-token": TOKEN,
  });
  assert.deepEqual(JSON.parse(String(sent.init.body)), request);
});

test("an older revision is refused with the stale-revision code", async () => {
  const serve = fakeServe({ installed: 5 });
  await assert.rejects(
    serve.live.render(descriptor, request, signal),
    (error) =>
      error instanceof ComponentRenderError &&
      error.code === "stale-revision" &&
      error.message === "The catalogue changed. Try again.",
  );
});

test("each route status maps to its code", async () => {
  for (const [code, status] of Object.entries(renderStatus)) {
    const serve = fakeServe({ status });
    await assert.rejects(
      serve.live.render(descriptor, request, signal),
      (error) => error instanceof ComponentRenderError && error.code === code,
    );
  }
  await assert.rejects(
    fakeServe({}).live.render(
      { ...descriptor, render: { ...descriptor.render, token: "stolen" } },
      request,
      signal,
    ),
    (error) =>
      error instanceof ComponentRenderError && error.code === "forbidden",
  );
});

test("an answer for another revision or preview is refused", async () => {
  const answers: ((body: ComponentRenderRequest) => unknown)[] = [
    (body) => ({ renderId: "r-1", revision: body.revision + 1 }),
    () => ({
      renderId: "r-1",
      revision: 4,
      previewUrl: "/mokly-viewer/components/renders/r-2/index.html",
      props: {},
      usage: { status: "ready", instances: [], slots: [], ranges: [] },
    }),
    () => ({
      renderId: "../r",
      revision: 4,
      previewUrl: "/mokly-viewer/components/renders/../r/index.html",
      props: {},
      usage: { status: "ready", instances: [], slots: [], ranges: [] },
    }),
    () => ({
      renderId: "r-1",
      revision: 4,
      previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
      props: {},
      usage: { status: "pending" },
    }),
  ];
  for (const answer of answers)
    await assert.rejects(
      fakeServe({ answer }).live.render(descriptor, request, signal),
      (error) =>
        error instanceof ComponentRenderError &&
        error.code === "invalid-response",
    );
});

test("an answer's additive fields are ignored", async () => {
  const serve = fakeServe({
    answer: (body) => ({
      renderId: "r-1",
      revision: body.revision,
      previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
      props: {},
      usage: {
        status: "ready",
        instances: [],
        slots: [],
        ranges: [],
        later: true,
      },
      later: { added: true },
    }),
  });
  assert.deepEqual(await serve.live.render(descriptor, request, signal), {
    renderId: "r-1",
    revision: 4,
    previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
    props: {},
    usage: { status: "ready", instances: [], slots: [], ranges: [] },
  });
});

test("expiry checks only the preview URLs Serve issued", async () => {
  const serve = fakeServe({});
  assert.equal(
    await serve.live.previewExpired(
      "/mokly-viewer/components/renders/expired/index.html",
      signal,
    ),
    true,
  );
  assert.equal(
    await serve.live.previewExpired(
      "/mokly-viewer/components/renders/r-1/index.html",
      signal,
    ),
    false,
  );
  assert.equal(
    await serve.live.previewExpired("https://elsewhere.test/x", signal),
    false,
  );
  assert.equal(
    await serve.live.previewExpired("/view/expired/", signal),
    false,
  );
  assert.deepEqual(
    serve.received.map((sent) => [sent.init.method, sent.init.cache]),
    [
      ["HEAD", "no-store"],
      ["HEAD", "no-store"],
    ],
  );
});
