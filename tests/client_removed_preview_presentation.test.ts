import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PREVIEW_DOCUMENT_BYTES,
  createPreviewPresentationLoader,
} from "../packages/viewer/dist/previews/presentation.js";
import type { LoadedPreview } from "../packages/viewer/dist/previews/request.js";

const GENERATION =
  "https://catalogue.test/__mokly/diffs/__generations/presentation/";
const SNAPSHOT = `${GENERATION}snapshots/before/archive/removed.html`;

interface FetchCall {
  accept: string | null;
  credentials: RequestCredentials | undefined;
  signal: AbortSignal | null;
  url: string;
}

function loaded(): LoadedPreview {
  return {
    content: { kind: "page", url: SNAPSHOT },
    generation: GENERATION,
    url: `${GENERATION}review.json`,
  };
}

function documentFixture(): Document {
  let baseHref = "";
  const base = {
    setAttribute(_name: string, value: string) {
      baseHref = value;
    },
  };
  const head = {
    firstChild: null,
    insertBefore() {
      return base;
    },
  };
  const root = {
    get outerHTML() {
      return `<html><head><base href="${baseHref}"></head><body>Archived</body></html>`;
    },
  };
  return {
    body: {},
    createElement: () => base,
    doctype: null,
    documentElement: root,
    head,
    querySelector: () => null,
    querySelectorAll: () => [],
  } as unknown as Document;
}

function byteBody(size: number): ReadableStream<Uint8Array> {
  const bytes = new Uint8Array(1024 * 1024).fill(97);
  let remaining = size;
  return new ReadableStream({
    pull(controller) {
      if (remaining === 0) {
        controller.close();
        return;
      }
      const length = Math.min(bytes.byteLength, remaining);
      controller.enqueue(bytes.subarray(0, length));
      remaining -= length;
    },
  });
}

function response(
  url: string,
  options: {
    body?: BodyInit | null;
    contentType?: string;
    status?: number;
  } = {},
): Response {
  const value = new Response(options.body ?? "<p>Archived</p>", {
    headers: {
      "content-type": options.contentType ?? "text/html; charset=utf-8",
    },
    status: options.status ?? 200,
  });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

function environment(value: () => Response) {
  const calls: FetchCall[] = [];
  return {
    calls,
    value: {
      baseUrl: GENERATION,
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        calls.push({
          accept: headers.get("accept"),
          credentials: init?.credentials,
          signal: init?.signal ?? null,
          url: String(input),
        });
        return value();
      },
      parse: () => documentFixture(),
    },
  };
}

test("pinned presentations accept extensionless delivery and cache by address", async () => {
  const fetch = environment(() => response(SNAPSHOT.slice(0, -5)));
  const loader = createPreviewPresentationLoader(
    loaded(),
    { kind: "pinned", comparisonUrl: `${GENERATION}review.json` },
    fetch.value,
  );
  const signal = AbortSignal.timeout(5_000);
  const [first, second] = await Promise.all([
    loader.load(SNAPSHOT, signal),
    loader.load(SNAPSHOT, signal),
  ]);
  const third = await loader.load(SNAPSHOT, signal);
  assert.equal(first, second);
  assert.equal(first, third);
  assert.equal(first.snapshotAddress, SNAPSHOT);
  assert.match(first.srcdoc, new RegExp(`<base href="${SNAPSHOT}">`));
  assert.deepEqual(fetch.calls, [
    {
      accept: "text/html",
      credentials: "omit",
      signal,
      url: SNAPSHOT,
    },
  ]);
});

test("live presentations use same-origin credentials", async () => {
  const fetch = environment(() => response(SNAPSHOT));
  const loader = createPreviewPresentationLoader(
    loaded(),
    { kind: "live" },
    fetch.value,
  );
  await loader.load(SNAPSHOT, AbortSignal.timeout(5_000));
  assert.equal(fetch.calls[0]?.credentials, "same-origin");
});

test("historical fetches reject responses outside the acceptance contract", async () => {
  const cases = [
    response(SNAPSHOT.replace("removed.html", "other.html")),
    response(SNAPSHOT.replace("catalogue.test", "other.test")),
    response(`${SNAPSHOT}?changed=1`),
    response(SNAPSHOT, { contentType: "application/octet-stream" }),
    response(SNAPSHOT, { status: 404 }),
  ];
  for (const candidate of cases) {
    const fetch = environment(() => candidate);
    const loader = createPreviewPresentationLoader(
      loaded(),
      { kind: "live" },
      fetch.value,
    );
    await assert.rejects(
      loader.load(SNAPSHOT, AbortSignal.timeout(5_000)),
      /previous version is unavailable/i,
    );
  }
});

test("historical fetches count the body instead of trusting its headers", async () => {
  const fetch = environment(() => {
    const value = response(SNAPSHOT, {
      body: byteBody(MAX_PREVIEW_DOCUMENT_BYTES + 1),
    });
    value.headers.set("content-length", "1");
    return value;
  });
  const loader = createPreviewPresentationLoader(
    loaded(),
    { kind: "live" },
    fetch.value,
  );
  await assert.rejects(
    loader.load(SNAPSHOT, AbortSignal.timeout(5_000)),
    /previous version is unavailable/i,
  );
});

test("a loader never fetches outside its generation snapshot prefix", async () => {
  const fetch = environment(() => response(SNAPSHOT));
  const loader = createPreviewPresentationLoader(
    loaded(),
    { kind: "live" },
    fetch.value,
  );
  for (const address of [
    `${GENERATION}snapshots/after/archive/removed.html`,
    `${GENERATION}snapshots/before/`,
    SNAPSHOT.replace("catalogue.test", "other.test"),
    `${SNAPSHOT}?changed=1`,
  ])
    await assert.rejects(
      loader.load(address, AbortSignal.timeout(5_000)),
      /previous version is unavailable/i,
    );
  assert.deepEqual(fetch.calls, []);
  assert.throws(
    () =>
      createPreviewPresentationLoader(
        {
          ...loaded(),
          generation: GENERATION.replace("catalogue.test", "other.test"),
        },
        { kind: "live" },
        fetch.value,
      ),
    /previous version is unavailable/i,
  );
});

test("cancellation stops a historical response body read", async () => {
  let cancelled = false;
  const fetch = environment(() =>
    response(SNAPSHOT, {
      body: new ReadableStream({
        cancel() {
          cancelled = true;
        },
        start() {},
      }),
    }),
  );
  const loader = createPreviewPresentationLoader(
    loaded(),
    { kind: "live" },
    fetch.value,
  );
  const controller = new AbortController();
  const pending = loader.load(SNAPSHOT, controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(cancelled, true);
});
