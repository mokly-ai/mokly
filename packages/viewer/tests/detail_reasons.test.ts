/**
 * An entry detail's `reasons` under the shell delivery contract: the review
 * v8 reason shapes in sorted unique order, with additive fields ignored as
 * the detail's other records ignore them. A pair whose reasons disagree with
 * the index stays accepted, so a detail written before them still loads.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { fenceDetail } from "../src/catalogue/detail_fences.js";
import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";

import { indexFixture, rawDetailFixtures } from "./catalogue_v8_fixture.js";

type Raw = Record<string, unknown>;

const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";

function current(path: string, reasons?: unknown): Raw {
  const detail = rawDetailFixtures().current[path] as unknown as Raw;
  if (reasons === undefined) delete detail.reasons;
  else detail.reasons = reasons;
  return detail;
}

/** The fixture index while its Changes are still pending. */
function pendingIndex() {
  return indexFixture((raw) => {
    raw.changesStatus = "pending";
    delete raw.baseCommit;
    raw.comparisonUrl = null;
    raw.removedEntries = [];
    for (const entry of [
      ...raw.screens,
      ...raw.components,
      ...raw.pages,
      ...raw.documents,
      ...raw.useCases,
    ]) {
      entry.changes = { status: "pending" };
      delete entry.previousPath;
      if ("comparison" in entry) entry.comparison = { status: "pending" };
      if ("views" in entry)
        for (const view of entry.views) view.comparison = { status: "pending" };
    }
  });
}

function rejects(detail: Raw, reason: RegExp): void {
  assert.throws(
    () => readEntryDetail(detail),
    (error) =>
      !(error instanceof MoklyVersionError) &&
      error instanceof Error &&
      reason.test(error.message),
  );
}

test("a detail reads every review v8 reason shape in canonical order", () => {
  for (const [path, reasons] of [
    ["components/action", []],
    ["components/action", [{ kind: "implementation" }]],
    [
      "product/browse/home",
      [
        { kind: "added" },
        { kind: "dependency", path: "static/a.css" },
        { kind: "dependency", path: "static/b.css" },
        { kind: "implementation" },
        { kind: "inputs" },
        { kind: "material" },
        { kind: "metadata" },
        { kind: "removed" },
        { kind: "structure" },
      ],
    ],
    [
      "tour",
      [
        { kind: "screen", screenPath: "product/browse/details" },
        { kind: "screen", screenPath: "product/browse/home" },
      ],
    ],
  ] as const)
    assert.deepEqual(readEntryDetail(current(path, reasons)).reasons, reasons);
  assert.equal(
    Object.hasOwn(readEntryDetail(current("guide")), "reasons"),
    false,
  );
});

test("reasons keep the review shapes and reject other values", () => {
  const cases: [unknown, RegExp][] = [
    [null, /expected an array/],
    [{ kind: "material" }, /expected an array/],
    [["material"], /expected an object/],
    [[{ kind: "unknown" }], /unsupported discriminant/],
    [[{}], /unsupported discriminant/],
    [[{ kind: "dependency" }], /expected a string/],
    [[{ kind: "dependency", path: "" }], /expected nonempty text/],
    [[{ kind: "dependency", path: 1 }], /expected a string/],
    [[{ kind: "dependency", path: "../theme.css" }], /repository-relative/],
    [[{ kind: "screen", screenPath: "Not a path" }], /invalid entry path/],
    [[{ kind: "screen", screen_path: "home" }], /invalid entry path/],
    [[{ kind: "material", path: "static/a.css" }], /names a path/],
    [
      [{ kind: "dependency", path: "static/a.css", screenPath: "home" }],
      /names a screen/,
    ],
  ];
  for (const [reasons, reason] of cases)
    rejects(current("product/browse/home", reasons), reason);
});

test("reasons are sorted by kind, then target, with no duplicate", () => {
  for (const reasons of [
    [{ kind: "material" }, { kind: "added" }],
    [{ kind: "material" }, { kind: "material" }],
    [{ kind: "material" }, { kind: "dependency", path: "static/a.css" }],
    [
      { kind: "dependency", path: "static/b.css" },
      { kind: "dependency", path: "static/a.css" },
    ],
    [
      { kind: "dependency", path: "static/a.css" },
      { kind: "dependency", path: "static/a.css" },
    ],
    // UTF-16 order puts the supplementary character before U+E000.
    [
      { kind: "dependency", path: "static/\u{e000}.css" },
      { kind: "dependency", path: "static/\u{10000}.css" },
    ],
  ])
    rejects(current("product/browse/home", reasons), /sorted and unique/);
  assert.equal(
    readEntryDetail(
      current("product/browse/home", [
        { kind: "dependency", path: "static/\u{10000}.css" },
        { kind: "dependency", path: "static/\u{e000}.css" },
      ]),
    ).reasons?.length,
    2,
  );
});

test("a reason ignores additive fields but keeps its own", () => {
  const detail = current("product/browse/home", [
    { kind: "dependency", path: "static/a.css", later: 1 },
    { kind: "material", later: { nested: true } },
  ]);
  assert.deepEqual(readEntryDetail(detail).reasons, [
    { kind: "dependency", path: "static/a.css" },
    { kind: "material" },
  ]);
});

test("the fence keeps a pair whose reasons disagree with the index", () => {
  // A detail written before decision D1 has no reasons, and a host can pair
  // its own records; Details then ignore what the index does not list.
  const index = indexFixture();
  const fence = (path: string, reasons?: unknown) =>
    fenceDetail(index, { path }, readEntryDetail(current(path, reasons))).kind;
  for (const [path, reasons] of [
    ["product/browse/home", [{ kind: "material" }]],
    ["product/browse/home", undefined],
    ["product/browse/details", []],
    ["product/browse/details", undefined],
    ["guide", undefined],
    ["guide", []],
    ["components/action", [{ kind: "material" }]],
  ] as const)
    assert.equal(fence(path, reasons), "accepted", `${path} ${reasons}`);
  const pending = pendingIndex();
  const home = { path: "product/browse/home" };
  for (const reasons of [undefined, [{ kind: "material" }]])
    assert.equal(
      fenceDetail(pending, home, readEntryDetail(current(home.path, reasons)))
        .kind,
      "accepted",
    );
});

test("a removed detail carries its removed reason", () => {
  const index = indexFixture();
  const raw = rawDetailFixtures().removed[RETIRED] as unknown as Raw;
  const request = {
    path: "product/browse/home/retired",
    snapshotId: RETIRED,
  };
  assert.deepEqual(readEntryDetail(structuredClone(raw)).reasons, [
    { kind: "removed" },
  ]);
  assert.equal(
    fenceDetail(index, request, readEntryDetail(structuredClone(raw))).kind,
    "accepted",
  );
  delete raw.reasons;
  assert.equal(
    fenceDetail(index, request, readEntryDetail(raw)).kind,
    "accepted",
  );
});
