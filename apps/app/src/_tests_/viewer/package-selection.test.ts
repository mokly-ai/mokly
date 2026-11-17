import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fromPackageSelection,
  toPackageSelection,
} from "../../viewer/package-selection";
import { removed } from "./fixtures";

test("the package selection adapter round-trips every controlled field", () => {
  const cloud = {
    screen: removed.screen,
    snapshotId: removed.snapshotId,
    view: "changes" as const,
    viewport: "both" as const,
    scheme: "dark" as const,
    search: "checkout form",
    tags: ["forms", "critical"],
  };
  const packaged = toPackageSelection(cloud);
  assert.equal(packaged.screenPath, removed.screen);
  assert.equal(packaged.snapshotId, removed.snapshotId);
  assert.deepEqual(fromPackageSelection(packaged), cloud);
});

test("current content names no snapshot in either direction", () => {
  const cloud = {
    screen: "notice/draft",
    view: "all" as const,
    viewport: "desktop" as const,
    scheme: "light" as const,
    search: "",
    tags: [],
  };
  const packaged = toPackageSelection(cloud);
  // The package refuses a selection with a key it does not know, so the
  // adapter writes exactly the package's own fields and nothing else.
  assert.deepEqual(Object.keys(packaged).sort(), [
    "colorScheme",
    "screenPath",
    "search",
    "tags",
    "view",
    "viewport",
  ]);
  assert.equal("snapshotId" in fromPackageSelection(packaged), false);
});

test("catalogue home maps only between undefined and null", () => {
  const cloud = {
    view: "all" as const,
    viewport: "desktop" as const,
    scheme: "light" as const,
    search: "",
    tags: [],
  };
  const packaged = toPackageSelection(cloud);
  assert.equal(packaged.screenPath, null);
  assert.equal(fromPackageSelection(packaged).screen, undefined);
});
