import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  renewPreview,
  requestPreview,
} from "../packages/viewer/dist/previews/request.js";
import type { ReviewResultV4 } from "../packages/viewer/dist/review/component_types.js";
import type { RemovedPreviewData } from "../packages/viewer/dist/shell/previews.js";

const GENERATION = "b".repeat(64);
const COMPARISON = `/__mokly/diffs/__generations/${GENERATION}/review.json`;

const removedPage: RemovedPreviewData = {
  id: "removed-page",
  kind: "page",
  title: "Removed page",
};

const removedScreen: RemovedPreviewData = {
  id: "removed-screen",
  kind: "screen",
  title: "Removed screen",
};

const pagePath = `__mokly/diffs/__generations/${GENERATION}/pages/removed-page.json`;

function review(
  views: ReviewResultV4["screens"][number]["views"],
  baseCommit = "a".repeat(40),
) {
  return {
    schemaVersion: 4,
    baseRef: "origin/main",
    baseCommit,
    changedPaths: [],
    sharedImpact: [],
    ignoredImpact: [],
    affectedConsumers: [],
    changes: [],
    components: [],
    screens: [
      {
        before: { id: "removed-screen", title: "Removed screen" },
        ...(views.some((view) => view.state !== "removed")
          ? { after: { id: "removed-screen", title: "Removed screen" } }
          : {}),
        id: "removed-screen",
        title: "Removed screen",
        state: "removed",
        dependencies: [],
        sharedImpact: [],
        views,
      },
    ],
  } satisfies ReviewResultV4;
}

function snapshotId(
  sourceKind: "baseline" | "generation",
  sourceIdentity: string,
  data: RemovedPreviewData,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "mokly-historical-snapshot-v2",
        "c".repeat(64),
        sourceKind,
        sourceIdentity,
        data.kind,
        data.id,
      ]),
    )
    .digest("hex");
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
      },
      {
        viewport: "desktop",
        colorScheme: "light",
        state: "removed",
        ignoredIds: [],
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
  assert.equal(
    loaded.generation,
    `https://catalogue.test/__mokly/diffs/__generations/${GENERATION}/`,
  );
  assert.deepEqual(loaded.content, {
    kind: "screen",
    views: [
      {
        colorScheme: "light",
        viewport: "mobile",
        url: `https://catalogue.test/__mokly/diffs/__generations/${GENERATION}/snapshots/before/screens/removed-screen.mobile.html`,
      },
      {
        colorScheme: "light",
        viewport: "desktop",
        url: `https://catalogue.test/__mokly/diffs/__generations/${GENERATION}/snapshots/before/screens/removed-screen.desktop.html`,
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
      },
    ]),
    generation,
  );
  await assert.rejects(
    requestPreview(
      { ...removedScreen, id: "other" },
      { endpoint: new URL(generation) },
      missing.win,
      AbortSignal.timeout(5_000),
    ),
    /previous version is unavailable/,
  );
});

test("a historical response must belong to the selected baseline", async () => {
  const generation = `https://catalogue.test${COMPARISON}`;
  const selected = {
    ...removedScreen,
    catalogueIdentity: "c".repeat(64),
    snapshotId: snapshotId("baseline", "a".repeat(40), removedScreen),
  };
  const views: ReviewResultV4["screens"][number]["views"] = [
    {
      viewport: "mobile",
      colorScheme: "light",
      state: "removed",
      ignoredIds: [],
    },
  ];

  const exact = respond(review(views), generation);
  await requestPreview(
    selected,
    { endpoint: new URL(generation) },
    exact.win,
    AbortSignal.timeout(5_000),
  );

  const laterBaseline = respond(review(views, "d".repeat(40)), generation);
  await assert.rejects(
    requestPreview(
      selected,
      { endpoint: new URL(generation) },
      laterBaseline.win,
      AbortSignal.timeout(5_000),
    ),
    /previous version is unavailable/,
  );
});

test("a generation-backed selection accepts only its immutable generation", async () => {
  const selected = {
    ...removedScreen,
    catalogueIdentity: "c".repeat(64),
    snapshotId: snapshotId("generation", GENERATION, removedScreen),
  };
  const views: ReviewResultV4["screens"][number]["views"] = [
    {
      viewport: "mobile",
      colorScheme: "light",
      state: "removed",
      ignoredIds: [],
    },
  ];
  const wrongGeneration = "d".repeat(64);
  const endpoint = `https://catalogue.test/__mokly/diffs/__generations/${wrongGeneration}/review.json`;
  const response = respond(review(views), endpoint);

  await assert.rejects(
    requestPreview(
      selected,
      { endpoint: new URL(endpoint) },
      response.win,
      AbortSignal.timeout(5_000),
    ),
    /previous version is unavailable/,
  );
});

test("a page response cannot replace its selected baseline or generation", async () => {
  const selectedBaseline = {
    ...removedPage,
    catalogueIdentity: "c".repeat(64),
    snapshotId: snapshotId("baseline", "a".repeat(40), removedPage),
  };
  const payload = {
    schemaVersion: 2,
    baseRef: "origin/main",
    baseCommit: "d".repeat(40),
    id: removedPage.id,
  };
  const endpoint = new URL(`https://catalogue.test/${pagePath}`);
  const generation = new URL(`https://catalogue.test${COMPARISON}`);
  const stale = respond(payload, endpoint.href);
  await assert.rejects(
    requestPreview(
      selectedBaseline,
      { endpoint, generation },
      stale.win,
      AbortSignal.timeout(5_000),
    ),
    /previous version is unavailable/,
  );

  const selectedGeneration = {
    ...removedPage,
    catalogueIdentity: "c".repeat(64),
    snapshotId: snapshotId("generation", GENERATION, removedPage),
  };
  const redirectedUrl = endpoint.href.replace(GENERATION, "e".repeat(64));
  const redirected = respond(payload, redirectedUrl);
  await assert.rejects(
    requestPreview(
      selectedGeneration,
      { endpoint, generation },
      redirected.win,
      AbortSignal.timeout(5_000),
    ),
    /previous version is unavailable/,
  );
});

test("a page preview must describe the entry that asked for it", async () => {
  const url = `https://catalogue.test/${pagePath}`;
  const payload = {
    schemaVersion: 2,
    baseRef: "origin/main",
    baseCommit: "a".repeat(40),
    id: "removed-page",
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
    url: `https://catalogue.test/__mokly/diffs/__generations/${GENERATION}/snapshots/before/pages/removed-page.html`,
  });
  const other = respond(
    {
      ...payload,
      id: "other",
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
    generation: `https://catalogue.test/__mokly/diffs/__generations/${GENERATION}/`,
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
