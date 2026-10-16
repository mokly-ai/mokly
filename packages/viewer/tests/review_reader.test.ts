/**
 * The review v8 reader against the model crate's own fixture and the invalid
 * cases of its reader tests, so both readers admit the same results.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { MoklyVersionError } from "../src/catalogue/version_error.js";
import { parseReviewResult } from "../src/review/result_validation.js";
import type { ReviewEntry, ReviewResult } from "../src/review/types.js";

/** A fresh, mutable copy of `crates/mokly-model`'s review v8 fixture. */
function fixture(edit?: (result: ReviewResult) => void): ReviewResult {
  const result = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../crates/mokly-model/src/_tests_/fixtures/review-v8.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as ReviewResult;
  edit?.(result);
  return result;
}

const card = (result: ReviewResult) => result.entries[0]!;
const home = (result: ReviewResult) => result.entries[1]!;
const usage = (result: ReviewResult) => result.affected[0]!.evidence[0]!;

test("the fixture round-trips and keeps omitted empty evidence omitted", () => {
  const parsed = parseReviewResult(fixture());
  assert.deepEqual(parsed, fixture());
  assert.ok(!JSON.stringify(parsed).includes('"resources"'));
});

test("an unsupported version fails before invalid nested fields", () => {
  for (const version of [0, 7, 9])
    assert.throws(
      () => parseReviewResult({ schemaVersion: version, entries: false }),
      (error) =>
        error instanceof MoklyVersionError &&
        error.boundary === "review" &&
        error.version === version &&
        error.supported === 8,
    );
  for (const value of [{ schemaVersion: "8" }, {}, null])
    assert.throws(
      () => parseReviewResult(value),
      (error) =>
        !(error instanceof MoklyVersionError) &&
        error instanceof Error &&
        /\[mokly\/review\]/.test(error.message),
    );
});

const INVALID: readonly [string, (result: ReviewResult) => void][] = [
  ["an unknown field", (r) => Object.assign(r, { extra: true })],
  ["reversed entries", (r) => r.entries.reverse()],
  ["a path that is not the current side's", (r) => (card(r).path = "other")],
  ["membership without a reason", (r) => (home(r).included = true)],
  [
    "a page-owned kept rule in an unchanged view",
    (r) => (home(r).views[0]!.rules![0]!.owner = { kind: "entry" }),
  ],
  ["an empty evidence list", (r) => (home(r).views[0]!.resources = [])],
  ["an empty ownership chain", (r) => (usage(r).via = [])],
  [
    "a changed component without impact",
    (r) => (r.affected[0]!.changedComponentId = "unknown"),
  ],
  ["a case-only previous path", (r) => (card(r).previousPath = "Card")],
  [
    "a stylesheet reason without owned evidence",
    (r) =>
      (card(r).reasons[0] = { kind: "dependency", path: "static/other.css" }),
  ],
  ["an unlisted consumer", (r) => (r.affected[0]!.consumer.path = "unknown")],
  ["a forged context title", (r) => (usage(r).context.entry.title = "Forged")],
  [
    "a chain that ends at another component",
    (r) => (usage(r).via[0]!.componentId = "other"),
  ],
  ["an explicit null", (r) => Object.assign(card(r), { previousPath: null })],
  [
    "an implementation reason on a screen",
    (r) => {
      home(r).reasons.push({ kind: "implementation" });
      home(r).included = true;
    },
  ],
];

for (const [name, edit] of INVALID)
  test(`the reader rejects ${name}`, () =>
    assert.throws(() => parseReviewResult(fixture(edit)), /\[mokly\/review\]/));

test("the reader rejects a variant that is not a component", () => {
  // An otherwise valid screen record, so only the kind rule rejects it.
  const screen = fixture((result) => {
    const side = { path: "card/screen", title: "card/screen", props: {} };
    card(result).variants = [
      {
        ...variantOf(card(result), "card/screen", []),
        kind: "screen",
        before: side,
        after: side,
      },
    ];
  });
  assert.throws(
    () => parseReviewResult(screen),
    /a variant is a component record/,
  );
});

test("a moved component keeps its base path for before-side chains", () => {
  const moved = (result: ReviewResult) => {
    card(result).before!.path = "old-card";
    usage(result).via[0]!.componentId = "old-card";
  };
  assert.throws(() => parseReviewResult(fixture(moved)), /\[mokly\/review\]/);
  const paired = fixture((result) => {
    moved(result);
    card(result).previousPath = "old-card";
  });
  assert.deepEqual(parseReviewResult(structuredClone(paired)), paired);
});

test("an implementation reason belongs to a component parent", () => {
  const parent = fixture((result) =>
    card(result).reasons.push({ kind: "implementation" }),
  );
  assert.deepEqual(parseReviewResult(structuredClone(parent)), parent);
  const variant = fixture((result) => {
    card(result).variants = [
      variantOf(card(result), "card/compact", [{ kind: "implementation" }]),
    ];
  });
  assert.throws(() => parseReviewResult(variant), /\[mokly\/review\]/);
});

test("a chain sorts before a longer chain that starts with it", () => {
  const chains = (order: readonly number[]) =>
    fixture((result) => {
      const [first] = result.affected[0]!.evidence;
      const longer = {
        ...structuredClone(first!),
        via: [
          ...first!.via,
          { componentId: "card", instanceKey: "b".repeat(64) },
        ],
      };
      const both = [first!, longer];
      result.affected[0]!.evidence = order.map((index) => both[index]!);
    });
  const ordered = chains([0, 1]);
  assert.deepEqual(parseReviewResult(structuredClone(ordered)), ordered);
  assert.throws(() => parseReviewResult(chains([1, 0])), /\[mokly\/review\]/);
});

test("current variants come before base-only variants", () => {
  const variants = (order: readonly ("current" | "base")[]) =>
    fixture((result) => {
      card(result).variants = order.map((side, index) =>
        side === "current"
          ? variantOf(card(result), `card/current-${index}`, [])
          : removedVariant(`card/base-${index}`),
      );
    });
  const ordered = variants(["current", "base"]);
  assert.deepEqual(parseReviewResult(structuredClone(ordered)), ordered);
  assert.throws(
    () => parseReviewResult(variants(["base", "current"])),
    /\[mokly\/review\]/,
  );
});

/** An unchanged saved variant of the fixture's card, with these reasons. */
function variantOf(
  parent: ReviewEntry,
  path: string,
  reasons: ReviewEntry["reasons"],
): ReviewEntry {
  const side = { ...parent.after!, path, title: path };
  return {
    kind: "component",
    path,
    title: path,
    before: side,
    after: side,
    state: "unchanged",
    included: reasons.length > 0,
    reasons,
    views: [
      {
        viewport: "mobile",
        colorScheme: "light",
        state: "unchanged",
        ignoredIds: [],
      },
    ],
  };
}

/** A saved variant that only the base has. */
function removedVariant(path: string): ReviewEntry {
  return {
    kind: "component",
    path,
    title: path,
    before: { path, title: path, props: {}, suppliedSlots: [] },
    state: "removed",
    included: true,
    reasons: [{ kind: "removed" }],
    views: [
      {
        viewport: "mobile",
        colorScheme: "light",
        state: "removed",
        ignoredIds: [],
      },
    ],
  };
}
