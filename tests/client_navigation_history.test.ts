import assert from "node:assert/strict";
import test from "node:test";

import { routeDocumentKey } from "../packages/viewer/dist/shell/routes.js";

test("document identity includes origin, route and query but excludes hashes", () => {
  const current = new URL(
    "https://example.test/view/component.html?variant=first",
  );
  assert.equal(
    routeDocumentKey(current),
    routeDocumentKey(new URL("#mb-main", current)),
  );
  for (const next of [
    "https://elsewhere.test/view/component.html?variant=first",
    "/view/other.html?variant=first",
    "?variant=second#mb-main",
    "/view/component.html",
  ])
    assert.notEqual(
      routeDocumentKey(current),
      routeDocumentKey(new URL(next, current)),
      next,
    );
});
