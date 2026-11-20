import assert from "node:assert/strict";
import { test } from "node:test";

import { carriedQuery, referenceResolutionHref } from "../../viewer/selection";

import { defaults, removed } from "./fixtures";
import { selection } from "./selection-fixture";

test("a resolution carries every key but the ones it must drop", () => {
  const carried = new URLSearchParams(
    carriedQuery(
      "?branch=main&screen=corrupt&catalogueScreen=start" +
        `&catalogueSnapshot=${removed.snapshotId}&settings=account` +
        "&viewport=both&search=checkout&tag=forms&tag=critical",
    ),
  );
  // The reference the alias named has been replaced by a publication.
  assert.equal(carried.has("branch"), false);
  // React Navigation reserves `screen`, and a resolution is the one place a
  // query the reader supplied crosses into a router navigation. Asserted here
  // rather than through the browser because the router consumes the key
  // itself: the address looks the same either way, so only the application's
  // own rule can be measured, and this is what measures it.
  assert.equal(carried.has("screen"), false);
  // Everything else is the reader's, including a key the viewer does not own.
  assert.equal(carried.get("catalogueScreen"), "start");
  assert.equal(carried.get("settings"), "account");
  assert.equal(carried.get("catalogueSnapshot"), removed.snapshotId);
  assert.equal(carried.get("viewport"), "both");
  assert.equal(carried.get("search"), "checkout");
  assert.deepEqual(carried.getAll("tag"), ["forms", "critical"]);
});

test("a reference resolution preserves untouched query bytes and order", () => {
  const search =
    "?branch=review%26docs%2Bplus%23notes%2F%C3%A9quipe" +
    "&settings=tokens&view=changes&catalogueScreen=notice%2Fdraft" +
    "&viewport=both&scheme=dark&search=notice&tag=a&tag=b" +
    "&handoff=one%26two+literal%2Bplus%23notes&screen=reserved";
  const carried =
    "settings=tokens&view=changes&catalogueScreen=notice%2Fdraft" +
    "&viewport=both&scheme=dark&search=notice&tag=a&tag=b" +
    "&handoff=one%26two+literal%2Bplus%23notes";
  const state = {
    selection: selection({
      view: "changes",
      screen: "notice/draft",
      viewport: "both",
      scheme: "dark",
      search: "notice",
      tags: ["a", "b"],
    }),
  };

  assert.equal(carriedQuery(search), carried);
  assert.equal(
    referenceResolutionHref(
      "/acme/site/publications/p1",
      search,
      state,
      defaults,
      false,
    ),
    `/acme/site/publications/p1?${carried}`,
  );
});

test("a resolution with nothing to carry writes no query", () => {
  assert.equal(carriedQuery(""), "");
  assert.equal(carriedQuery("?branch=main&screen=corrupt"), "");
});
