import assert from "node:assert/strict";
import test from "node:test";

import { isDisclosureKey } from "../packages/viewer/dist/shell/disclosure_keys.js";
import {
  decodeDisclosureMap,
  disclosureStorageKey,
  encodeDisclosureMap,
  parseDisclosureMap,
  reconcileDisclosures,
} from "../packages/viewer/dist/shell/disclosure_storage.js";

import { fixtureShellState } from "./helpers/viewer_catalogue.js";

test("stored disclosures accept valid folder paths, including uppercase and underscores, but not empty segments", () => {
  for (const key of [
    "section:specs",
    "section:components",
    "variants:my-screen",
    "folder:specs:Design_System/Browse",
    "folder:components:Design_System/Browse",
  ])
    assert.equal(isDisclosureKey(key), true, key);
  for (const key of [
    "folder:specs:",
    "folder:specs:Design/",
    "folder:specs:/Design",
    "folder:specs:Design//Browse",
    "folder:other:Design",
    "section:pages",
    "folder:pages:Design",
    "collection:Design",
    "collection:pages:Design",
    "legacy:Design",
  ])
    assert.equal(isDisclosureKey(key), false, key);
});

test("disclosure v4 codec round-trips explicit values and rejects malformed storage", () => {
  assert.equal(disclosureStorageKey, "mokly:nav-disclosure:v4");
  const values = {
    "section:specs": false,
    "folder:specs:Design_System/Browse": true,
    "variants:my-screen": false,
  };
  assert.deepEqual(parseDisclosureMap(encodeDisclosureMap(values)), values);
  for (const value of [null, false, 42, [], ["section:specs"]])
    assert.deepEqual(decodeDisclosureMap(value), {});
  assert.deepEqual(parseDisclosureMap("not json"), {});
  assert.deepEqual(
    parseDisclosureMap(
      JSON.stringify([
        "folder:specs:product",
        "section:specs",
        "variants:product/browse/home",
      ]),
    ),
    {},
  );
  assert.deepEqual(
    parseDisclosureMap(
      JSON.stringify({
        ...values,
        "folder:specs:Bad//Path": true,
        "folder:pages:Design_System/Browse": false,
        "section:pages": false,
        "section:components": "closed",
      }),
    ),
    values,
  );
});

test("a moved folder and descendants use defaults while unrelated keys retain stored values", () => {
  const defaults = {
    "folder:specs:Renamed": true,
    "folder:specs:Renamed/Child": false,
    "folder:specs:Unrelated": true,
  };
  assert.deepEqual(
    reconcileDisclosures(
      defaults,
      {
        "folder:specs:Old": false,
        "folder:specs:Old/Child": true,
        "folder:specs:Unrelated": false,
      },
      "default",
    ),
    { ...defaults, "folder:specs:Unrelated": false },
  );
  assert.deepEqual(
    reconcileDisclosures(
      defaults,
      {
        "folder:specs:Old": false,
        "folder:specs:Old/Child": true,
        "folder:specs:Unrelated": false,
      },
      "open",
    ),
    {
      "folder:specs:Renamed": true,
      "folder:specs:Renamed/Child": true,
      "folder:specs:Unrelated": false,
    },
  );
});

test("stored disclosures reconcile listed, missing, obsolete, and invalid keys", () => {
  const folder = "folder:specs:product/browse";
  const obsolete = "folder:pages:product/browse";
  const unrelated = "folder:components:components";
  const cases: readonly {
    name: string;
    stored: Record<string, unknown>;
    listed: boolean;
  }[] = [
    { name: "listed", stored: { [folder]: true }, listed: true },
    { name: "unlisted", stored: {}, listed: false },
    {
      name: "obsolete",
      stored: { [obsolete]: true },
      listed: false,
    },
    { name: "invalid", stored: { [folder]: "open" }, listed: false },
  ];
  for (const scenario of cases) {
    const stored = {
      [unrelated]: false,
      ...scenario.stored,
    } as unknown as Readonly<Record<string, boolean>>;
    const state = fixtureShellState({
      href: "https://example.test/",
      initial: { disclosures: stored },
    });
    const label = scenario.name;
    assert.equal(
      state.disclosures[folder],
      scenario.listed,
      `${label}: stored disclosure`,
    );
    assert.equal(state.disclosures[unrelated], false, `${label}: unrelated`);
    assert.equal(
      state.filterBaseline?.[folder],
      undefined,
      `${label}: pre-filter baseline`,
    );
    const baseline = reconcileDisclosures(
      { [folder]: false, [unrelated]: true },
      stored,
      "default",
    );
    assert.equal(
      baseline[folder],
      scenario.listed,
      `${label}: baseline fallback`,
    );
    assert.deepEqual(Object.keys(baseline), [folder, unrelated]);
    assert.equal(
      Object.hasOwn(state.disclosures, obsolete),
      false,
      `${label}: obsolete key`,
    );
  }
});
