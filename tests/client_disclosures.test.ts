import assert from "node:assert/strict";
import test from "node:test";

import { parseBrowseRecoveryState } from "../packages/viewer/dist/runtime.js";
import { isDisclosureKey } from "../packages/viewer/dist/shell/disclosure_keys.js";
import {
  decodeDisclosureMap,
  encodeDisclosureMap,
  parseDisclosureMap,
  restoreDisclosureMap,
} from "../packages/viewer/dist/shell/disclosure_storage.js";

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
  delete legacyState["filterBaselineDisclosures"];
  assert.deepEqual(parseBrowseRecoveryState(legacyState), {
    ...browseState(),
    filterBaselineDisclosures: null,
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
      filterBaselineDisclosures: {},
      query: "",
    }),
    undefined,
  );
});

test("pre-upgrade watched recovery payloads are discarded, not migrated", () => {
  const old = { ...browseState() } as Record<string, unknown>;
  old["closedCollectionIds"] = ["collection:pages:Product"];
  assert.equal(parseBrowseRecoveryState(old), undefined);
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), closedFolderKeys: [] }),
    undefined,
  );
});

test("a current recovery snapshot filters invalid disclosure entries", () => {
  const state = {
    ...browseState(),
    disclosures: {
      "collection:pages:Product": true,
      "folder:pages:fixture": false,
      "section:pages": "closed",
    },
  };
  assert.deepEqual(parseBrowseRecoveryState(state), {
    ...browseState(),
    disclosures: { "folder:pages:fixture": false },
  });
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), disclosures: [] }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({
      ...browseState(),
      disclosures: ["section:pages"],
    }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({
      ...browseState(),
      filterBaselineDisclosures: [],
    }),
    undefined,
  );
});

test("disclosure v3 codec round-trips explicit values and rejects malformed storage", () => {
  const values = {
    "section:pages": false,
    "folder:pages:Design: System/Browse": true,
    "variants:pages:my-screen": false,
  };
  assert.deepEqual(parseDisclosureMap(encodeDisclosureMap(values)), values);
  for (const value of [null, false, 42, [], ["section:pages"]])
    assert.deepEqual(decodeDisclosureMap(value), {});
  assert.deepEqual(parseDisclosureMap("not json"), {});
  assert.deepEqual(
    parseDisclosureMap(
      JSON.stringify([
        "collection:pages:Product",
        "section:pages",
        "variants:pages:home",
      ]),
    ),
    {},
  );
  assert.deepEqual(
    parseDisclosureMap(
      JSON.stringify({
        ...values,
        "folder:pages:Bad//Path": true,
        "collection:pages:Design": false,
        "section:components": "closed",
      }),
    ),
    values,
  );
});

test("a renamed folder and descendants use defaults while unrelated keys retain stored values", () => {
  const defaults = {
    "folder:pages:Renamed": true,
    "folder:pages:Renamed/Child": false,
    "folder:pages:Unrelated": true,
  };
  assert.deepEqual(
    restoreDisclosureMap(defaults, {
      "folder:pages:Old": false,
      "folder:pages:Old/Child": true,
      "folder:pages:Unrelated": false,
    }),
    { ...defaults, "folder:pages:Unrelated": false },
  );
});
