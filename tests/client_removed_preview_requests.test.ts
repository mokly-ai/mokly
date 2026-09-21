import assert from "node:assert/strict";
import test from "node:test";

import {
  renewPreview,
  requestPreview,
} from "../packages/viewer/dist/previews/request.js";
import type { ReviewResultV2 } from "../packages/viewer/dist/review/types.js";
import type { RemovedPreviewData } from "../packages/viewer/dist/shell/previews.js";

const GENERATION = "b".repeat(64);
const COMPARISON = `/__mokly/diffs/__generations/${GENERATION}/review.json`;

const removedPage: RemovedPreviewData = {
  id: "removed-page",
  kind: "page",
  route: "archive/removed.html",
  title: "Removed page",
};

const removedScreen: RemovedPreviewData = {
  id: "removed-screen",
  kind: "screen",
  route: "screens/removed.html",
  title: "Removed screen",
};

const pagePath = `__mokly/diffs/__generations/${GENERATION}/pages/archive/removed.html.json`;

function review(views: ReviewResultV2["screens"][number]["views"]) {
  return {
    schemaVersion: 2,
    baseRef: "origin/main",
    baseCommit: "a".repeat(40),
    changedPaths: [],
    sharedImpact: [],
    ignoredImpact: [],
    screens: [
      {
        id: "removed-screen",
        route: "screens/removed.html",
        title: "Removed screen",
        state: "removed",
        dependencies: [],
        sharedImpact: [],
        views,
      },
    ],
  } satisfies ReviewResultV2;
}

function respond(payload: unknown, url: string, ok = true) {
  const win = {
    fetch: async (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: init?.method ?? "GET" });
      return {
        ok,
        url,
        json: async () => payload,
      } as unknown as Response;
    },
  } as unknown as Window & typeof globalThis;
  const calls: { url: string; method: string }[] = [];
  return { calls, win };
}

test("a screen preview renders only its captured previous views", async () => {
  const generation = `https://catalogue.test${COMPARISON}`;
  const { win } = respond(
    review([
      {
        viewport: "mobile",
        colorScheme: "light",
        state: "removed",
        ignoredIds: [],
        beforePath: "snapshots/before/screens/removed.mobile.html",
      },
      {
        viewport: "desktop",
        colorScheme: "light",
        state: "removed",
        ignoredIds: [],
        beforePath: "snapshots/before/screens/removed.desktop.html",
      },
    ]),
    generation,
  );
  const loaded = await requestPreview(
    removedScreen,
    { endpoint: new URL(generation) },
    win,
    AbortSignal.timeout(5_000),
  );
  assert.equal(loaded.url, generation);
  assert.deepEqual(loaded.content, {
    kind: "screen",
    views: [
      {
        colorScheme: "light",
        viewport: "mobile",
        url: `https://catalogue.test/__mokly/diffs/__generations/${GENERATION}/snapshots/before/screens/removed.mobile.html`,
      },
      {
        colorScheme: "light",
        viewport: "desktop",
        url: `https://catalogue.test/__mokly/diffs/__generations/${GENERATION}/snapshots/before/screens/removed.desktop.html`,
      },
    ],
  });
});

test("a reused or stale generation is treated as unavailable", async () => {
  const generation = `https://catalogue.test${COMPARISON}`;
  const { win } = respond(
    review([
      {
        viewport: "mobile",
        colorScheme: "light",
        state: "changed",
        ignoredIds: [],
        beforePath: "snapshots/before/screens/removed.mobile.html",
        afterPath: "snapshots/after/screens/removed.mobile.html",
      },
    ]),
    generation,
  );
  await assert.rejects(
    requestPreview(
      removedScreen,
      { endpoint: new URL(generation) },
      win,
      AbortSignal.timeout(5_000),
    ),
    /previous version is unavailable/,
  );
  const missing = respond(
    review([
      {
        viewport: "mobile",
        colorScheme: "light",
        state: "removed",
        ignoredIds: [],
        beforePath: "snapshots/before/screens/removed.mobile.html",
      },
    ]),
    generation,
  );
  await assert.rejects(
    requestPreview(
      { ...removedScreen, route: "screens/other.html" },
      { endpoint: new URL(generation) },
      missing.win,
      AbortSignal.timeout(5_000),
    ),
    /previous version is unavailable/,
  );
});

test("a page preview must describe the entry that asked for it", async () => {
  const url = `https://catalogue.test/${pagePath}`;
  const payload = {
    schemaVersion: 1,
    baseRef: "origin/main",
    baseCommit: "a".repeat(40),
    route: "archive/removed.html",
    documentPath: "snapshots/before/archive/removed.html",
  };
  const matching = respond(payload, url);
  const request = {
    endpoint: new URL(url),
    generation: new URL(`https://catalogue.test${COMPARISON}`),
  };
  const loaded = await requestPreview(
    removedPage,
    request,
    matching.win,
    AbortSignal.timeout(5_000),
  );
  assert.deepEqual(loaded.content, {
    kind: "page",
    url: `https://catalogue.test/__mokly/diffs/__generations/${GENERATION}/snapshots/before/archive/removed.html`,
  });
  const other = respond(
    {
      ...payload,
      route: "archive/other.html",
      documentPath: "snapshots/before/archive/other.html",
    },
    url,
  );
  await assert.rejects(
    requestPreview(removedPage, request, other.win, AbortSignal.timeout(5_000)),
    /previous version is unavailable/,
  );
});

test("a generation that resolved elsewhere is not reused", async () => {
  const loaded = {
    content: { kind: "page", url: "https://catalogue.test/old.html" },
    url: `https://catalogue.test${COMPARISON}`,
  } as const;
  const same = respond(null, loaded.url);
  assert.equal(
    await renewPreview(loaded, same.win, AbortSignal.timeout(5_000)),
    true,
  );
  assert.deepEqual(same.calls, [{ url: loaded.url, method: "HEAD" }]);
  const moved = respond(null, "https://catalogue.test/elsewhere.json");
  assert.equal(
    await renewPreview(loaded, moved.win, AbortSignal.timeout(5_000)),
    false,
  );
  const failed = respond(null, loaded.url, false);
  assert.equal(
    await renewPreview(loaded, failed.win, AbortSignal.timeout(5_000)),
    false,
  );
});
