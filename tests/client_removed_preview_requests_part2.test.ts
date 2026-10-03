import assert from "node:assert/strict";
import test from "node:test";

import {
  renewPreview,
  requestPreview,
} from "../packages/viewer/dist/previews/request.js";

import {
  COMPARISON,
  GENERATION,
  pagePath,
  removedPage,
  respond,
} from "./client_removed_preview_requests_fixture.js";

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
