import assert from "node:assert/strict";
import test from "node:test";

import { requestPreview } from "../packages/viewer/dist/previews/request.js";
import type { ReviewView } from "../packages/viewer/dist/review/types.js";

import {
  COMPARISON,
  GENERATION,
  pagePath,
  removedDetail,
  removedPage,
  removedScreen,
  respond,
  screenPath,
  snapshotId,
} from "./helpers/removed_preview_requests.js";

const generation = new URL(`https://catalogue.test${COMPARISON}`);
const endpoint = new URL(`https://catalogue.test/${screenPath}`);

function removed(viewport: ReviewView["viewport"]): ReviewView {
  return { viewport, colorScheme: "light", state: "removed", ignoredIds: [] };
}

test("a screen preview renders only its captured previous views", async () => {
  const { calls, win } = respond(
    removedDetail([removed("mobile"), removed("desktop")]),
    endpoint.href,
  );
  const loaded = await requestPreview(
    removedScreen,
    { endpoint, generation },
    win,
    AbortSignal.timeout(15_000),
  );
  assert.deepEqual(calls, [{ url: endpoint.href, method: "GET" }]);
  assert.equal(loaded.url, endpoint.href);
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

test("a detail without a removed view or for another entry is unavailable", async () => {
  const changed = respond(
    removedDetail([{ ...removed("mobile"), state: "changed" }]),
    endpoint.href,
  );
  await assert.rejects(
    requestPreview(
      removedScreen,
      { endpoint, generation },
      changed.win,
      AbortSignal.timeout(15_000),
    ),
    /previous version is unavailable/,
  );
  const other = respond(
    removedDetail([removed("mobile")], undefined, "other"),
    endpoint.href,
  );
  await assert.rejects(
    requestPreview(
      removedScreen,
      { endpoint, generation },
      other.win,
      AbortSignal.timeout(15_000),
    ),
    /previous version is unavailable/,
  );
  const missing = respond(undefined, endpoint.href, false);
  await assert.rejects(
    requestPreview(
      removedScreen,
      { endpoint, generation },
      missing.win,
      AbortSignal.timeout(15_000),
    ),
    /previous version is unavailable/,
  );
});

test("a removed screen's detail must name the selected snapshot", async () => {
  const selected = {
    ...removedScreen,
    catalogueIdentity: "c".repeat(64),
    snapshotId: snapshotId("a".repeat(40), removedScreen),
  };
  const views = [removed("mobile")];

  const exact = respond(
    removedDetail(views, selected.snapshotId),
    endpoint.href,
  );
  await requestPreview(
    selected,
    { endpoint, generation },
    exact.win,
    AbortSignal.timeout(15_000),
  );

  const laterBaseline = respond(
    removedDetail(views, snapshotId("d".repeat(40), removedScreen)),
    endpoint.href,
  );
  await assert.rejects(
    requestPreview(
      selected,
      { endpoint, generation },
      laterBaseline.win,
      AbortSignal.timeout(15_000),
    ),
    /previous version is unavailable/,
  );
});

test("a snapshot id that names a generation instead of its base is unavailable", async () => {
  const selected = {
    ...removedScreen,
    catalogueIdentity: "c".repeat(64),
    snapshotId: snapshotId(GENERATION, removedScreen, "generation"),
  };
  const response = respond(
    removedDetail(
      [removed("mobile")],
      snapshotId("a".repeat(40), removedScreen),
    ),
    endpoint.href,
  );

  await assert.rejects(
    requestPreview(
      selected,
      { endpoint, generation },
      response.win,
      AbortSignal.timeout(15_000),
    ),
    /previous version is unavailable/,
  );
});

test("a page response must belong to the selected base", async () => {
  const selected = {
    ...removedPage,
    catalogueIdentity: "c".repeat(64),
    snapshotId: snapshotId("a".repeat(40), removedPage),
  };
  const payload = (baseCommit: string) => ({
    schemaVersion: 3,
    baseRef: "origin/main",
    baseCommit,
    path: removedPage.path,
  });
  const page = new URL(`https://catalogue.test/${pagePath}`);
  const exact = respond(payload("a".repeat(40)), page.href);
  const loaded = await requestPreview(
    selected,
    { endpoint: page, generation },
    exact.win,
    AbortSignal.timeout(15_000),
  );
  assert.equal(
    loaded.generation,
    `https://catalogue.test/mokly-viewer/diffs/generations/${GENERATION}/`,
  );

  const stale = respond(payload("d".repeat(40)), page.href);
  await assert.rejects(
    requestPreview(
      selected,
      { endpoint: page, generation },
      stale.win,
      AbortSignal.timeout(15_000),
    ),
    /previous version is unavailable/,
  );

  const named = {
    ...selected,
    snapshotId: snapshotId(GENERATION, removedPage, "generation"),
  };
  await assert.rejects(
    requestPreview(
      named,
      { endpoint: page, generation },
      exact.win,
      AbortSignal.timeout(15_000),
    ),
    /previous version is unavailable/,
  );
});
