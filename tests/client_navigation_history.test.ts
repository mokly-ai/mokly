import assert from "node:assert/strict";
import test from "node:test";

import {
  isSameBrowseDocument,
  NavigationSequencer,
} from "../packages/viewer/dist/client/navigation.js";

test("same-document identity includes origin, route and query but excludes hashes", () => {
  const current = new URL(
    "https://example.test/view/component.html?variant=first",
  );
  assert.equal(
    isSameBrowseDocument(current, new URL("#mb-main", current)),
    true,
  );
  for (const next of [
    "https://elsewhere.test/view/component.html?variant=first",
    "/view/other.html?variant=first",
    "?variant=second#mb-main",
    "/view/component.html",
  ])
    assert.equal(
      isSameBrowseDocument(current, new URL(next, current)),
      false,
      next,
    );
});

test("retaining a document invalidates pending route work before the next navigation", () => {
  const sequencer = new NavigationSequencer();
  const pending = sequencer.begin();
  sequencer.cancel();
  assert.equal(pending.signal.aborted, true);
  assert.equal(pending.isCurrent(), false);
  sequencer.cancel();
  const next = sequencer.begin();
  assert.equal(next.signal.aborted, false);
  assert.equal(next.isCurrent(), true);
});
