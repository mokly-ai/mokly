import assert from "node:assert/strict";
import test from "node:test";

import { parseBrowseRecoveryState } from "../packages/viewer/dist/runtime.js";
import { isDisclosureKey } from "../packages/viewer/dist/shell/disclosure_keys.js";

import { browseState } from "./helpers/browse_recovery_state.js";

test("stored disclosures accept valid folder paths, including colons, but not empty segments", () => {
  for (const key of [
    "section:pages",
    "section:components",
    "variants:pages:my-screen",
    "folder:pages:Design: System/Browse",
    "folder:components:Design: System/Browse",
  ])
    assert.equal(isDisclosureKey(key), true, key);
  for (const key of [
    "folder:pages:",
    "folder:pages:Design/",
    "folder:pages:/Design",
    "folder:pages:Design//Browse",
    "folder:other:Design",
    "collection:Design",
    "collection:pages:Design",
    "legacy:Design",
  ])
    assert.equal(isDisclosureKey(key), false, key);
});

test("Browse recovery parsing rejects malformed session state", () => {
  for (const changesStatus of [
    "preparing",
    "pending",
    "ready",
    "unavailable",
  ] as const) {
    const state = { ...browseState(), changesStatus };
    assert.deepEqual(parseBrowseRecoveryState(state), state);
  }
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), changesStatus: "unknown" }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), changesStatus: null }),
    undefined,
  );
  assert.deepEqual(parseBrowseRecoveryState(browseState()), browseState());
  const legacyState: Record<string, unknown> = { ...browseState() };
  delete legacyState["filterBaselineClosedFolderKeys"];
  assert.deepEqual(parseBrowseRecoveryState(legacyState), {
    ...browseState(),
    filterBaselineClosedFolderKeys: null,
  });
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), viewport: "tablet" }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({
      ...browseState(),
      regionScrolls: { stage: -1 },
    }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), regionScrolls: [4] }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({
      ...browseState(),
      changedOnly: false,
      filterBaselineClosedFolderKeys: [],
      query: "",
    }),
    undefined,
  );
});

test("pre-upgrade watched recovery payloads are discarded, not migrated", () => {
  const old = { ...browseState() } as Record<string, unknown>;
  old["closedCollectionIds"] = ["collection:pages:Product"];
  delete old["closedFolderKeys"];
  assert.equal(parseBrowseRecoveryState(old), undefined);
});

test("a current recovery snapshot keeps unknown strings for default-aware restore", () => {
  const state = {
    ...browseState(),
    closedFolderKeys: ["collection:pages:Product"],
  };
  assert.deepEqual(parseBrowseRecoveryState(state), {
    ...state,
    filterBaselineClosedFolderKeys: ["folder:pages:fixture"],
  });
});
