import assert from "node:assert/strict";
import { test } from "node:test";

import { readBuildAddressState } from "../../viewer/build-address";

test("a build address keeps its panel and corrects every selection key away", () => {
  const defaults = { scheme: "light" as const, publication: false };
  const plain = readBuildAddressState({ panel: "history" }, defaults);
  assert.equal(plain.state.panel, "history");
  assert.equal(plain.corrected, false);
  const carried = readBuildAddressState(
    { panel: "switcher", view: "changes", catalogueScreen: "home" },
    defaults,
  );
  assert.equal(carried.corrected, true);
  assert.equal(carried.state.panel, "switcher");
  assert.equal(carried.state.selection.view, "all");
  assert.equal(carried.state.selection.screen, undefined);
  // Share needs a publication, which an unpublished build does not have.
  const share = readBuildAddressState({ panel: "share" }, defaults);
  assert.equal(share.state.panel, undefined);
  assert.equal(share.corrected, true);
  const published = readBuildAddressState(
    { panel: "share" },
    { ...defaults, publication: true },
  );
  assert.equal(published.state.panel, "share");
});
