import assert from "node:assert/strict";
import test from "node:test";

import { renewPreview } from "../packages/viewer/dist/previews/request.js";

import {
  COMPARISON,
  GENERATION,
  respond,
} from "./client_removed_preview_requests_fixture.js";

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
