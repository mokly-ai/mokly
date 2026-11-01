import assert from "node:assert/strict";
import test from "node:test";

import { renewPreview } from "../packages/viewer/dist/previews/request.js";

import {
  COMPARISON,
  GENERATION,
  respond,
} from "./helpers/removed_preview_requests.js";

test("a generation that resolved elsewhere is not reused", async () => {
  const loaded = {
    content: { kind: "page", url: "https://catalogue.test/old.html" },
    generation: `https://catalogue.test/mokly-viewer/diffs/generations/${GENERATION}/`,
    url: `https://catalogue.test${COMPARISON}`,
  } as const;
  const same = respond(null, loaded.url);
  assert.equal(
    await renewPreview(
      loaded,
      {
        fetch: async (input, init) => {
          assert.equal(init?.credentials, "omit");
          assert.equal(init?.headers, undefined);
          return same.win.fetch(input, init);
        },
      },
      AbortSignal.timeout(15_000),
    ),
    true,
  );
  assert.deepEqual(same.calls, [{ url: loaded.url, method: "HEAD" }]);
  const moved = respond(null, "https://catalogue.test/elsewhere.json");
  assert.equal(
    await renewPreview(loaded, moved.win, AbortSignal.timeout(15_000)),
    false,
  );
  const otherOrigin = respond(null, `https://elsewhere.test${COMPARISON}`);
  assert.equal(
    await renewPreview(loaded, otherOrigin.win, AbortSignal.timeout(15_000)),
    false,
  );
  const failed = respond(null, loaded.url, false);
  assert.equal(
    await renewPreview(loaded, failed.win, AbortSignal.timeout(15_000)),
    false,
  );
});
