import assert from "node:assert/strict";
import test from "node:test";

import { requestPreview } from "../packages/viewer/dist/previews/request.js";
import type { ReviewResultV7 } from "../packages/viewer/dist/review/component_types.js";

import {
  COMPARISON,
  GENERATION,
  pagePath,
  removedPage,
  removedScreen,
  respond,
  review,
  snapshotId,
} from "./helpers/removed_preview_requests.js";

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
    AbortSignal.timeout(15_000),
  );
  assert.equal(loaded.url, generation);
  assert.equal(
    loaded.generation,
    `https://catalogue.test/mokly-viewer/diffs/generations/${GENERATION}/`,
  );
  assert.deepEqual(loaded.content, {
    kind: "screen",
    views: [
      {
        colorScheme: "light",
        viewport: "mobile",
        url: `https://catalogue.test/mokly-viewer/diffs/generations/${GENERATION}/snapshots/before/mokly-generated/removed-screen/index.mobile.html`,
      },
      {
        colorScheme: "light",
        viewport: "desktop",
        url: `https://catalogue.test/mokly-viewer/diffs/generations/${GENERATION}/snapshots/before/mokly-generated/removed-screen/index.desktop.html`,
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
      AbortSignal.timeout(15_000),
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
      { ...removedScreen, path: "other" },
      { endpoint: new URL(generation) },
      missing.win,
      AbortSignal.timeout(15_000),
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
  const views: ReviewResultV7["screens"][number]["views"] = [
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
    AbortSignal.timeout(15_000),
  );

  const laterBaseline = respond(review(views, "d".repeat(40)), generation);
  await assert.rejects(
    requestPreview(
      selected,
      { endpoint: new URL(generation) },
      laterBaseline.win,
      AbortSignal.timeout(15_000),
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
  const views: ReviewResultV7["screens"][number]["views"] = [
    {
      viewport: "mobile",
      colorScheme: "light",
      state: "removed",
      ignoredIds: [],
    },
  ];
  const wrongGeneration = "d".repeat(64);
  const endpoint = `https://catalogue.test/mokly-viewer/diffs/generations/${wrongGeneration}/review.json`;
  const response = respond(review(views), endpoint);

  await assert.rejects(
    requestPreview(
      selected,
      { endpoint: new URL(endpoint) },
      response.win,
      AbortSignal.timeout(15_000),
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
    schemaVersion: 3,
    baseRef: "origin/main",
    baseCommit: "d".repeat(40),
    path: removedPage.path,
  };
  const endpoint = new URL(`https://catalogue.test/${pagePath}`);
  const generation = new URL(`https://catalogue.test${COMPARISON}`);
  const stale = respond(payload, endpoint.href);
  await assert.rejects(
    requestPreview(
      selectedBaseline,
      { endpoint, generation },
      stale.win,
      AbortSignal.timeout(15_000),
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
      AbortSignal.timeout(15_000),
    ),
    /previous version is unavailable/,
  );
});
