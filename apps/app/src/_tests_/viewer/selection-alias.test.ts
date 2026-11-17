import assert from "node:assert/strict";
import { test } from "node:test";

import {
  readViewerState,
  referenceResolutionHref,
} from "../../viewer/selection";
import { defaults } from "./fixtures";

test("a branch alias keeps History open on its resolved publication", () => {
  const search = "?branch=main&panel=history";
  const ready = { ...defaults, publication: true };
  const initial = readViewerState(
    Object.fromEntries(new URLSearchParams(search)),
    ready,
  );
  const path = "/acme/website/publications/p1";
  const href = referenceResolutionHref(
    path,
    search,
    initial.state,
    ready,
    initial.corrected,
  );
  assert.equal(href, path + "?panel=history");
  const resolved = readViewerState(
    Object.fromEntries(new URLSearchParams(href.split("?")[1])),
    ready,
  );
  assert.equal(resolved.state.panel, "history");
  assert.equal(resolved.corrected, false);
});
